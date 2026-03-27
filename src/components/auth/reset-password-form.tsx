'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

function ResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing reset token. Please request a new link.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p className="font-medium">Invalid reset link</p>
          <p className="text-sm text-muted-foreground mt-1">
            This link is missing a reset token. Please request a new one.
          </p>
        </div>
        <Link href="/forgot-password" className="text-sm text-amber hover:text-amber/80 transition-colors">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-amber" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a strong password for your account
        </p>
      </div>

      {success ? (
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="font-medium">Password updated</p>
            <p className="text-sm text-muted-foreground mt-1">
              Redirecting you to sign in...
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 bg-foreground/[0.03] border-border focus:border-amber/30"
                required
              />
            </div>
            {password.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map(level => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        passwordStrength >= level
                          ? level === 1 ? 'bg-red-500' : level === 2 ? 'bg-amber' : 'bg-emerald-500'
                          : 'bg-foreground/[0.06]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground/60">
                  {passwordStrength === 1 ? 'Weak' : passwordStrength === 2 ? 'Good' : 'Strong'}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-11 bg-foreground/[0.03] border-border focus:border-amber/30"
                required
              />
              {confirmPassword.length > 0 && password === confirmPassword && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-amber text-background hover:bg-amber/90 font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>
        </form>
      )}
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<div className="w-full max-w-md mx-auto text-center text-muted-foreground text-sm">Loading...</div>}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
