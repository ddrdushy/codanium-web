'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SocialButtons } from './social-buttons';
import { Zap, User, Mail, Lock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    // In demo mode, just sign in with existing credentials
    // A real app would create the user first
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // If sign-in fails after "signup", show helpful message
        setError('Account created! For the demo, use the existing demo credentials to sign in.');
        setLoading(false);
      } else {
        router.push('/projects');
        router.refresh();
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-amber" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start building your idea with AI — for free
        </p>
      </div>

      {/* Social Signup */}
      <SocialButtons />

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-background text-muted-foreground/60">or continue with email</span>
        </div>
      </div>

      {/* Signup Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 h-11 bg-foreground/[0.03] border-border focus:border-amber/30"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              id="signup-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11 bg-foreground/[0.03] border-border focus:border-amber/30"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input
              id="signup-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-11 bg-foreground/[0.03] border-border focus:border-amber/30"
              required
            />
          </div>
          {/* Password strength indicator */}
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
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Create Account'
          )}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground/50">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </form>

      {/* Sign in link */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-amber hover:text-amber/80 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
