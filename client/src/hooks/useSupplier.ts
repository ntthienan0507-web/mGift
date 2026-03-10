import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import type { Product } from "./useGifts";

// Helper: tạo config với supplier API key
function supplierHeaders() {
  const key = localStorage.getItem("mgift_supplier_api_key");
  return key ? { headers: { "X-Supplier-API-Key": key } } : {};
}

// ==================== TYPES ====================

export interface Shop {
  id: string;
  name: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
}

export interface SupplierStats {
  total_products: number;
  total_orders: number;
  pending_orders: number;
  revenue: number;
  avg_rating: number | null;
}

export interface SupplierOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  status: string;
  supplier_deadline: string | null;
  reject_reason: string | null;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  order_created_at: string;
}

export interface SupplierProductCreate {
  name: string;
  price: number;
  category_id?: string | null;
  description?: string | null;
  stock?: number;
  metadata_info?: Record<string, unknown> | null;
}

// ==================== REGISTER SHOP ====================

export interface ShopCreateResponse extends Shop {
  api_key: string;
}

export function useCreateShop() {
  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string | null;
      contact_email?: string | null;
      contact_phone?: string | null;
      address?: string | null;
    }) => {
      const { data } = await api.post("/shops/", params);
      return data as ShopCreateResponse;
    },
  });
}

// ==================== SUPPLIER API KEY ====================

const SUPPLIER_KEY_STORAGE = "mgift_supplier_api_key";

export function getSupplierApiKey(): string | null {
  return localStorage.getItem(SUPPLIER_KEY_STORAGE);
}

export function setSupplierApiKey(key: string) {
  localStorage.setItem(SUPPLIER_KEY_STORAGE, key);
}

export function clearSupplierApiKey() {
  localStorage.removeItem(SUPPLIER_KEY_STORAGE);
}

// ==================== RECOVER API KEY ====================

export function useRecoverApiKey() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post("/shops/recover-api-key", { email });
      return data as { message: string };
    },
  });
}

// ==================== PROFILE ====================

export function useSupplierProfile() {
  const key = getSupplierApiKey();
  return useQuery<Shop>({
    queryKey: ["supplier-profile"],
    queryFn: async () => {
      const { data } = await api.get("/supplier/profile", supplierHeaders());
      return data;
    },
    enabled: !!key,
    retry: false,
  });
}

export function useUpdateSupplierProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Partial<Shop>) => {
      const { data } = await api.patch("/supplier/profile", params, supplierHeaders());
      return data as Shop;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-profile"] }),
  });
}

// ==================== STATS ====================

export function useSupplierStats() {
  const key = getSupplierApiKey();
  return useQuery<SupplierStats>({
    queryKey: ["supplier-stats"],
    queryFn: async () => {
      const { data } = await api.get("/supplier/stats", supplierHeaders());
      return data;
    },
    enabled: !!key,
  });
}

// ==================== PRODUCTS ====================

export function useSupplierProducts(params?: { skip?: number; limit?: number }) {
  const key = getSupplierApiKey();
  return useQuery<Product[]>({
    queryKey: ["supplier-products", params],
    queryFn: async () => {
      const { data } = await api.get("/supplier/products", { params, ...supplierHeaders() });
      return data;
    },
    enabled: !!key,
  });
}

export function useCreateSupplierProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: SupplierProductCreate) => {
      const { data } = await api.post("/supplier/products", params, supplierHeaders());
      return data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-products"] }),
  });
}

export function useUpdateSupplierProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      ...params
    }: { productId: string } & Partial<SupplierProductCreate>) => {
      const { data } = await api.patch(`/supplier/products/${productId}`, params, supplierHeaders());
      return data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-products"] }),
  });
}

export function useDeleteSupplierProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await api.delete(`/supplier/products/${productId}`, supplierHeaders());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-products"] }),
  });
}

export function useUploadProductImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, files }: { productId: string; files: File[] }) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const h = supplierHeaders();
      const { data } = await api.post(`/products/${productId}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data", ...h.headers },
      });
      return data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-products"] }),
  });
}

export function useDeleteProductImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, imageId }: { productId: string; imageId: string }) => {
      await api.delete(`/products/${productId}/images/${imageId}`, supplierHeaders());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-products"] }),
  });
}

// ==================== ORDERS ====================

export function useSupplierOrders(params?: { status?: string; skip?: number; limit?: number }) {
  const key = getSupplierApiKey();
  return useQuery<SupplierOrderItem[]>({
    queryKey: ["supplier-orders", params],
    queryFn: async () => {
      const { data } = await api.get("/supplier/orders", { params, ...supplierHeaders() });
      return data;
    },
    enabled: !!key,
    refetchInterval: 30000,
  });
}

export function useAcceptOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      await api.post(`/supplier/orders/${orderId}/items/${itemId}/accept`, {}, supplierHeaders());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-orders"] }),
  });
}

export function useRejectOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, itemId, reason }: { orderId: string; itemId: string; reason: string }) => {
      await api.post(`/supplier/orders/${orderId}/items/${itemId}/reject`, { reason }, supplierHeaders());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplier-orders"] }),
  });
}
