'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COOKIE_CONSENT_KEY = 'codanium-cookie-consent';

type ConsentLevel = 'all' | 'essential' | null;

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [preferences, setPreferences] = useState(true);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay showing the banner slightly for better UX
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ level: 'all', date: new Date().toISOString() }));
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ level: 'essential', date: new Date().toISOString() }));
    setVisible(false);
  };

  const handleSavePreferences = () => {
    const level = analytics && preferences ? 'all' : 'essential';
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({
        level,
        analytics,
        preferences: preferences,
        date: new Date().toISOString(),
      })
    );
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6"
        >
          <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-[var(--surface)] shadow-2xl shadow-black/20 overflow-hidden">
            {/* Main banner */}
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/10 border border-amber/20">
                  <Cookie className="h-5 w-5 text-amber" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    We use cookies
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use cookies to enhance your experience, analyze site traffic, and personalize content.
                    Read our{' '}
                    <Link href="/cookies" className="text-amber hover:underline">
                      Cookie Policy
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-amber hover:underline">
                      Privacy Policy
                    </Link>{' '}
                    for more details.
                  </p>
                </div>
                <button
                  onClick={handleEssentialOnly}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                  aria-label="Dismiss"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Actions */}
              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-[var(--surface-raised)]"
                >
                  <Settings2 className="h-4 w-4" />
                  Customize
                </button>
                <Button
                  variant="outline"
                  onClick={handleEssentialOnly}
                  className="font-medium"
                >
                  Essential Only
                </Button>
                <Button
                  onClick={handleAcceptAll}
                  className="bg-amber text-background hover:bg-amber/90 font-semibold"
                >
                  Accept All
                </Button>
              </div>
            </div>

            {/* Preferences panel */}
            <AnimatePresence>
              {showPreferences && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-5 sm:px-6 py-5 bg-[var(--surface-raised)]">
                    <div className="space-y-4">
                      {/* Essential */}
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Essential Cookies</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Required for the site to function. Cannot be disabled.
                          </p>
                        </div>
                        <div className="relative h-6 w-11 shrink-0">
                          <div className="h-full w-full rounded-full bg-amber cursor-not-allowed">
                            <div className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Analytics */}
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Analytics Cookies</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Help us understand how visitors interact with the site.
                          </p>
                        </div>
                        <button
                          onClick={() => setAnalytics(!analytics)}
                          className="relative h-6 w-11 shrink-0 cursor-pointer"
                          role="switch"
                          aria-checked={analytics}
                        >
                          <div className={`h-full w-full rounded-full transition-colors ${analytics ? 'bg-amber' : 'bg-[var(--surface-overlay)]'}`}>
                            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${analytics ? 'right-0.5' : 'left-0.5'}`} />
                          </div>
                        </button>
                      </div>

                      {/* Preferences */}
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Preference Cookies</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Remember your settings and personalize your experience.
                          </p>
                        </div>
                        <button
                          onClick={() => setPreferences(!preferences)}
                          className="relative h-6 w-11 shrink-0 cursor-pointer"
                          role="switch"
                          aria-checked={preferences}
                        >
                          <div className={`h-full w-full rounded-full transition-colors ${preferences ? 'bg-amber' : 'bg-[var(--surface-overlay)]'}`}>
                            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${preferences ? 'right-0.5' : 'left-0.5'}`} />
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 flex justify-end">
                      <Button
                        onClick={handleSavePreferences}
                        className="bg-amber text-background hover:bg-amber/90 font-semibold"
                      >
                        Save Preferences
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
