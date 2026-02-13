// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// User Types
export interface User {
  id: number;
  name: string;
  phone: string;
  role: 'patient' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  totalQueues?: number;
  pendingQueues?: number;
}

// Queue Types
export type QueueStatus = 'pending' | 'called' | 'completed' | 'cancelled' | 'emergency_cancelled';

export interface Queue {
  id: number;
  userId: number;
  queueDate: string;
  timeSlot: string;
  queueNumber: number;
  status: QueueStatus;
  notes?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  User?: User;
}

export interface QueueBooking {
  queueDate: string;
  timeSlot: string;
  notes?: string;
}

export interface QueueUpdate {
  status: QueueStatus;
  cancelReason?: string;
}

// Notification Types
export type NotificationType = 'queue_update' | 'emergency_closure' | 'reschedule_approved' | 'reschedule_rejected' | 'system';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

// Emergency Closure Types
export interface EmergencyClosure {
  id: number;
  closureDate: string;
  reason: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyClosureCreate {
  closureDate: string;
  reason: string;
}

// Reschedule Request Types
export type RescheduleStatus = 'pending' | 'approved' | 'rejected';

export interface RescheduleRequest {
  id: number;
  queueId: number;
  requestedDate: string;
  requestedTimeSlot: string;
  reason: string;
  status: RescheduleStatus;
  adminResponse?: string;
  createdAt: string;
  updatedAt: string;
  Queue?: Queue;
}

export interface RescheduleRequestCreate {
  queueId: number;
  requestedDate: string;
  requestedTimeSlot: string;
  reason: string;
}

export interface RescheduleRequestUpdate {
  status: RescheduleStatus;
  adminResponse?: string;
}

// Practice Settings Types
export interface TimeSlot {
  value: string;
  label: string;
}

export interface PracticeSettings {
  id: number;
  openTime: string;
  closeTime: string;
  slotDuration: number;
  maxPatientsPerSlot: number;
  maxDailyPatients: number;
  advanceBookingDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeSettingsUpdate {
  openTime?: string;
  closeTime?: string;
  slotDuration?: number;
  maxPatientsPerSlot?: number;
  maxDailyPatients?: number;
  advanceBookingDays?: number;
}

// Dashboard Statistics Types
export interface DashboardStats {
  totalPatients: number;
  todayQueues: number;
  pendingQueues: number;
  completedToday: number;
  upcomingQueues: Queue[];
}

// Auth Types
export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface RegisterData {
  name: string;
  phone: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

// Activity Log Types
export interface ActivityLog {
  id: number;
  userId: number;
  action: string;
  details?: string;
  createdAt: string;
  User?: User;
}

// Report Types
export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  status?: QueueStatus;
}

export interface ReportData {
  queues: Queue[];
  totalQueues: number;
  completedQueues: number;
  cancelledQueues: number;
  pendingQueues: number;
}
