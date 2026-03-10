import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";

// ==================== TYPES ====================

export interface AdminStats {
  total_users: number;
  total_shops: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  google_id: string | null;
  created_at: string;
}

export interface AdminShop {
  id: string;
  name: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_active: boolean;
  api_key: string;
  created_at: string;
}

export interface AdminProductImage {
  id: string;
  url: string;
  position: number;
}

export interface AdminProduct {
  id: string;
  shop_id: string;
  shop_name: string | null;
  category_id: string | null;
  category_name: string | null;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  images: AdminProductImage[];
  created_at: string;
}

export interface AdminOrderItem {
  id: string;
  product_id: string;
  product_name: string | null;
  supplier_id: string;
  supplier_name: string | null;
  quantity: number;
  unit_price: number;
  status: string;
  supplier_deadline: string | null;
  reject_reason: string | null;
}

export interface AdminOrder {
  id: string;
  user_id: string;
  user_email: string | null;
  status: string;
  total_amount: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  note: string | null;
  gift_message: string | null;
  shipping_speed: string | null;
  shipping_fee: number;
  estimated_delivery: string | null;
  item_count: number;
  created_at: string;
}

export interface AdminOrderDetail extends AdminOrder {
  items: AdminOrderItem[];
  payment_status: string | null;
  payment_method: string | null;
}

// ==================== STATS ====================

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data } = await api.get("/admin/stats");
      return data;
    },
  });
}

// ==================== USERS ====================

export function useAdminUsers(params?: { skip?: number; limit?: number; search?: string }) {
  return useQuery<AdminUser[]>({
    queryKey: ["admin-users", params],
    queryFn: async () => {
      const { data } = await api.get("/admin/users", { params });
      return data;
    },
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      ...params
    }: { userId: string } & Partial<{ full_name: string; phone: string; is_admin: boolean; email: string }>) => {
      const { data } = await api.patch(`/admin/users/${userId}`, params);
      return data as AdminUser;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

// ==================== SHOPS ====================

export function useAdminShops(params?: { skip?: number; limit?: number }) {
  return useQuery<AdminShop[]>({
    queryKey: ["admin-shops", params],
    queryFn: async () => {
      const { data } = await api.get("/admin/shops", { params });
      return data;
    },
  });
}

export function useUpdateAdminShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      shopId,
      ...params
    }: { shopId: string } & Partial<{ name: string; is_active: boolean }>) => {
      const { data } = await api.patch(`/admin/shops/${shopId}`, params);
      return data as AdminShop;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shops"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

export function useDeleteAdminShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shopId: string) => {
      await api.delete(`/admin/shops/${shopId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shops"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

// ==================== PRODUCTS ====================

export function useAdminProducts(params?: { skip?: number; limit?: number; search?: string; shop_id?: string }) {
  return useQuery<AdminProduct[]>({
    queryKey: ["admin-products", params],
    queryFn: async () => {
      const { data } = await api.get("/admin/products", { params });
      return data;
    },
  });
}

export function useDeleteAdminProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      await api.delete(`/admin/products/${productId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

// ==================== WAREHOUSES ====================

export interface AdminWarehouse {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string;
  latitude: number;
  longitude: number;
  capacity: number;
  processing_hours: number;
  is_active: boolean;
}

export function useWarehouses() {
  return useQuery<AdminWarehouse[]>({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data } = await api.get("/shipping/warehouses");
      return data;
    },
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Omit<AdminWarehouse, "id" | "is_active">) => {
      const { data } = await api.post("/shipping/warehouses", params);
      return data as AdminWarehouse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...params }: { id: string } & Partial<AdminWarehouse>) => {
      const { data } = await api.patch(`/shipping/warehouses/${id}`, params);
      return data as AdminWarehouse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/shipping/warehouses/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warehouses"] }),
  });
}

// ==================== ORDERS ====================

export function useAdminOrders(params?: { skip?: number; limit?: number; status?: string }) {
  return useQuery<AdminOrder[]>({
    queryKey: ["admin-orders", params],
    queryFn: async () => {
      const { data } = await api.get("/admin/orders", { params });
      return data;
    },
  });
}

export function useAdminOrderDetail(orderId: string) {
  return useQuery<AdminOrderDetail>({
    queryKey: ["admin-order", orderId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
  });
}

export function useAdvanceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.post(`/admin/orders/${orderId}/advance`);
      return data as { ok: boolean; previous_status: string; new_status: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-order"] });
    },
  });
}
