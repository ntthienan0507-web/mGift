import { create } from "zustand";
import type { GiftItem } from "./useGiftBoxStore";

export type PaymentMethod =
  | "vnpay"
  | "momo"
  | "zalopay"
  | "bank_transfer"
  | "cod";

export type OrderStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";

export interface ShippingInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  giftMessage: string;
}

export interface Order {
  id: string;
  items: GiftItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: PaymentMethod | null;
  status: OrderStatus;
  shipping: ShippingInfo;
  createdAt: string;
}

interface OrderState {
  currentOrder: Order | null;
  createOrder: (
    items: GiftItem[],
    shipping: ShippingInfo
  ) => string;
  setPaymentMethod: (method: PaymentMethod) => void;
  setOrderStatus: (status: OrderStatus) => void;
  clearOrder: () => void;
}

function generateOrderId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MG-${date}-${rand}`;
}

export const useOrderStore = create<OrderState>((set) => ({
  currentOrder: null,

  createOrder: (items, shipping) => {
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const shippingFee = 30000;
    const id = generateOrderId();

    const order: Order = {
      id,
      items,
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      paymentMethod: null,
      status: "pending",
      shipping,
      createdAt: new Date().toISOString(),
    };

    set({ currentOrder: order });
    return id;
  },

  setPaymentMethod: (method) =>
    set((state) => ({
      currentOrder: state.currentOrder
        ? { ...state.currentOrder, paymentMethod: method }
        : null,
    })),

  setOrderStatus: (status) =>
    set((state) => ({
      currentOrder: state.currentOrder
        ? { ...state.currentOrder, status }
        : null,
    })),

  clearOrder: () => set({ currentOrder: null }),
}));
