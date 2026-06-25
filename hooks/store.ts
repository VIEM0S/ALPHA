import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, Product, Customer, Store, User, Tenant, Notification } from '@/lib/types';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  currentStore: Store | null;
  stores: Store[];
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setCurrentStore: (store: Store | null) => void;
  setStores: (stores: Store[]) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      currentStore: null,
      stores: [],
      isLoading: true,
      setUser: (user) => set({ user }),
      setTenant: (tenant) => set({ tenant }),
      setCurrentStore: (store) => set({ currentStore: store }),
      setStores: (stores) => set({ stores }),
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null, tenant: null, currentStore: null, stores: [] }),
    }),
    {
      name: 'erp-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        currentStore: state.currentStore,
        stores: state.stores,
      }),
    }
  )
);

interface CartState {
  items: CartItem[];
  customerId: string | null;
  customer: Customer | null;
  discountPercent: number;
  discountReason: string | null;
  notes: string | null;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  updateItemPrice: (productId: string, price: number) => void;
  clearCart: () => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (percent: number, reason: string | null) => void;
  setNotes: (notes: string | null) => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customerId: null,
      customer: null,
      discountPercent: 0,
      discountReason: null,
      notes: null,

      addItem: (product, quantity = 1) => {
        const items = get().items;
        const existingItem = items.find((item) => item.product.id === product.id);

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.product.id === product.id
                ? {
                    ...item,
                    quantity: item.quantity + quantity,
                    total: (item.quantity + quantity) * item.unitPrice * (1 - item.discount / 100) * (1 + item.tax / 100),
                  }
                : item
            ),
          });
        } else {
          const inventory = product.inventory?.[0];
          const newItem: CartItem = {
            product,
            quantity,
            unitPrice: product.sellingPrice,
            discount: 0,
            tax: product.taxRate,
            total: quantity * product.sellingPrice * (1 + product.taxRate / 100),
          };
          set({ items: [...items, newItem] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((item) => item.product.id !== productId) });
      },

      updateItemQuantity: (productId, quantity) => {
        set({
          items: get().items.map((item) =>
            item.product.id === productId
              ? {
                  ...item,
                  quantity,
                  total: quantity * item.unitPrice * (1 - item.discount / 100) * (1 + item.tax / 100),
                }
              : item
          ),
        });
      },

      updateItemPrice: (productId, price) => {
        set({
          items: get().items.map((item) =>
            item.product.id === productId
              ? {
                  ...item,
                  unitPrice: price,
                  total: item.quantity * price * (1 - item.discount / 100) * (1 + item.tax / 100),
                }
              : item
          ),
        });
      },

      clearCart: () => set({ items: [], customerId: null, customer: null, discountPercent: 0, discountReason: null, notes: null }),

      setCustomer: (customer) => set({ customer, customerId: customer?.id || null }),

      setDiscount: (percent, reason) => set({ discountPercent: percent, discountReason: reason }),

      setNotes: (notes) => set({ notes }),

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100), 0);
      },

      getTax: () => {
        return get().items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100) * (item.tax / 100), 0);
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const tax = get().getTax();
        const discount = subtotal * (get().discountPercent / 100);
        return subtotal + tax - discount;
      },

      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: 'erp-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setNotifications: (notifications: Notification[]) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => {
    set({
      notifications: [notification, ...get().notifications],
      unreadCount: get().notifications.filter((n) => !n.isRead).length + 1,
    });
  },
  markAsRead: (id) => {
    set({
      notifications: get().notifications.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date() } : n)),
      unreadCount: get().notifications.filter((n) => !n.isRead && n.id !== id).length,
    });
  },
  markAllAsRead: () => {
    set({
      notifications: get().notifications.map((n) => ({ ...n, isRead: true, readAt: new Date() })),
      unreadCount: 0,
    });
  },
  setNotifications: (notifications) => {
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    });
  },
  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
}));

interface UIState {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'erp-ui',
    }
  )
);
