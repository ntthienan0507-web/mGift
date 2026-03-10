import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:9002/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Tự động gắn JWT token vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mgift_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tự động xử lý lỗi 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("mgift_token");
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  }
);

/**
 * Resolve image URL: relative paths like /uploads/... need the BE origin,
 * full URLs (S3) are returned as-is.
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:9002/api/v1").replace(/\/api\/v1$/, "");

export function resolveImageUrl(url: string | undefined | null, fallback = "/placeholder.svg"): string {
  if (!url) return fallback;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads/")) return `${API_ORIGIN}${url}`;
  return url;
}

export default api;
