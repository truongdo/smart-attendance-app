import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  employeeCode?: string;
  fullName?: string;
  position?: string;
  department?: string;
  projectIds?: string[];
  isActive: boolean;
  isAdmin: boolean;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address: string;
  isActive: boolean;
  deviceMacs?: string[];
  createdAt: Timestamp;
}

export interface DeviceMapping {
  mac: string;
  projectId: string;
  assignedAt: Timestamp;
  assignedBy: string;
}

export interface DeviceProfile {
  mac: string;
  name: string;
  createdAt: Timestamp;
  createdBy: string;
  modifiedAt?: Timestamp;
  modifiedBy?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  employeeCode?: string;
  type: 'in' | 'out';
  timestamp: Timestamp;
  projectId?: string;
  projectName?: string;
  deviceMac?: string;
  deviceName?: string;
  deviceProjectId?: string;
  deviceProjectName?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  imageUrl: string;
  explanation?: string;
  distanceFromProject?: number;
  workHours?: number;
  overtimeHours?: number;
  date: string; // YYYY-MM-DD
  createdAt: Timestamp;
  modifiedAt?: Timestamp;
  modifiedBy?: string;
}

