// ============================================================
// NyayaSetu — Single Source of Truth for All Types and Enums
// ============================================================

// ---------------------- User Roles ----------------------

export enum UserRole {
  CITIZEN = 'citizen',
  OFFICER = 'officer',
  SUPERVISOR = 'supervisor',
  ADMIN = 'admin',
}

// ---------------------- Complaint Status ----------------------

export enum ComplaintStatus {
  SUBMITTED = 'submitted',
  VERIFIED = 'verified',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  ESCALATED = 'escalated',
  REOPENED = 'reopened',
  TRANSFERRED = 'transferred',
}

// ---------------------- Complaint Categories ----------------------

export enum ComplaintCategory {
  GARBAGE_COLLECTION = 'garbage_collection',
  WATER_LEAKAGE = 'water_leakage',
  SEWER_BLOCKAGE = 'sewer_blockage',
  DRAIN_OVERFLOW = 'drain_overflow',
  STREETLIGHT = 'streetlight',
  POTHOLE = 'pothole',
  ILLEGAL_DUMPING = 'illegal_dumping',
  MOSQUITO_SANITATION = 'mosquito_sanitation',
  STRAY_ANIMAL = 'stray_animal',
  PARK_MAINTENANCE = 'park_maintenance',
  ENCROACHMENT = 'encroachment',
}

// ---------------------- SLA Hours Map ----------------------

export const SLA_HOURS: Record<ComplaintCategory, number> = {
  [ComplaintCategory.GARBAGE_COLLECTION]: 24,
  [ComplaintCategory.WATER_LEAKAGE]: 48,
  [ComplaintCategory.SEWER_BLOCKAGE]: 24,
  [ComplaintCategory.DRAIN_OVERFLOW]: 24,
  [ComplaintCategory.STREETLIGHT]: 72,
  [ComplaintCategory.POTHOLE]: 168,
  [ComplaintCategory.ILLEGAL_DUMPING]: 48,
  [ComplaintCategory.MOSQUITO_SANITATION]: 48,
  [ComplaintCategory.STRAY_ANIMAL]: 72,
  [ComplaintCategory.PARK_MAINTENANCE]: 120,
  [ComplaintCategory.ENCROACHMENT]: 96,
};

// ---------------------- Urgency ----------------------

export enum Urgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

// ---------------------- Department ----------------------

export interface Department {
  id: string;
  name: string;
}

// ---------------------- Category → Department Map ----------------------

export const CATEGORY_DEPARTMENT_MAP: Record<ComplaintCategory, string> = {
  [ComplaintCategory.GARBAGE_COLLECTION]: 'dept_001',
  [ComplaintCategory.WATER_LEAKAGE]: 'dept_002',
  [ComplaintCategory.SEWER_BLOCKAGE]: 'dept_002',
  [ComplaintCategory.DRAIN_OVERFLOW]: 'dept_002',
  [ComplaintCategory.STREETLIGHT]: 'dept_003',
  [ComplaintCategory.POTHOLE]: 'dept_004',
  [ComplaintCategory.ILLEGAL_DUMPING]: 'dept_001',
  [ComplaintCategory.MOSQUITO_SANITATION]: 'dept_005',
  [ComplaintCategory.STRAY_ANIMAL]: 'dept_006',
  [ComplaintCategory.PARK_MAINTENANCE]: 'dept_005',
  [ComplaintCategory.ENCROACHMENT]: 'dept_007',
};

// ---------------------- Complaint ----------------------

export interface Complaint {
  id: string;
  uid: string;
  citizen_id: string;
  title: string;
  category: ComplaintCategory;
  department_id: string;
  description: string;
  location_text: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  ward: string | null;
  zone: string | null;
  status: ComplaintStatus;
  urgency: Urgency;
  proof_image_urls: string[];
  sla_deadline: string;
  assigned_officer_id: string | null;
  resolution_notes: string | null;
  resolution_proof_url: string | null;
  citizen_feedback: string | null;
  citizen_rating: number | null;
  is_escalated: boolean;
  ai_severity: AISeverity | null;
  geo_context: GeoContext | null;
  confirmations: number;
  priority_score: number;
  priority_band: PriorityBand;
  priority_breakdown: PriorityFactor[];
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------- Complaint Timeline Entry ----------------------

export interface ComplaintTimelineEntry {
  id: string;
  complaint_id: string;
  status: ComplaintStatus;
  changed_by: string;
  notes: string | null;
  public_note: string | null;
  created_at: string;
}

// ---------------------- Citizen ----------------------

export interface Citizen {
  id: string;
  phone: string;
  name: string | null;
  age: number | null;
  gender: string | null;
  occupation: string | null;
  income_bracket: string | null;
  ward: string | null;
  zone: string | null;
  created_at: string;
}

// ---------------------- Officer ----------------------

export interface Officer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  department_id: string;
  ward: string | null;
  zone: string | null;
  is_active: boolean;
  role: UserRole;
  created_at: string;
}

// ---------------------- OTP ----------------------

export interface OTPRecord {
  id: string;
  phone: string;
  otp_hash: string;
  expires_at: string;
  is_verified: boolean;
  session_token: string | null;
  created_at: string;
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  expires_in_seconds: number;
  demo_otp?: string; // only when OTP_MOCK_MODE=true
}

export interface VerifyOTPResponse {
  success: boolean;
  session_token: string | null;
}

export interface ValidateSessionResponse {
  valid: boolean;
  phone: string | null;
}

// ---------------------- Priority Scoring ----------------------

export type PriorityBand = 'P1' | 'P2' | 'P3' | 'P4';

export interface PriorityFactor {
  key: 'severity' | 'location' | 'frequency' | 'time' | 'season';
  label: string;
  points: number;
  max: number;
  reason: string;
}

export interface PriorityResult {
  score: number;
  band: PriorityBand;
  factors: PriorityFactor[];
}

export interface AISeverity {
  severity: number; // 1–5
  hazards: string[];
  reasoning: string;
  source: 'ai' | 'keywords';
}

export interface GeoContext {
  source: 'osm' | 'unavailable';
  radius_m: number;
  hospitals: string[];
  schools: string[];
  markets: string[];
  busStops: string[];
  majorRoad: string | null;
}

// ---------------------- Classifier Result ----------------------

export interface ClassifyComplaintResult {
  category: ComplaintCategory;
  department_id: string;
  urgency: Urgency;
  confidence: number;
}

// ---------------------- User (DB table) ----------------------

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  password_hash: string | null;
  is_active: boolean;
  department_id: string | null;
  ward: string | null;
  zone: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------- Auth Session ----------------------

export interface AuthSession {
  user_id: string;
  role: UserRole;
  email?: string;
  phone?: string;
  name?: string;
}

// ---------------------- Complaint Filing ----------------------

export interface FileComplaintRequest {
  session_token: string;
  name: string;
  title: string;
  category: ComplaintCategory;
  description: string;
  address: string;
  landmark: string | null;
  ward: string | null;
  latitude: number;
  longitude: number;
  photo: string | null; // JPEG data URL, resized in the browser
}

export interface FileComplaintResponse {
  success: boolean;
  complaint_uid: string | null;
  message: string;
  classification: ClassifyComplaintResult | null;
  priority?: PriorityResult | null;
}

// ---------------------- Officer Portal ----------------------

export interface UpdateComplaintStatusRequest {
  status: ComplaintStatus;
  remarks: string | null;
  public_note: string | null;
}

export interface TransferComplaintRequest {
  department_id: string;
  reason: string;
}

// Legal status transitions
export const VALID_STATUS_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  [ComplaintStatus.SUBMITTED]: [ComplaintStatus.VERIFIED, ComplaintStatus.ASSIGNED],
  [ComplaintStatus.VERIFIED]: [ComplaintStatus.ASSIGNED],
  [ComplaintStatus.ASSIGNED]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.TRANSFERRED],
  [ComplaintStatus.IN_PROGRESS]: [ComplaintStatus.RESOLVED, ComplaintStatus.ESCALATED],
  [ComplaintStatus.RESOLVED]: [ComplaintStatus.CLOSED, ComplaintStatus.REOPENED],
  [ComplaintStatus.CLOSED]: [],
  [ComplaintStatus.ESCALATED]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.TRANSFERRED],
  [ComplaintStatus.REOPENED]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.ASSIGNED],
  [ComplaintStatus.TRANSFERRED]: [ComplaintStatus.ASSIGNED],
};

// ---------------------- Supervisor Dashboard ----------------------

export interface CategoryBreakdown {
  category: string;
  count: number;
}

export interface WardHotspot {
  ward: string;
  count: number;
}

export interface DailyTrend {
  date: string;
  count: number;
}

export interface DashboardMetrics {
  total_complaints: number;
  active_complaints: number;
  resolved_complaints: number;
  overdue_complaints: number;
  escalated_complaints: number;
  sla_compliance_rate: number;
  avg_resolution_hours: number;
  category_breakdown: CategoryBreakdown[];
  ward_hotspots: WardHotspot[];
  daily_trend: DailyTrend[];
}

export interface OfficerPerformance {
  officer_id: string;
  officer_name: string;
  department_name: string;
  assigned_count: number;
  resolved_count: number;
  overdue_count: number;
  avg_resolution_hours: number;
  sla_compliance_rate: number;
}

export interface EscalateRequest {
  complaint_id: string;
  reason: string;
  reassign_to_officer_id?: string;
}

// ---------------------- AI Chat ----------------------

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
