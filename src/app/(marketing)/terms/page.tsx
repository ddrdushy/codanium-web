'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const sections = [
  { id: 'acceptance', title: 'Acceptance of Terms' },
  { id: 'description', title: 'Description of Service' },
  { id: 'accounts', title: 'User Accounts' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'intellectual-property', title: 'Intellectual Property' },
  { id: 'ai-generated-content', title: 'AI-Generated Content' },
  { id: 'payment', title: 'Payment Terms' },
  { id: 'liability', title: 'Limitation of Liability' },
  { id: 'termination', title: 'Termination' },
  { id: 'changes', title: 'Changes to Terms' },
  { id: 'contact', title: 'Contact' },
];

export default function TermsOfServicePage() {
  const [activeSection, setActiveSection] = useState('acceptance');

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
          Terms of Service
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
          <section id="acceptance" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              By accessing or using Codanium (by AiSensei), available at{' '}
              <Link href="https://codanium.com" className="text-amber hover:underline">
                codanium.com
              </Link>
              , including our web platform and desktop application, you agree to be bound by these
              Terms of Service. If you do not agree to these terms, you must not use our services.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              These Terms constitute a legally binding agreement between you and Codanium. We may
              update these Terms from time to time, and your continued use of the platform
              constitutes acceptance of any changes.
            </p>
          </section>

          <section id="description" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Codanium is an AI-powered software delivery platform that orchestrates specialized AI
              agents to handle the full software development lifecycle. Our services include, but are
              not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>AI-driven requirements analysis and business requirements documentation</li>
              <li>Automated architecture design and system design documentation</li>
              <li>AI agent-orchestrated code generation, testing, and deployment</li>
              <li>Project management with automated task creation and tracking</li>
              <li>Desktop application for local development integration</li>
              <li>Bring-your-own-key (BYOK) LLM provider integration</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We reserve the right to modify, suspend, or discontinue any aspect of the service at
              any time with reasonable notice.
            </p>
          </section>

          <section id="accounts" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To use Codanium, you must create an account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>Provide accurate, current, and complete registration information</li>
              <li>Maintain the security of your password and account credentials</li>
              <li>Promptly update your account information if it changes</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You must be at least 18 years old to create an account. We reserve the right to
              suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section id="acceptable-use" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree not to use Codanium to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>Generate malicious software, malware, or code intended to cause harm</li>
              <li>Violate any applicable laws, regulations, or third-party rights</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Interfere with or disrupt the platform&apos;s infrastructure or services</li>
              <li>Use the service to send spam, phishing attempts, or unsolicited communications</li>
              <li>Reverse engineer, decompile, or disassemble any part of the platform</li>
              <li>Use automated tools to scrape or extract data from the platform beyond API usage</li>
              <li>Generate content that is illegal, harmful, or violates third-party rights</li>
            </ul>
          </section>

          <section id="intellectual-property" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Codanium platform, including its design, logos, trademarks, software, and
              documentation, is the intellectual property of AiSensei and is protected by applicable
              intellectual property laws.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You retain ownership of the content, data, and project specifications you provide to
              the platform. By using our service, you grant us a limited, non-exclusive license to
              process your content as necessary to provide our services.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You may not copy, modify, distribute, or create derivative works based on our platform
              without our express written consent.
            </p>
          </section>

          <section id="ai-generated-content" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Codanium uses AI agents to generate code, documentation, and other deliverables.
              Regarding AI-generated content:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong>Ownership</strong> — Subject to your subscription plan, you retain ownership
                of AI-generated outputs created for your projects
              </li>
              <li>
                <strong>No Guarantees</strong> — AI-generated content is provided &quot;as is.&quot;
                While we strive for quality, we do not guarantee that AI outputs are error-free,
                secure, or fit for any particular purpose
              </li>
              <li>
                <strong>Review Responsibility</strong> — You are responsible for reviewing,
                testing, and validating all AI-generated code before deploying it to production
                environments
              </li>
              <li>
                <strong>Third-Party Models</strong> — AI outputs may be processed by third-party LLM
                providers. Each provider&apos;s terms may apply to content processed through their
                services
              </li>
              <li>
                <strong>No Training Use</strong> — We do not use your project data or AI-generated
                outputs to train our own models without your explicit consent
              </li>
            </ul>
          </section>

          <section id="payment" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Payment Terms</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Certain features of Codanium require a paid subscription. By subscribing:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>You agree to pay all fees associated with your chosen plan</li>
              <li>Subscriptions are billed in advance on a recurring basis (monthly or annually)</li>
              <li>
                Prices are subject to change with at least 30 days notice before your next billing
                cycle
              </li>
              <li>
                Refunds are handled on a case-by-case basis. Contact our support team for refund
                requests
              </li>
              <li>
                Failure to pay may result in suspension or termination of your account and access to
                premium features
              </li>
              <li>
                You are responsible for any taxes applicable to your subscription in your
                jurisdiction
              </li>
            </ul>
          </section>

          <section id="liability" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To the fullest extent permitted by law:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                Codanium and its affiliates shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages arising from your use of the platform
              </li>
              <li>
                Our total liability for any claim shall not exceed the amount you paid to us in the
                12 months preceding the claim
              </li>
              <li>
                We are not liable for damages resulting from AI-generated code deployed without
                adequate review and testing
              </li>
              <li>
                We are not responsible for outages, data loss, or service interruptions caused by
                third-party providers
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              The platform is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, either express or implied, including but not limited to
              implied warranties of merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </section>

          <section id="termination" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Termination</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Either party may terminate this agreement at any time:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong>By You</strong> — You may close your account at any time through your
                account settings or by contacting support
              </li>
              <li>
                <strong>By Us</strong> — We may suspend or terminate your account for violations of
                these terms, non-payment, or if required by law
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Upon termination, your right to use the platform ceases immediately. We may retain
              certain data as required by law or for legitimate business purposes. You may request
              export of your project data prior to account closure.
            </p>
          </section>

          <section id="changes" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Material changes
              will be communicated via email or a prominent notice on the platform at least 30 days
              before they take effect. Your continued use of Codanium after changes become effective
              constitutes acceptance of the revised terms. If you do not agree with the updated
              terms, you must stop using the service and close your account.
            </p>
          </section>

          <section id="contact" className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">Contact</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have questions about these Terms of Service, please contact us:
            </p>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-foreground font-medium">Codanium (by AiSensei)</p>
              <p className="text-muted-foreground mt-1">
                Email:{' '}
                <a href="mailto:legal@codanium.com" className="text-amber hover:underline">
                  legal@codanium.com
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
