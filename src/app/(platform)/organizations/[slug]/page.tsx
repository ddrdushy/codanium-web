'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, FolderOpen, Loader2, ArrowLeft,
  Plus, Trash2, UserPlus, Mail,
} from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

interface OrgMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
  };
}

interface OrgProject {
  id: string;
  name: string;
  status: string;
  color: string;
  completion: number;
}

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  avatarColor: string;
  ownerId: string;
  members: OrgMember[];
  projects: OrgProject[];
  _count: { members: number; projects: number };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function OrgDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadOrg = () => {
    fetch(`/api/organizations/${slug}`)
      .then((r) => r.json())
      .then(setOrg)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadOrg, [slug]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMessage('');
    try {
      const res = await fetch(`/api/organizations/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const result = await res.json();
      if (res.ok) {
        setInviteEmail('');
        setShowInvite(false);
        setInviteMessage(result.message ?? 'Member added');
        loadOrg();
      } else {
        setInviteMessage(result.error ?? 'Failed to invite');
      }
    } catch {
      setInviteMessage('Failed to invite');
    }
    setInviting(false);
    setTimeout(() => setInviteMessage(''), 4000);
  };

  const handleRemove = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await fetch(`/api/organizations/${slug}/members/${memberId}`, {
        method: 'DELETE',
      });
      loadOrg();
    } catch {
      // handle error
    }
    setRemovingId(null);
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    try {
      await fetch(`/api/organizations/${slug}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      loadOrg();
    } catch {
      // handle error
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </main>
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Organization not found</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex items-center gap-4">
              <Link href="/organizations">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div
                className="flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-lg"
                style={{ backgroundColor: org.avatarColor }}
              >
                {org.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
                <p className="text-sm text-muted-foreground">/{org.slug}</p>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
              <div className="glass-card rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Users className="w-4 h-4" /> Members
                </div>
                <p className="text-2xl font-bold text-foreground">{org._count.members}</p>
              </div>
              <div className="glass-card rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FolderOpen className="w-4 h-4" /> Projects
                </div>
                <p className="text-2xl font-bold text-foreground">{org._count.projects}</p>
              </div>
            </motion.div>

            {/* Members */}
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-xl border border-border/50 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" /> Members
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowInvite(true)}
                  className="gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Invite
                </Button>
              </div>

              {inviteMessage && (
                <div className="mb-3 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                  {inviteMessage}
                </div>
              )}

              {showInvite && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="h-9 px-2 rounded-md border border-border bg-background text-sm"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <Button
                      size="sm"
                      onClick={handleInvite}
                      disabled={inviting || !inviteEmail.trim()}
                      className="gap-1.5"
                    >
                      {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Send
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowInvite(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {org.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold"
                        style={{ backgroundColor: member.user.avatarColor }}
                      >
                        {member.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.user.name}</p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === 'OWNER' ? (
                        <Badge className="text-[10px]">Owner</Badge>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="h-7 px-2 rounded border border-border bg-background text-xs"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      )}
                      {member.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemove(member.id)}
                          disabled={removingId === member.id}
                        >
                          {removingId === member.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Projects */}
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-xl border border-border/50 p-6"
            >
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <FolderOpen className="w-4 h-4 text-muted-foreground" /> Projects
              </h3>
              {org.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No projects assigned to this organization yet
                </p>
              ) : (
                <div className="space-y-1">
                  {org.projects.map((project) => (
                    <Link key={project.id} href={`/project/${project.id}`}>
                      <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="text-sm font-medium text-foreground">{project.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {project.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {project.completion}%
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
