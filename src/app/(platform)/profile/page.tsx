'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  User, Mail, Shield, Calendar, Palette, Lock,
  Loader2, CheckCircle2, AlertCircle, Zap,
  ArrowLeft, FolderOpen
} from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  plan: string;
  avatarColor: string;
  lastLogin: string | null;
  createdAt: string;
  projectCount: number;
}

const AVATAR_COLORS = [
  '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6',
  '#10b981', '#ec4899', '#f97316', '#06b6d4',
];

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit states
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // Password change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Fetch profile
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setNameValue(data.name);
        }
      } catch (e) {
        console.error('Failed to fetch profile:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSaveName() {
    if (!nameValue.trim() || nameValue.trim().length < 2) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => prev ? { ...prev, name: data.name } : prev);
        setEditingName(false);
        setNameSuccess(true);
        // Update the session so topbar reflects the new name
        await updateSession({ name: data.name });
        setTimeout(() => setNameSuccess(false), 2000);
      }
    } catch (e) {
      console.error('Failed to update name:', e);
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangeColor(color: string) {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarColor: color }),
      });
      if (res.ok) {
        setProfile(prev => prev ? { ...prev, avatarColor: color } : prev);
      }
    } catch (e) {
      console.error('Failed to update color:', e);
    }
  }

  async function handleChangePassword() {
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordSuccess(true);
        setShowPasswordForm(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (e) {
      setPasswordError('Something went wrong');
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Failed to load profile
          </div>
        </div>
      </div>
    );
  }

  const initials = profile.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = new Date(profile.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <Link
                href="/projects"
                className="p-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            </div>

            {/* Avatar + Name Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-[var(--surface)] p-6 mb-6"
            >
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
                  style={{
                    backgroundColor: profile.avatarColor + '20',
                    color: profile.avatarColor,
                    border: `2px solid ${profile.avatarColor}40`,
                  }}
                >
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name */}
                  <div className="flex items-center gap-2 mb-1">
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={nameValue}
                          onChange={(e) => setNameValue(e.target.value)}
                          className="h-8 w-48 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') {
                              setEditingName(false);
                              setNameValue(profile.name);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveName}
                          disabled={savingName}
                          className="h-8 bg-amber text-background hover:bg-amber/90"
                        >
                          {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                        </Button>
                        <button
                          onClick={() => { setEditingName(false); setNameValue(profile.name); }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-lg font-semibold">{profile.name}</h2>
                        <button
                          onClick={() => setEditingName(true)}
                          className="text-xs text-amber hover:text-amber/80 transition-colors"
                        >
                          Edit
                        </button>
                        {nameSuccess && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                      </>
                    )}
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    {profile.email}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 mt-3">
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1"
                    >
                      <Shield className="w-3 h-3" />
                      {profile.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 border-amber/20 text-amber"
                    >
                      <Zap className="w-3 h-3" />
                      {profile.plan}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Avatar Color Picker */}
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2.5">
                  <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Avatar Color</span>
                </div>
                <div className="flex gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => handleChangeColor(color)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        profile.avatarColor === color
                          ? 'ring-2 ring-offset-2 ring-offset-background ring-amber scale-110'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Account Details */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-border bg-[var(--surface)] p-6 mb-6"
            >
              <h3 className="text-sm font-semibold mb-4">Account Details</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    Member Since
                  </div>
                  <span className="text-sm font-medium">{memberSince}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Projects Owned
                  </div>
                  <span className="text-sm font-medium">{profile.projectCount}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-3.5 h-3.5" />
                    Status
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      profile.status === 'ACTIVE'
                        ? 'border-emerald-500/20 text-emerald-500'
                        : 'border-red-500/20 text-red-500'
                    }`}
                  >
                    {profile.status}
                  </Badge>
                </div>
              </div>
            </motion.div>

            {/* Security */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl border border-border bg-[var(--surface)] p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Security</h3>
                {passwordSuccess && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Password changed
                  </div>
                )}
              </div>

              {!showPasswordForm ? (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="flex items-center gap-2 text-sm text-amber hover:text-amber/80 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Change Password
                </button>
              ) : (
                <div className="space-y-3">
                  {passwordError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {passwordError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Current Password</label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-9"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">New Password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-9"
                      placeholder="Min 6 characters"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
                    <Input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="h-9"
                      placeholder="Repeat new password"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={handleChangePassword}
                      disabled={savingPassword || !currentPassword || !newPassword}
                      className="h-9 bg-amber text-background hover:bg-amber/90"
                    >
                      {savingPassword ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Update Password'
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordError('');
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                      }}
                      className="h-9"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
