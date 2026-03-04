'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { mockProjects } from '@/lib/mock-data';
import { mockAdminUsers } from '@/lib/mock-admin-data';
import { Project } from '@/types';
import { Search, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  paused: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  completed: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  archived: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const stageColors: Record<string, string> = {
  'Business Analysis': 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Architecture: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'UI/UX Design': 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  Planning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Development: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Code Review': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  Testing: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Release: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  Monitoring: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  Iteration: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const stats = [
  { label: 'Total Projects', value: 89, color: '#6366f1' },
  { label: 'Active', value: 62, color: '#10b981' },
  { label: 'Completed', value: 15, color: '#3b82f6' },
];

export default function AdminProjectsPage() {
  const [search, setSearch] = useState('');

  const owner = mockAdminUsers[0];

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return mockProjects;
    return mockProjects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Projects</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All projects across the platform
        </p>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-xl border border-border/50 p-4 flex items-center gap-3"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: stat.color + '15' }}
            >
              <FolderOpen className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {stat.label}
              </p>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Search + Table */}
      <motion.div
        className="glass-card rounded-xl border border-border/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {/* Search Bar */}
        <div className="p-4 border-b border-border/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/30 focus:border-[var(--admin-accent)]/50 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Project
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Owner
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Status
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Stage
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Completion
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold text-center">
                Cards
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold text-center">
                Agents
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Created
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map((project, index) => (
              <motion.tr
                key={project.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="border-b border-border/30 transition-colors hover:bg-muted/50"
              >
                {/* Project */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                        {project.description}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Owner */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: owner.avatar_color }}
                    >
                      {owner.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <span className="text-sm text-foreground">{owner.name}</span>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize text-[11px] ${statusColors[project.status]}`}
                  >
                    {project.status}
                  </Badge>
                </TableCell>

                {/* Stage */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${stageColors[project.current_stage] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'}`}
                  >
                    {project.current_stage}
                  </Badge>
                </TableCell>

                {/* Completion */}
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${project.completion}%` }}
                        transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' as const }}
                        style={{
                          backgroundColor:
                            project.completion === 100
                              ? '#10b981'
                              : project.completion >= 60
                                ? '#3b82f6'
                                : project.completion >= 30
                                  ? '#f59e0b'
                                  : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium w-8 text-right">
                      {project.completion}%
                    </span>
                  </div>
                </TableCell>

                {/* Cards */}
                <TableCell className="text-center">
                  <span className="text-sm text-foreground font-medium">
                    {project.card_count}
                  </span>
                </TableCell>

                {/* Agents */}
                <TableCell className="text-center">
                  <span className="text-sm text-foreground font-medium">
                    {project.active_agents}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{project.total_agents}
                  </span>
                </TableCell>

                {/* Created */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(project.created_at)}
                  </span>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>

        {filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FolderOpen className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No projects found</p>
            <p className="text-xs mt-1">Try adjusting your search term</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
