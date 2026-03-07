import { create } from 'zustand';

export type NotificationType =
  | 'decision'
  | 'completion'
  | 'pr'
  | 'failure'
  | 'agent'
  | 'deploy'
  | 'security'
  | 'build';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  projectId?: string;
  projectName?: string;
}

interface NotificationState {
  isOpen: boolean;
  notifications: Notification[];
  initialized: boolean;
  loading: boolean;
  unreadCount: number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  addNotification: (notification: Notification) => void;
}

/**
 * Map DB notification (UPPERCASE type + createdAt string) to store format.
 */
function mapDbNotification(n: any): Notification {
  return {
    id: n.id,
    type: (n.type?.toLowerCase() ?? 'agent') as NotificationType,
    title: n.title,
    description: n.description ?? '',
    timestamp: new Date(n.createdAt),
    read: n.read ?? false,
    actionLabel: n.actionLabel ?? undefined,
    actionHref: n.actionHref ?? undefined,
    projectId: n.projectId ?? undefined,
    projectName: n.project?.name ?? undefined,
  };
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  isOpen: false,
  notifications: [],
  initialized: false,
  loading: false,
  unreadCount: 0,

  open: () => {
    set({ isOpen: true });
    // Fetch on first open
    const state = get();
    if (!state.initialized) {
      state.fetchNotifications();
    }
  },
  close: () => set({ isOpen: false }),
  toggle: () => {
    const state = get();
    if (!state.isOpen && !state.initialized) {
      state.fetchNotifications();
    }
    set((s) => ({ isOpen: !s.isOpen }));
  },

  markAsRead: (id: string) => {
    // Optimistic update
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: wasUnread
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    });
    // Persist to API
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch((err) => console.error('[NotificationStore] markAsRead error:', err));
  },

  markAllRead: () => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    // Persist to API
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    }).catch((err) => console.error('[NotificationStore] markAllRead error:', err));
  },

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/notifications?limit=50');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const notifications = (data.notifications ?? []).map(mapDbNotification);
      const unreadCount = data.unreadCount ?? notifications.filter((n: Notification) => !n.read).length;
      set({ notifications, unreadCount, initialized: true, loading: false });
    } catch (err) {
      console.error('[NotificationStore] fetchNotifications error:', err);
      set({ loading: false, initialized: true });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await fetch('/api/notifications?unread=true&limit=1');
      if (!res.ok) return;
      const data = await res.json();
      set({ unreadCount: data.unreadCount ?? 0 });
    } catch {
      // Silent — badge will show 0 until panel is opened
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.read
        ? state.unreadCount
        : state.unreadCount + 1,
    }));
  },
}));

// Selector for unread count (derived from store or pre-fetched count)
export const selectUnreadCount = (state: NotificationState) =>
  state.initialized
    ? state.notifications.filter((n) => !n.read).length
    : state.unreadCount;

// Export mapper for use in SSE hook
export { mapDbNotification };
