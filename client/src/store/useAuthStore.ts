import { create } from "zustand";
import api from "@/services/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  register: (email: string, password: string, full_name: string, phone?: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("mgift_token"),
  isLoading: false,

  login: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("mgift_token", data.access_token);
    set({ token: data.access_token });
    // Fetch user profile
    const me = await api.get("/auth/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    set({ user: me.data });
  },

  googleLogin: async (idToken) => {
    const { data } = await api.post("/auth/google", { id_token: idToken });
    localStorage.setItem("mgift_token", data.access_token);
    set({ token: data.access_token });
    const me = await api.get("/auth/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    set({ user: me.data });
  },

  register: async (email, password, full_name, phone) => {
    await api.post("/auth/register", { email, password, full_name, phone });
  },

  fetchMe: async () => {
    const token = localStorage.getItem("mgift_token");
    if (!token) return;
    try {
      set({ isLoading: true });
      const { data } = await api.get("/auth/me");
      set({ user: data, token });
    } catch {
      localStorage.removeItem("mgift_token");
      set({ user: null, token: null });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("mgift_token");
    set({ user: null, token: null });
  },
}));
