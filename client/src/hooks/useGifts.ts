import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/services/api";

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  supplierId: string;
  supplierName: string;
  category: string;
  tags: string[];
}

export interface OrderStatus {
  orderId: string;
  status: string;
  items: {
    productId: string;
    productName: string;
    supplierName: string;
    status: string;
  }[];
  createdAt: string;
}

export function useProducts(query?: string) {
  return useQuery<Product[]>({
    queryKey: ["products", query],
    queryFn: async () => {
      const { data } = await api.get("/products", { params: { q: query } });
      return data;
    },
    enabled: false,
  });
}

export function useAIRecommend() {
  return useMutation({
    mutationFn: async (message: string) => {
      const { data } = await api.post("/assistant/recommend", { message });
      return data as { reply: string; products: Product[] };
    },
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (items: { productId: string; quantity: number }[]) => {
      const { data } = await api.post("/orders", { items });
      return data as { orderId: string };
    },
  });
}

export function useOrderStatus(orderId: string) {
  return useQuery<OrderStatus>({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}/status`);
      return data;
    },
    enabled: !!orderId,
    refetchInterval: 5000,
  });
}
