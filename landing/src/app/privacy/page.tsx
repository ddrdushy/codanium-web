'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const sections = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'information-we-collect', title: 'Information We Collect' },
  { id: 'how-we-use', title: 'How We Use Your Information' },
  { id: 'data-storage', title: 'Data Storage & Security' },
  { id: 'third-party', title: 'Third-Party Services' },
  { id: 'your-rights', title: 'Your Rights' },
  { id: 'cookies', title: 'Cookies' },
  { id: 'contact', title: 'Contact Us' },
];

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('introduction');

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
          Privacy Policy
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
          <section id="introduction" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Codanium (by AiSensei), accessible at{' '}
              <Link href="https://codanium.com" className="text-amber hover:underline">
                codanium.com
              </Link>
              , is committed to protecting your privacy. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our AI-powered software
              delivery platform. Please read this policy carefully. By using Codanium, you consent to
              the practices described in this policy.
            </p>
          </section>

          <section id="information-we-collect" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect information that you provide directly and information collected automatically
              when you use our platform.
            </p>
            <h3 className="text-lg font-semibold text-foreground mb-2">Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed mb-4">
              <li>Account registration details (name, email address, password)</li>
              <li>Profile information and preferences</li>
              <li>Project descriptions, requirements, and specifications you submit</li>
              <li>AI-generated code, documents, and artifacts associated with your projects</li>
              <li>Payment and billing information (processed securely via third-party providers)</li>
              <li>Communications with our support team</li>
              <li>API keys you provide for LLM integration (encrypted with AES-256-GCM at rest)</li>
            </ul>
            <h3 className="text-lg font-semibold text-foreground mb-2">Automatically Collected Information</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>Device information (browser type, operating system, device identifiers)</li>
              <li>Usage data (pages visited, features used, session duration)</li>
              <li>IP address and approximate location</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Log data and error reports</li>
            </ul>
          </section>

          <section id="how-we-use" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>To provide, maintain, and improve the Codanium platform and its AI-driven services</li>
              <li>To process your project requests and orchestrate AI agent workflows</li>
              <li>To authenticate your identity and manage your account</li>
              <li>To process payments and manage subscriptions</li>
              <li>To send transactional emails, service updates, and security alerts</li>
              <li>To analyze usage patterns and improve platform performance</li>
              <li>To detect, prevent, and address technical issues and security threats</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section id="data-storage" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Data Storage & Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We take the security of your data seriously and implement appropriate technical and
              organizational measures to protect it.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>All data is transmitted over HTTPS with TLS encryption</li>
              <li>API keys are encrypted at rest using AES-256-GCM</li>
              <li>Passwords are hashed using industry-standard algorithms</li>
              <li>Our infrastructure is hosted on secure, monitored servers with regular backups</li>
              <li>Access to user data is restricted to authorized personnel on a need-to-know basis</li>
              <li>We conduct regular security assessments and vulnerability testing</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              While we strive to protect your personal information, no method of transmission over
              the Internet or electronic storage is 100% secure. We cannot guarantee absolute
              security.
            </p>
          </section>

          <section id="third-party" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Codanium integrates with third-party services to provide its functionality. These may
              include:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong>LLM Providers</strong> — We route AI requests through various providers
                (such as NVIDIA, Mistral, Groq, and others). Your project data may be processed by
                these providers in accordance with their respective privacy policies.
              </li>
              <li>
                <strong>Payment Processors</strong> — Billing is handled by third-party payment
                providers. We do not store your full payment card details on our servers.
              </li>
              <li>
                <strong>Analytics Services</strong> — We may use analytics tools to understand usage
                patterns and improve our platform.
              </li>
              <li>
                <strong>Authentication Providers</strong> — If you sign in with OAuth (e.g., GitHub,
                Google), we receive limited profile information from those providers.
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We encourage you to review the privacy policies of any third-party services you
              interact with through our platform.
            </p>
          </section>

          <section id="your-rights" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your jurisdiction, you may have the following rights regarding your
              personal data:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong>Access</strong> — Request a copy of the personal data we hold about you
              </li>
              <li>
                <strong>Correction</strong> — Request correction of inaccurate or incomplete data
              </li>
              <li>
                <strong>Deletion</strong> — Request deletion of your personal data, subject to legal
                retention requirements
              </li>
              <li>
                <strong>Portability</strong> — Request your data in a portable, machine-readable
                format
              </li>
              <li>
                <strong>Restriction</strong> — Request restriction of processing in certain
                circumstances
              </li>
              <li>
                <strong>Objection</strong> — Object to processing based on legitimate interests
              </li>
              <li>
                <strong>Withdraw Consent</strong> — Withdraw consent at any time where processing is
                based on consent
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:privacy@codanium.com" className="text-amber hover:underline">
                privacy@codanium.com
              </a>
              . We will respond to your request within 30 days.
            </p>
          </section>

          <section id="cookies" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies and similar technologies to enhance your experience, analyze usage, and
              remember your preferences. Essential cookies are required for core platform
              functionality, including authentication and session management.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              For detailed information about the cookies we use and how to manage them, please see
              our{' '}
              <Link href="/cookies" className="text-amber hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          <section id="contact" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have any questions or concerns about this Privacy Policy or our data practices,
              please contact us:
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
