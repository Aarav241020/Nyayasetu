'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Phone, CheckCircle, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
type VerifyStep = 'phone' | 'otp' | 'verified';

interface PhoneVerifyFlowProps {
  onVerified: (sessionToken: string, phone: string) => void;
}

/**
 * Phone verification flow:
 * Step 1: Phone number input → Send OTP
 * Step 2: OTP digit input → Verify → Resend (30s cooldown)
 * Step 3: Verified → Green tick → Proceed button
 */
export default function PhoneVerifyFlow({ onVerified }: PhoneVerifyFlowProps) {
  const [step, setStep] = useState<VerifyStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendOTP = useCallback(async () => {
    setError('');
    const phoneClean = phone.replace(/\s+/g, '');

    if (!/^\d{10}$/.test(phoneClean)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneClean }),
      });

      const data = await res.json();

      if (data.success) {
        setStep('otp');
        setResendCooldown(30);
        setDemoOtp(data.demo_otp ?? null);
        setOtp(data.demo_otp ?? '');
      } else {
        setError(data.message || 'Failed to send OTP.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const handleVerifyOTP = useCallback(async () => {
    setError('');

    if (otp.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\s+/g, ''), otp }),
      });

      const data = await res.json();

      if (data.success && data.session_token) {
        setSessionToken(data.session_token);
        setStep('verified');
      } else {
        setError('Invalid or expired OTP. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [phone, otp]);

  const handleResendOTP = useCallback(() => {
    if (resendCooldown > 0) return;
    handleSendOTP();
  }, [resendCooldown, handleSendOTP]);

  const handleProceed = useCallback(() => {
    if (sessionToken) {
      onVerified(sessionToken, phone.replace(/\s+/g, ''));
    }
  }, [sessionToken, phone, onVerified]);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Step 1: Phone Input */}
      {step === 'phone' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Phone className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Verify Your Phone
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              We&apos;ll send a 6-digit OTP to verify your number
            </p>
          </div>

          <div>
            <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-2.5 rounded-lg border border-gray-300">
                +91
              </span>
              <input
                id="phone-input"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPhone(val);
                  setError('');
                }}
                placeholder="Enter 10-digit number"
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 outline-none
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all
                  text-gray-900 placeholder-gray-400"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}

          <button
            onClick={handleSendOTP}
            disabled={loading || phone.length !== 10}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
              bg-indigo-600 text-white font-medium hover:bg-indigo-700
              disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Send OTP
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Enter OTP
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {demoOtp ? `Demo mode: no SMS is sent to +91 ${phone}` : `We sent a 6-digit code to +91 ${phone}`}
            </p>
          </div>

          {demoOtp && (
            <p className="text-sm text-center text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Your code is <span className="font-mono font-bold tracking-widest">{demoOtp}</span> (filled in for you). Press Verify.
            </p>
          )}

          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setOtp(val);
              setError('');
            }}
            disabled={loading}
            className="w-full max-w-xs mx-auto block px-4 py-2.5 text-center text-xl font-semibold
              rounded-lg border-2 border-gray-300 focus:border-indigo-500 focus:ring-2 
              focus:ring-indigo-200 outline-none tracking-[0.5em] bg-white placeholder-gray-300"
            placeholder="••••••"
            aria-label="OTP code"
          />

          {error && (
            <p className="text-sm text-red-600 text-center mt-2">{error}</p>
          )}

          <button
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
              bg-indigo-600 text-white font-medium hover:bg-indigo-700
              disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Verify'
            )}
          </button>

          <div className="text-center">
            <button
              onClick={handleResendOTP}
              disabled={resendCooldown > 0 || loading}
              className="text-sm text-indigo-600 hover:text-indigo-800 disabled:text-gray-400
                disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {resendCooldown > 0
                ? `Resend OTP in ${resendCooldown}s`
                : 'Resend OTP'
              }
            </button>
          </div>

          <button
            onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Change phone number
          </button>
        </div>
      )}

      {/* Step 3: Verified */}
      {step === 'verified' && (
        <div className="space-y-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-green-800">
              Phone Verified!
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              +91 {phone} has been verified successfully
            </p>
          </div>

          <button
            onClick={handleProceed}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg
              bg-green-600 text-white font-medium hover:bg-green-700 transition-all"
          >
            Proceed
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
