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
}

interface NotificationState {
  isOpen: boolean;
  notifications: Notification[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
}

// Helper to create dates relative to now
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'decision',
    title: 'Decision Required',
    description: 'Decision DEC-004 needs your approval — API authentication strategy',
    timestamp: hoursAgo(0.5),
    read: false,
    actionLabel: 'Review',
    actionHref: '/decisions',
  },
  {
    id: 'n2',
    type: 'completion',
    title: 'Card Completed',
    description: 'FEAT-012 moved to Done by Senior Developer',
    timestamp: hoursAgo(1),
    read: false,
  },
  {
    id: 'n3',
    type: 'agent',
    title: 'Agent Blocked',
    description: 'QA Engineer blocked on missing test data for integration suite',
    timestamp: hoursAgo(2),
    read: false,
    actionLabel: 'Unblock',
  },
  {
    id: 'n4',
    type: 'pr',
    title: 'PR Merged',
    description: 'PR #40 merged to main — feat: add decision voting API',
    timestamp: hoursAgo(3),
    read: false,
  },
  {
    id: 'n5',
    type: 'build',
    title: 'Build Passed',
    description: 'CI pipeline passed for feature/decision-api (4m 23s)',
    timestamp: hoursAgo(4),
    read: true,
  },
  {
    id: 'n6',
    type: 'security',
    title: 'Security Alert',
    description: 'Unusual API usage detected — 3x normal request volume from agent-04',
    timestamp: hoursAgo(5),
    read: false,
    actionLabel: 'Investigate',
  },
  {
    id: 'n7',
    type: 'deploy',
    title: 'Deploy Successful',
    description: 'v0.2.0 deployed to staging environment',
    timestamp: hoursAgo(6),
    read: true,
  },
  {
    id: 'n8',
    type: 'decision',
    title: 'Decision Approved',
    description: 'DEC-003 approved — Database schema migration plan',
    timestamp: hoursAgo(8),
    read: true,
  },
  {
    id: 'n9',
    type: 'completion',
    title: 'Sprint Goal Reached',
    description: '8/10 story points completed in current sprint',
    timestamp: hoursAgo(10),
    read: true,
  },
  {
    id: 'n10',
    type: 'agent',
    title: 'Agent Completed Task',
    description: 'Frontend Developer finished UI component library setup',
    timestamp: daysAgo(1),
    read: true,
  },
  {
    id: 'n11',
    type: 'pr',
    title: 'PR Review Requested',
    description: 'PR #39 needs review — refactor: extract shared utils',
    timestamp: daysAgo(1),
    read: false,
    actionLabel: 'Review',
  },
  {
    id: 'n12',
    type: 'failure',
    title: 'Build Failed',
    description: 'CI pipeline failed for feature/auth-flow — 2 test failures',
    timestamp: daysAgo(1),
    read: true,
    actionLabel: 'View Logs',
  },
  {
    id: 'n13',
    type: 'deploy',
    title: 'Deploy Rolled Back',
    description: 'v0.1.9 rolled back from production — elevated error rate',
    timestamp: daysAgo(2),
    read: true,
  },
  {
    id: 'n14',
    type: 'completion',
    title: 'Milestone Reached',
    description: 'MVP feature set 80% complete — on track for release',
    timestamp: daysAgo(2),
    read: true,
  },
  {
    id: 'n15',
    type: 'security',
    title: 'Dependency Vulnerability',
    description: 'High severity CVE found in lodash@4.17.20 — update available',
    timestamp: daysAgo(3),
    read: true,
    actionLabel: 'Update',
  },
  {
    id: 'n16',
    type: 'agent',
    title: 'Agent Reassigned',
    description: 'DevOps Engineer reassigned from INFRA-005 to INFRA-008',
    timestamp: daysAgo(3),
    read: true,
  },
];

export const useNotificationStore = create<NotificationState>((set, get) => ({
  isOpen: false,
  notifications: mockNotifications,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  markAsRead: (id: string) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
}));

// Selector for unread count (derived)
export const selectUnreadCount = (state: NotificationState) =>
  state.notifications.filter((n) => !n.read).length;
