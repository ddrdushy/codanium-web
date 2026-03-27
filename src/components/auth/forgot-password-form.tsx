'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, Mail, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-amber" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {sent ? (
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="font-medium">Check your inbox</p>
            <p className="text-sm text-muted-foreground mt-1">
              If an account exists for <span className="text-foreground font-medium">{email}</span>,
              a password reset link has been sent.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-amber hover:text-amber/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
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
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 bg-foreground/[0.03] border-border focus:border-amber/30"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-amber text-background hover:bg-amber/90 font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
          </Button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
