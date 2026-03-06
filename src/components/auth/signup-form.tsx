'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SocialButtons } from './social-buttons';
import { Zap, User, Mail, Lock, AlertCircle, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showIdeaInput, setShowIdeaInput] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

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

    try {
      // Register the user via API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.status === 409) {
        setError('An account with this email already exists');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Auto sign in after successful registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Account created but sign-in failed. Please go to login.');
        setLoading(false);
      } else {
        setLoading(false);
        setShowOnboarding(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleCreateProject() {
    if (!ideaText.trim()) return;

    setCreatingProject(true);
    try {
      const session = await getSession();
      const ownerId = (session?.user as { id?: string })?.id;

      if (!ownerId) {
        router.push('/projects');
        return;
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My First Project',
          description: ideaText.trim(),
          ownerId,
        }),
      });

      if (res.ok) {
        const project = await res.json();
        router.push(`/projects/${project.id}`);
        router.refresh();
      } else {
        // Fallback to dashboard if project creation fails
        router.push('/projects');
        router.refresh();
      }
    } catch {
      router.push('/projects');
      router.refresh();
    }
  }

  function handleGoToDashboard() {
    router.push('/projects');
    router.refresh();
  }

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;

  return (
    <div className="w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {!showOnboarding ? (
          <motion.div
            key="signup-form"
            initial={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
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
          </motion.div>
        ) : (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="text-center"
          >
            {/* Sparkles icon */}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 200 }}
              className="w-14 h-14 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-6"
            >
              <Sparkles className="w-7 h-7 text-amber" />
            </motion.div>

            {/* Welcome heading with gradient text */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber via-orange-400 to-amber bg-clip-text text-transparent"
            >
              Welcome to AI Team Studio!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="text-sm text-muted-foreground mt-2 mb-8"
            >
              You&apos;re ready to start building. Tell us about your first idea, or jump straight to your dashboard.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="space-y-4"
            >
              <AnimatePresence mode="wait">
                {!showIdeaInput ? (
                  <motion.div
                    key="options"
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <Button
                      onClick={() => setShowIdeaInput(true)}
                      className="w-full h-11 bg-amber text-background hover:bg-amber/90 font-semibold"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Describe my first idea
                    </Button>

                    <button
                      onClick={handleGoToDashboard}
                      className="w-full text-sm text-muted-foreground hover:text-amber transition-colors py-2"
                    >
                      Go to dashboard
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idea-input"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4 text-left"
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor="idea"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        What do you want to build?
                      </label>
                      <Textarea
                        id="idea"
                        placeholder="e.g., I want an app that helps dog walkers find clients in their neighborhood..."
                        value={ideaText}
                        onChange={(e) => setIdeaText(e.target.value)}
                        className="min-h-[100px] bg-foreground/[0.03] border-border focus:border-amber/30 resize-none"
                        rows={4}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleCreateProject}
                        disabled={creatingProject || !ideaText.trim()}
                        className="flex-1 h-11 bg-amber text-background hover:bg-amber/90 font-semibold"
                      >
                        {creatingProject ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Let's Build It"
                        )}
                      </Button>
                      <button
                        onClick={handleGoToDashboard}
                        disabled={creatingProject}
                        className="text-sm text-muted-foreground hover:text-amber transition-colors px-3 disabled:opacity-50"
                      >
                        Skip
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
