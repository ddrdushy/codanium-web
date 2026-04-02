'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const sections = [
  { id: 'what-are-cookies', title: 'What Are Cookies' },
  { id: 'how-we-use', title: 'How We Use Cookies' },
  { id: 'types-of-cookies', title: 'Types of Cookies' },
  { id: 'managing-cookies', title: 'Managing Cookies' },
  { id: 'third-party-cookies', title: 'Third-Party Cookies' },
  { id: 'contact', title: 'Contact Us' },
];

export default function CookiePolicyPage() {
  const [activeSection, setActiveSection] = useState('what-are-cookies');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16"
      >
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Cookie Policy
        </h1>
        <p className="mt-4 text-muted-foreground">
          Last updated: April 1, 2026
        </p>
      </motion.div>

      <div className="flex flex-col gap-12 lg:flex-row">
        {/* Table of Contents */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:w-64 lg:shrink-0"
        >
          <nav className="lg:sticky lg:top-24">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              On This Page
            </h2>
            <ul className="space-y-2 border-l border-border">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={`block border-l-2 py-1 pl-4 text-sm transition-colors ${
                      activeSection === section.id
                        ? 'border-amber text-amber font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </motion.aside>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-3xl flex-1"
        >
          <section id="what-are-cookies" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">What Are Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Cookies are small text files that are stored on your device (computer, tablet, or
              mobile) when you visit a website. They are widely used to make websites work more
              efficiently, provide a better user experience, and supply information to site owners.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This Cookie Policy explains how Codanium (by AiSensei), accessible at{' '}
              <Link href="https://codanium.com" className="text-amber hover:underline">
                codanium.com
              </Link>
              , uses cookies and similar technologies. This policy should be read alongside our{' '}
              <Link href="/privacy" className="text-amber hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section id="how-we-use" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">How We Use Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong>Authentication</strong> — To identify you when you sign in and maintain your
                session across page visits
              </li>
              <li>
                <strong>Security</strong> — To protect your account from unauthorized access and
                detect suspicious activity
              </li>
              <li>
                <strong>Preferences</strong> — To remember your settings, such as theme preference
                and language
              </li>
              <li>
                <strong>Analytics</strong> — To understand how visitors interact with our platform so
                we can improve the experience
              </li>
              <li>
                <strong>Performance</strong> — To monitor platform performance and identify technical
                issues
              </li>
            </ul>
          </section>

          <section id="types-of-cookies" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Types of Cookies</h2>

            {/* Essential */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Essential Cookies
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                These cookies are strictly necessary for the platform to function. They cannot be
                disabled without breaking core functionality.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Cookie</th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Purpose</th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">next-auth.session-token</td>
                      <td className="px-4 py-3 text-muted-foreground">Maintains your authenticated session</td>
                      <td className="px-4 py-3 text-muted-foreground">Session</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">next-auth.csrf-token</td>
                      <td className="px-4 py-3 text-muted-foreground">Prevents cross-site request forgery attacks</td>
                      <td className="px-4 py-3 text-muted-foreground">Session</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">next-auth.callback-url</td>
                      <td className="px-4 py-3 text-muted-foreground">Stores redirect URL after authentication</td>
                      <td className="px-4 py-3 text-muted-foreground">Session</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                Analytics Cookies
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                These cookies help us understand how visitors interact with Codanium by collecting
                anonymized usage data. They help us measure and improve platform performance.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Cookie</th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Purpose</th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">_ga</td>
                      <td className="px-4 py-3 text-muted-foreground">Distinguishes unique users for analytics</td>
                      <td className="px-4 py-3 text-muted-foreground">2 years</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">_ga_*</td>
                      <td className="px-4 py-3 text-muted-foreground">Maintains session state for analytics</td>
                      <td className="px-4 py-3 text-muted-foreground">2 years</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Preferences */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                Preference Cookies
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                These cookies remember your settings and preferences to provide a personalized
                experience across visits.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Cookie</th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Purpose</th>
                      <th className="px-4 py-3 text-left font-medium text-foreground">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">theme</td>
                      <td className="px-4 py-3 text-muted-foreground">Stores your preferred color theme (dark/light)</td>
                      <td className="px-4 py-3 text-muted-foreground">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">locale</td>
                      <td className="px-4 py-3 text-muted-foreground">Stores your language preference</td>
                      <td className="px-4 py-3 text-muted-foreground">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">cookie-consent</td>
                      <td className="px-4 py-3 text-muted-foreground">Records your cookie consent preferences</td>
                      <td className="px-4 py-3 text-muted-foreground">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="managing-cookies" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Managing Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You can control and manage cookies in several ways. Please note that disabling certain
              cookies may affect the functionality of the platform.
            </p>
            <h3 className="text-lg font-semibold text-foreground mb-2">Browser Settings</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Most browsers allow you to view, manage, and delete cookies through their settings.
              Here are links to cookie management instructions for popular browsers:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
              <li>
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber hover:underline"
                >
                  Google Chrome
                </a>
              </li>
              <li>
                <a
                  href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber hover:underline"
                >
                  Mozilla Firefox
                </a>
              </li>
              <li>
                <a
                  href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber hover:underline"
                >
                  Safari
                </a>
              </li>
              <li>
                <a
                  href="https://support.microsoft.com/en-us/microsoft-edge/manage-cookies-in-microsoft-edge-view-allow-block-delete-and-use-168dab11-0753-043d-7c16-ede5947fc64d"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber hover:underline"
                >
                  Microsoft Edge
                </a>
              </li>
            </ul>
            <h3 className="text-lg font-semibold text-foreground mb-2">Opt-Out of Analytics</h3>
            <p className="text-muted-foreground leading-relaxed">
              You can opt out of Google Analytics by installing the{' '}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber hover:underline"
              >
                Google Analytics Opt-out Browser Add-on
              </a>
              . This prevents Google Analytics from collecting data about your visits.
            </p>
          </section>

          <section id="third-party-cookies" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Third-Party Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Some cookies on our platform are set by third-party services that we use. We do not
              control these cookies, and their use is governed by the respective third party&apos;s
              privacy policy.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Third-party services that may set cookies include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong>Google Analytics</strong> — For aggregated usage statistics and platform
                improvement
              </li>
              <li>
                <strong>Authentication Providers</strong> — OAuth providers (GitHub, Google) may set
                cookies during the sign-in process
              </li>
              <li>
                <strong>Payment Processors</strong> — Our payment provider may set cookies to
                facilitate secure transactions
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We regularly review the third-party services we use and their cookie practices to
              ensure they align with our privacy standards.
            </p>
          </section>

          <section id="contact" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have any questions about our use of cookies or this Cookie Policy, please
              contact us:
            </p>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-foreground font-medium">Codanium (by AiSensei)</p>
              <p className="text-muted-foreground mt-1">
                Email:{' '}
                <a href="mailto:privacy@codanium.com" className="text-amber hover:underline">
                  privacy@codanium.com
                </a>
              </p>
              <p className="text-muted-foreground mt-1">
                Website:{' '}
                <Link href="https://codanium.com" className="text-amber hover:underline">
                  codanium.com
                </Link>
              </p>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
