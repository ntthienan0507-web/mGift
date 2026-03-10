import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";

// ==================== TYPES ====================

export interface ProductImage {
  id: string;
  url: string;
  position: number;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  metadata_info: Record<string, unknown> | null;
  category_name: string | null;
  images: ProductImage[];
  avg_rating: number | null;
  review_count: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  product_image: string | null;
  quantity: number;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  total_amount: number;
  total_items: number;
  unique_suppliers: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  status: string;
  supplier_deadline: string | null;
  reject_reason: string | null;
  replaced_by_item_id: string | null;
}

export interface Order {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  note: string | null;
  cancel_reason: string | null;
  gift_message: string | null;
  gift_card_template: string | null;
  gift_wrapping: boolean;
  shipping_speed: string | null;
  shipping_fee: number;
  estimated_delivery: string | null;
  items: OrderItem[];
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: string;
  status: string;
  amount: number;
  transaction_id: string | null;
  payment_url: string | null;
  paid_at: string | null;
  metadata_info: Record<string, unknown> | null;
  created_at: string;
}

export interface Shop {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

// ==================== PRODUCTS ====================

export function useProducts(params?: {
  shop_id?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  sort_by?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery<Product[]>({
    queryKey: ["products", params],
    queryFn: async () => {
      const { data } = await api.get("/products/", { params });
      return data;
    },
  });
}

export function useProduct(productId: string) {
  return useQuery<Product>({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/${productId}`);
      return data;
    },
    enabled: !!productId,
  });
}

// ==================== CATEGORIES ====================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  icon_url: string | null;
  created_at: string;
  children?: Category[];
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories/");
      return data;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string | null;
      parent_id?: string | null;
      icon_url?: string | null;
    }) => {
      const { data } = await api.post("/categories/", params);
      return data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryId,
      ...params
    }: {
      categoryId: string;
      name?: string;
      description?: string | null;
      parent_id?: string | null;
      icon_url?: string | null;
    }) => {
      const { data } = await api.patch(`/categories/${categoryId}`, params);
      return data as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryId: string) => {
      await api.delete(`/categories/${categoryId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

// ==================== SHOPS ====================

export function useShops() {
  return useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: async () => {
      const { data } = await api.get("/shops/");
      return data;
    },
  });
}

// ==================== AI ====================

export function useAISearch() {
  return useMutation({
    mutationFn: async (query: string) => {
      const { data } = await api.post("/ai/search", { query, limit: 8 });
      return data as Product[];
    },
  });
}

export function useAIRecommend() {
  return useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post("/ai/recommend", { message });
      return data as { reply: string; products: Product[]; suggested_shipping_speed: string };
    },
  });
}

// ==================== SHIPPING OPTIONS ====================

export interface ShippingOption {
  speed: string;
  label: string;
  description: string;
  shipping_fee: number;
  estimated_days: number;
  estimated_text: string;
}

export function useShippingOptions() {
  return useMutation({
    mutationFn: async (params: { product_ids: string[]; user_city?: string }) => {
      const { data } = await api.post("/shipping/options", params);
      return data as ShippingOption[];
    },
  });
}

// ==================== CART ====================

export function useCart() {
  return useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data } = await api.get("/cart/");
      return data;
    },
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { product_id: string; quantity?: number }) => {
      const { data } = await api.post("/cart/", params);
      return data as Cart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const { data } = await api.patch(`/cart/${itemId}`, { quantity });
      return data as Cart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await api.delete(`/cart/${itemId}`);
      return data as Cart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete("/cart/");
      return data as Cart;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart"] }),
  });
}

export function useCartCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      address_id?: string;
      recipient_name?: string;
      recipient_phone?: string;
      recipient_address?: string;
      note?: string;
      gift_message?: string;
      gift_wrapping?: boolean;
      shipping_speed?: string;
    }) => {
      const { data } = await api.post("/cart/checkout", params);
      return data as Order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

// ==================== ORDERS ====================

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data } = await api.get("/orders/");
      return data;
    },
  });
}

export function useOrder(orderId: string) {
  return useQuery<Order>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}`);
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 10000, // Poll mỗi 10s
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason?: string }) => {
      const { data } = await api.post(`/orders/${orderId}/cancel`, { reason });
      return data as Order;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

// ==================== PAYMENTS ====================

export function useCreatePayment() {
  return useMutation({
    mutationFn: async (params: { order_id: string; method: string }) => {
      const { data } = await api.post("/payments/", params);
      return data as Payment;
    },
  });
}

export function usePayment(paymentId: string) {
  return useQuery<Payment>({
    queryKey: ["payment", paymentId],
    queryFn: async () => {
      const { data } = await api.get(`/payments/${paymentId}`);
      return data;
    },
    enabled: !!paymentId,
    refetchInterval: 5000, // Poll mỗi 5s để check status
  });
}

export function usePaymentByOrder(orderId: string) {
  return useQuery<Payment>({
    queryKey: ["payment-order", orderId],
    queryFn: async () => {
      const { data } = await api.get(`/payments/order/${orderId}`);
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 5000,
  });
}
