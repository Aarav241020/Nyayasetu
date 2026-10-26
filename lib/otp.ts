import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '@/lib/db';
import type { SendOTPResponse, VerifyOTPResponse, ValidateSessionResponse } from '@/types';

const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const SESSION_EXPIRY_SECONDS = 1800; // 30 minutes
const SALT_ROUNDS = 10;

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET — add it to .env.local');
  }
  return secret;
}

function isMockMode(): boolean {
  return process.env.OTP_MOCK_MODE === 'true';
}

/**
 * Generate a random 6-digit OTP.
 */
function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send an OTP to the given phone number.
 * - Generates a 6-digit OTP
 * - Hashes it with bcryptjs before storing
 * - Deletes any previous unverified OTPs for this phone
 * - Inserts new OTP record into otp_verifications table
 * - In mock mode: logs OTP to console instead of sending SMS
 */
export async function sendOTP(phone: string): Promise<SendOTPResponse> {
  try {
    const otpCode = generateOTPCode();
    const otpHash = await bcrypt.hash(otpCode, SALT_ROUNDS);

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString();

    // Delete any previous unverified OTPs for this phone
    await supabaseAdmin
      .from('otp_verifications')
      .delete()
      .eq('phone', phone)
      .eq('is_verified', false);

    // Insert new OTP record
    const { error } = await supabaseAdmin
      .from('otp_verifications')
      .insert({
        phone,
        otp_hash: otpHash,
        expires_at: expiresAt,
        is_verified: false,
        session_token: null,
      });

    if (error) {
      console.error('[OTP] Insert error:', error.message);
      return { success: false, message: 'Failed to generate OTP. Please try again.', expires_in_seconds: 0 };
    }

    // Mock mode: log OTP to console
    if (isMockMode()) {
      console.log(`\n========================================`);
      console.log(`[MOCK OTP] Phone: ${phone} | OTP: ${otpCode}`);
      console.log(`========================================\n`);
    } else {
      // TODO: Integrate real SMS provider here
      console.log('[OTP] SMS sending not implemented — enable OTP_MOCK_MODE=true');
    }

    return {
      success: true,
      message: 'OTP sent successfully.',
      expires_in_seconds: OTP_EXPIRY_SECONDS,
      // No SMS is sent in mock mode, so the code has to reach the user somehow.
      // Never returned when real SMS is configured.
      ...(isMockMode() && { demo_otp: otpCode }),
    };
  } catch (err) {
    console.error('[OTP] sendOTP error:', err);
    return { success: false, message: 'An unexpected error occurred.', expires_in_seconds: 0 };
  }
}

/**
 * Verify an OTP for the given phone number.
 * - Fetches the latest unverified OTP for this phone
 * - Checks it hasn't expired
 * - Compares input OTP against stored hash using bcryptjs
 * - If valid: generates a JWT session_token, updates the OTP row
 */
export async function verifyOTP(phone: string, otp: string): Promise<VerifyOTPResponse> {
  try {
    // Fetch latest unverified OTP for this phone
    const { data: records, error: fetchError } = await supabaseAdmin
      .from('otp_verifications')
      .select('*')
      .eq('phone', phone)
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError || !records || records.length === 0) {
      return { success: false, session_token: null };
    }

    const record = records[0];

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return { success: false, session_token: null };
    }

    // Compare OTP against hash
    const isMatch = await bcrypt.compare(otp, record.otp_hash);
    if (!isMatch) {
      return { success: false, session_token: null };
    }

    // Generate JWT session token
    const sessionToken = jwt.sign(
      { phone, purpose: 'otp_session' },
      getJWTSecret(),
      { expiresIn: SESSION_EXPIRY_SECONDS }
    );

    // Update OTP record as verified with session token
    const { error: updateError } = await supabaseAdmin
      .from('otp_verifications')
      .update({
        is_verified: true,
        session_token: sessionToken,
      })
      .eq('id', record.id);

    if (updateError) {
      console.error('[OTP] Update error:', updateError.message);
      return { success: false, session_token: null };
    }

    return { success: true, session_token: sessionToken };
  } catch (err) {
    console.error('[OTP] verifyOTP error:', err);
    return { success: false, session_token: null };
  }
}

/**
 * Validate an existing OTP session token.
 * - Verifies JWT signature and expiry
 * - Checks matching verified row exists in otp_verifications
 */
export async function validateOTPSession(session_token: string): Promise<ValidateSessionResponse> {
  try {
    // Verify JWT
    const decoded = jwt.verify(session_token, getJWTSecret()) as { phone: string; purpose: string };

    if (decoded.purpose !== 'otp_session') {
      return { valid: false, phone: null };
    }

    // Check matching verified row exists
    const { data: records, error } = await supabaseAdmin
      .from('otp_verifications')
      .select('phone')
      .eq('session_token', session_token)
      .eq('is_verified', true)
      .limit(1);

    if (error || !records || records.length === 0) {
      return { valid: false, phone: null };
    }

    return { valid: true, phone: decoded.phone };
  } catch {
    // JWT expired or invalid signature
    return { valid: false, phone: null };
  }
}
