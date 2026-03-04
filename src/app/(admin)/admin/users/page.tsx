'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, MoreHorizontal, Shield, User as UserIcon } from 'lucide-react';
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
import { fetchAdminUsers } from '@/lib/api';
import { mockAdminUsers } from '@/lib/mock-admin-data';
import { AdminUser, UserStatus } from '@/types';

// ─── Status filter tabs ───
type FilterTab = 'all' | UserStatus;

const filterTabs: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Pending', value: 'pending' },
];

// ─── Badge style maps ───
const roleBadgeStyles: Record<string, string> = {
  admin: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  user: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const planBadgeStyles: Record<string, string> = {
  starter: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  pro: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  enterprise: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

const statusBadgeStyles: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/20',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>(mockAdminUsers);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    fetchAdminUsers()
      .then((data) => setUsers(data.users))
      .catch(() => {/* keep mock data */})
      .finally(() => setLoading(false));
  }, []);

  // Count users per status
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

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesTab = activeTab === 'all' || user.status === activeTab;
      const matchesSearch =
        search === '' ||
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [users, search, activeTab]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-border transition-all placeholder:text-muted-foreground/50"
          />
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div variants={itemVariants} className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
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
      </motion.div>

      {/* Users Table */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-4">User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow
                key={user.id}
                className="border-border/30 hover:bg-muted/30 transition-colors"
              >
                {/* User avatar + name + email */}
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                      style={{ backgroundColor: user.avatar_color }}
                    >
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Role badge */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] capitalize ${roleBadgeStyles[user.role] || ''}`}
                  >
                    {user.role === 'admin' && (
                      <Shield className="w-3 h-3 mr-0.5" />
                    )}
                    {user.role}
                  </Badge>
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

                {/* Projects count */}
                <TableCell>
                  <span className="text-sm text-foreground">{user.projects_count}</span>
                </TableCell>

                {/* Status badge */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] capitalize ${statusBadgeStyles[user.status] || ''}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mr-1"
                      style={{
                        backgroundColor:
                          user.status === 'active'
                            ? '#10b981'
                            : user.status === 'suspended'
                            ? '#ef4444'
                            : '#eab308',
                      }}
                    />
                    {user.status}
                  </Badge>
                </TableCell>

                {/* Last login */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatLastLogin(user.last_login)}
                  </span>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right pr-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <UserIcon className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No users found</p>
                    <p className="text-xs text-muted-foreground/60">
                      Try adjusting your search or filter criteria
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
          <p className="text-sm text-muted-foreground">
            Showing{' '}
            <span className="font-medium text-foreground">{filteredUsers.length}</span> of{' '}
            <span className="font-medium text-foreground">{users.length}</span>{' '}
            users
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled className="text-xs">
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled className="text-xs">
              Next
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
