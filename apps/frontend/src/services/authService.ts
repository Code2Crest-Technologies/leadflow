import { apiClient } from './apiClient';
import type { User } from '@/types';
import { useAuthStore } from '@/store';

export interface AuthSession {
  token: string;
  user: User;
}

export const AuthService = {
  async login(email: string, password: string): Promise<AuthSession> {
    const response = await apiClient.post('/api/auth/login', { email, password });
    const session = response.data.data as AuthSession;
    useAuthStore.getState().setSession(session.token, session.user);
    return session;
  },

  logout() {
    useAuthStore.getState().clearSession();
  },

  getUser(): User | null {
    const storedUser = useAuthStore.getState().user;
    if (storedUser) return storedUser;

    const value = localStorage.getItem('authUser');
    return value ? JSON.parse(value) : null;
  },
};
