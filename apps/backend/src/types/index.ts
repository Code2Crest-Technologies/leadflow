// src/types/index.ts

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
}

export interface AuthPayload {
  userId: string;
  companyId: string;
  email: string;
  role: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}
