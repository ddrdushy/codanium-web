'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  MoreHorizontal,
  ShieldCheck,
  User as UserIcon,
  CreditCard,
  Ban,
  RefreshCw,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowUpDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { fetchAdminUsers, adminUpdateUser } from '@/lib/api';
import { mockAdminUsers } from '@/lib/mock-admin-data';
import type { AdminUser, UserStatus, UserPlan } from '@/types';

// ─── Constants ───
type FilterTab = 'all' | UserStatus;
const ITEMS_PER_PAGE = 10;

const filterTabs: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Pending', value: 'pending' },
];

// ─── Badge style maps ───
const planBadgeStyles: Record<string, string> = {
  starter: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  pro: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  enterprise: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

const statusDotColors: Record<string, string> = {
  active: '#10b981',
  suspended: '#ef4444',
  pending: '#eab308',
};

const statusTextStyles: Record<string, string> = {
  active: 'text-emerald-500',
  suspended: 'text-red-500',
  pending: 'text-amber-500',
};

// ─── Helpers ───
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatLastLogin(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Animation variants ───
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

// ─── Dialog types ───
type DialogType = 'changePlan' | 'suspend' | 'unsuspend' | 'changeRole' | 'resetPassword' | null;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>(mockAdminUsers);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isLiveData, setIsLiveData] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog state
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<UserPlan>('starter');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetch data ───
  useEffect(() => {
    fetchAdminUsers()
      .then((data) => { setUsers(data.users); setIsLiveData(true); })
      .catch(() => {
        /* keep mock data */
      })
      .finally(() => setLoading(false));
  }, []);

  // ─── Debounced search ───
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 300);
  }, []);

  // ─── Count users per status ───
  const statusCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: users.length,
      active: 0,
      suspended: 0,
      pending: 0,
    };
    users.forEach((user) => {
      counts[user.status] = (counts[user.status] || 0) + 1;
    });
    return counts;
  }, [users]);

  // ─── Filtered users ───
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesTab = activeTab === 'all' || user.status === activeTab;
      const matchesPlan = planFilter === 'all' || user.plan === planFilter;
      const matchesSearch =
        debouncedSearch === '' ||
        user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesTab && matchesPlan && matchesSearch;
    });
  }, [users, debouncedSearch, activeTab, planFilter]);

  // ─── Pagination ───
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // ─── Reset page when filters change ───
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, planFilter]);

  // ─── Dialog actions ───
  const openDialog = (type: DialogType, user: AdminUser) => {
    setSelectedUser(user);
    setDialogType(type);
    setSelectedPlan(user.plan);
    setSuccessMessage(null);
  };

  const closeDialog = () => {
    setDialogType(null);
    setSelectedUser(null);
    setSuccessMessage(null);
  };

  const handleAction = async () => {
    if (!selectedUser || !dialogType) return;
    setDialogLoading(true);

    try {
      let action: 'suspend' | 'unsuspend' | 'changeRole' | 'changePlan' | 'resetPassword';
      let value: string | undefined;

      switch (dialogType) {
        case 'changePlan':
          action = 'changePlan';
          value = selectedPlan;
          break;
        case 'suspend':
          action = 'suspend';
          break;
        case 'unsuspend':
          action = 'unsuspend';
          break;
        case 'changeRole':
          action = 'changeRole';
          value = selectedUser.role === 'admin' ? 'user' : 'admin';
          break;
        case 'resetPassword':
          action = 'resetPassword';
          break;
        default:
          return;
      }

      await adminUpdateUser({ userId: selectedUser.id, action, value }).catch(() => {
        // Optimistic update on API failure
      });

      // Update local state optimistically
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== selectedUser.id) return u;
          switch (dialogType) {
            case 'changePlan':
              return { ...u, plan: selectedPlan };
            case 'suspend':
              return { ...u, status: 'suspended' as const };
            case 'unsuspend':
              return { ...u, status: 'active' as const };
            case 'changeRole':
              return { ...u, role: u.role === 'admin' ? ('user' as const) : ('admin' as const) };
            default:
              return u;
          }
        })
      );

      const messages: Record<string, string> = {
        changePlan: `Plan changed to ${selectedPlan}`,
        suspend: 'Account suspended',
        unsuspend: 'Account reactivated',
        changeRole: `Role changed to ${selectedUser.role === 'admin' ? 'user' : 'admin'}`,
        resetPassword: 'Password reset email sent',
      };
      setSuccessMessage(messages[dialogType] || 'Action completed');

      setTimeout(() => {
        closeDialog();
      }, 1500);
    } finally {
      setDialogLoading(false);
    }
  };

  // ─── Dialog content renderer ───
  const renderDialogContent = () => {
    if (!selectedUser || !dialogType) return null;

    if (successMessage) {
      return (
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </motion.div>
            <p className="text-base font-semibold text-foreground">{successMessage}</p>
            <p className="text-sm text-muted-foreground">for {selectedUser.name}</p>
          </div>
        </DialogContent>
      );
    }

    switch (dialogType) {
      case 'changePlan':
        return (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change Plan</DialogTitle>
              <DialogDescription>
                Change the subscription plan for {selectedUser.name} ({selectedUser.email}).
                Currently on <span className="capitalize font-medium">{selectedUser.plan}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as UserPlan)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter - $19/mo</SelectItem>
                  <SelectItem value="pro">Pro - $49/mo</SelectItem>
                  <SelectItem value="enterprise">Enterprise - $299/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={dialogLoading || selectedPlan === selectedUser.plan}
                className="bg-[#0d9488] hover:bg-[#0d9488]/90 text-white"
              >
                {dialogLoading ? 'Updating...' : 'Change Plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        );

      case 'suspend':
        return (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Suspend Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to suspend {selectedUser.name}&apos;s account? They will lose
                access to all projects and agents immediately.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleAction}
                disabled={dialogLoading}
              >
                {dialogLoading ? 'Suspending...' : 'Suspend Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        );

      case 'unsuspend':
        return (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reactivate Account</DialogTitle>
              <DialogDescription>
                Reactivate {selectedUser.name}&apos;s account? They will regain access to their
                projects and agents.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={dialogLoading}
                className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
              >
                {dialogLoading ? 'Reactivating...' : 'Reactivate Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        );

      case 'changeRole':
        return (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedUser.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
              </DialogTitle>
              <DialogDescription>
                {selectedUser.role === 'admin'
                  ? `Remove admin privileges from ${selectedUser.name}? They will no longer have access to admin settings.`
                  : `Grant admin privileges to ${selectedUser.name}? They will have full access to admin settings, user management, and billing.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={dialogLoading}
                className="bg-[#0d9488] hover:bg-[#0d9488]/90 text-white"
              >
                {dialogLoading
                  ? 'Updating...'
                  : selectedUser.role === 'admin'
                  ? 'Demote to User'
                  : 'Promote to Admin'}
              </Button>
            </DialogFooter>
          </DialogContent>
        );

      case 'resetPassword':
        return (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Send a password reset email to {selectedUser.email}? The user will receive a link to
                set a new password.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={dialogLoading}
                className="bg-[#0d9488] hover:bg-[#0d9488]/90 text-white"
              >
                {dialogLoading ? 'Sending...' : 'Send Reset Email'}
              </Button>
            </DialogFooter>
          </DialogContent>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Customer Management</h1>
          {!isLiveData && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
              Demo Data
            </span>
          )}
          <Badge
            variant="outline"
            className="bg-[#0d9488]/10 text-[#0d9488] border-[#0d9488]/20 text-xs font-semibold"
          >
            {users.length} total
          </Badge>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        {/* Status tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`
                px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
                ${
                  activeTab === tab.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {tab.label}
              <span className="ml-1.5 text-xs text-muted-foreground/70">
                {statusCounts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Plan filter */}
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488]/50 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Users Table */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-5 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                User
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                <div className="flex items-center gap-1">
                  Plan
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Status
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Projects
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Last Login
              </TableHead>
              <TableHead className="text-right pr-5 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.map((user, index) => (
              <motion.tr
                key={user.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="border-b border-border/30 transition-colors hover:bg-muted/30 group"
              >
                {/* User avatar + name + email */}
                <TableCell className="pl-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 ring-2 ring-background shadow-sm"
                      style={{ backgroundColor: user.avatar_color }}
                    >
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.name}
                        </p>
                        {user.role === 'admin' && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#0d9488] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                </TableCell>

                {/* Plan badge */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] capitalize ${planBadgeStyles[user.plan] || ''}`}
                  >
                    {user.plan}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: statusDotColors[user.status] }}
                    />
                    <span className={`text-sm capitalize ${statusTextStyles[user.status]}`}>
                      {user.status}
                    </span>
                  </div>
                </TableCell>

                {/* Projects count */}
                <TableCell>
                  <span className="text-sm text-foreground font-medium">{user.projects_count}</span>
                </TableCell>

                {/* Last login */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatLastLogin(user.last_login)}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right pr-5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Manage User
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openDialog('changePlan', user)}>
                        <CreditCard className="w-4 h-4" />
                        Change Plan
                      </DropdownMenuItem>
                      {user.status === 'suspended' ? (
                        <DropdownMenuItem onClick={() => openDialog('unsuspend', user)}>
                          <RefreshCw className="w-4 h-4" />
                          Reactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => openDialog('suspend', user)}
                          variant="destructive"
                        >
                          <Ban className="w-4 h-4" />
                          Suspend
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => openDialog('changeRole', user)}>
                        <ShieldCheck className="w-4 h-4" />
                        {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openDialog('resetPassword', user)}>
                        <KeyRound className="w-4 h-4" />
                        Reset Password
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}

            {paginatedUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
                      <UserIcon className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No users found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Try adjusting your search or filter criteria
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/30 bg-muted/20">
          <p className="text-sm text-muted-foreground">
            Showing{' '}
            <span className="font-medium text-foreground">
              {filteredUsers.length === 0
                ? 0
                : (currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>
            {' '}-{' '}
            <span className="font-medium text-foreground">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)}
            </span>{' '}
            of{' '}
            <span className="font-medium text-foreground">{filteredUsers.length}</span> users
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="text-xs h-8"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="text-xs h-8"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Action Dialogs */}
      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && closeDialog()}>
        {renderDialogContent()}
      </Dialog>
    </motion.div>
  );
}
