import { create } from 'zustand';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  xp: number;
}

interface AuthStore {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  syncUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  token: localStorage.getItem('liquidity_crisis_token'),
  user: null,
  isAuthenticated: !!localStorage.getItem('liquidity_crisis_token'),

  login: (token: string, user: UserProfile) => {
    localStorage.setItem('liquidity_crisis_token', token);
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('liquidity_crisis_token');
    set({ token: null, user: null, isAuthenticated: false });
  },

  syncUser: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isAuthenticated: true });
      } else {
        // Token expired/invalid
        get().logout();
      }
    } catch (err) {
      console.error('Failed to sync user profile:', err);
    }
  }
}));
