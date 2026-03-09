import { create } from "zustand";

export interface GiftItem {
  id: string;
  name: string;
  price: number;
  image: string;
  supplierId: string;
  supplierName: string;
}

interface GiftBoxState {
  items: GiftItem[];
  addItem: (item: GiftItem) => void;
  removeItem: (id: string) => void;
  clearBox: () => void;
  getTotal: () => number;
  getSupplierGroups: () => Record<string, GiftItem[]>;
}

export const useGiftBoxStore = create<GiftBoxState>((set, get) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      if (state.items.find((i) => i.id === item.id)) return state;
      return { items: [...state.items, item] };
    }),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clearBox: () => set({ items: [] }),
  getTotal: () => get().items.reduce((sum, item) => sum + item.price, 0),
  getSupplierGroups: () => {
    const groups: Record<string, GiftItem[]> = {};
    for (const item of get().items) {
      if (!groups[item.supplierName]) groups[item.supplierName] = [];
      groups[item.supplierName].push(item);
    }
    return groups;
  },
}));
