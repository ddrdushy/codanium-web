'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Plus, Users, FolderOpen, Loader2, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  avatarColor: string;
  memberCount: number;
  projectCount: number;
  myRole: string;
  createdAt: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadOrgs = () => {
    fetch('/api/organizations')
      .then((r) => r.json())
      .then((data) => setOrgs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadOrgs, []);

  const handleCreate = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      if (res.ok) {
        setNewOrgName('');
        setShowCreate(false);
        loadOrgs();
      }
    } catch {
      // handle error
    }
    setCreating(false);
  };

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
            <motion.div variants={itemVariants} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/projects">
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Teams and project groups
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create Organization
              </Button>
            </motion.div>

            {/* Create form */}
            {showCreate && (
              <motion.div
                variants={itemVariants}
                className="glass-card rounded-xl border border-border/50 p-5"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">New Organization</h3>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Organization name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newOrgName.trim()}
                    size="sm"
                    className="gap-1.5"
                  >
                    {creating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5" />
                    )}
                    Create
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowCreate(false); setNewOrgName(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Organizations Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : orgs.length === 0 ? (
              <motion.div variants={itemVariants} className="text-center py-20">
                <Building2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No organizations yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create an organization to group projects and manage teams
                </p>
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orgs.map((org) => (
                  <Link key={org.id} href={`/organizations/${org.slug}`}>
                    <div className="glass-card rounded-xl border border-border/50 p-5 hover:border-border transition-all cursor-pointer group">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold text-sm"
                          style={{ backgroundColor: org.avatarColor }}
                        >
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {org.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">/{org.slug}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {org.myRole}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {org.memberCount} members
                        </span>
                        <span className="flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" /> {org.projectCount} projects
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
