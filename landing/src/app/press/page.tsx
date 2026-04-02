'use client';

import { motion } from 'framer-motion';
import {
  Newspaper,
  Download,
  Mail,
  Calendar,
  ArrowRight,
  ExternalLink,
  Building2,
  Users,
  Globe,
  Bot,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const pressReleases = [
  {
    date: 'March 15, 2026',
    title: 'Codanium Launches Desktop App for Mac, Windows, and Linux',
    summary: 'The full-featured desktop experience brings file explorer, integrated terminal, and offline project management to developers and teams worldwide.',
  },
  {
    date: 'February 1, 2026',
    title: 'Codanium Raises Seed Round to Scale AI-Powered Software Delivery',
    summary: 'Funding will accelerate enterprise features, expand the AI agent roster, and grow the open-source community around the platform.',
  },
  {
    date: 'January 10, 2026',
    title: 'Codanium Public Beta: 23 AI Agents Now Handle Your Entire SDLC',
    summary: 'From business requirements to deployment, Codanium delivers a full AI development team that works around the clock for a fraction of the cost.',
  },
];

const companyFacts = [
  { icon: Building2, label: 'Founded', value: '2025' },
  { icon: Users, label: 'Team Size', value: '12' },
  { icon: Globe, label: 'Headquarters', value: 'Kuala Lumpur, MY' },
  { icon: Bot, label: 'AI Agents', value: '23' },
];

const brandAssets = [
  {
    title: 'Logo Mark',
    description: 'The Codanium logomark in amber on dark backgrounds. Available in SVG and PNG.',
    icon: Palette,
  },
  {
    title: 'Wordmark',
    description: 'The full "Codanium" wordmark for editorial and marketing use.',
    icon: Palette,
  },
  {
    title: 'Brand Guidelines',
    description: 'Colors, typography, spacing, and usage rules for the Codanium brand.',
    icon: Palette,
  },
];

export default function PressPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-rose-500/5" />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">
              Newsroom
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Press &{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Media
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Resources for journalists, bloggers, and anyone covering Codanium. Download brand assets, read announcements, and get in touch.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main content with sidebar */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-3">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-16">
              {/* Press releases */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="mb-8 text-2xl font-bold text-foreground">Press Releases</h2>
                <div className="space-y-6">
                  {pressReleases.map((release, i) => (
                    <motion.div
                      key={release.title}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="group rounded-xl border border-border bg-[var(--surface)] p-6 card-lift cursor-pointer"
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {release.date}
                      </div>
                      <h3 className="mb-2 text-lg font-semibold text-foreground group-hover:text-amber transition-colors">
                        {release.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{release.summary}</p>
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber group-hover:gap-2.5 transition-all">
                        Read More <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Brand assets */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="mb-8 text-2xl font-bold text-foreground">Brand Assets</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {brandAssets.map((asset, i) => {
                    const Icon = asset.icon;
                    return (
                      <motion.div
                        key={asset.title}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="rounded-xl border border-border bg-[var(--surface)] p-5 text-center"
                      >
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber/10 border border-amber/20">
                          <Icon className="h-5 w-5 text-amber" />
                        </div>
                        <h4 className="mb-1 font-semibold text-foreground text-sm">{asset.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{asset.description}</p>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mt-6">
                  <Button
                    variant="outline"
                    className="font-semibold border-border"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Media Kit
                  </Button>
                </div>
              </motion.div>

              {/* Press contact */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl border border-border bg-[var(--surface)] p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber/10 border border-amber/20">
                    <Mail className="h-6 w-6 text-amber" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Press Inquiries</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      For media inquiries, interview requests, or additional information, please reach out to our communications team.
                    </p>
                    <p className="mt-3 text-sm font-medium text-amber">press@codanium.com</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Company facts */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="rounded-xl border border-border bg-[var(--surface)] p-6"
              >
                <h3 className="mb-6 text-lg font-semibold text-foreground">Company Facts</h3>
                <div className="space-y-5">
                  {companyFacts.map((fact) => {
                    const Icon = fact.icon;
                    return (
                      <div key={fact.label} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">{fact.label}</p>
                          <p className="font-semibold text-foreground">{fact.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* About blurb */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="rounded-xl border border-border bg-[var(--surface)] p-6"
              >
                <h3 className="mb-3 text-lg font-semibold text-foreground">About Codanium</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Codanium is a full-service AI software delivery platform. Users describe what they want built and a team of 23 specialized AI agents handles the entire development lifecycle — from requirements analysis through to deployment.
                </p>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  The platform is open source and available as both a web application and a cross-platform desktop app.
                </p>
              </motion.div>

              {/* Boilerplate */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="rounded-xl border border-amber/20 bg-amber/5 p-6"
              >
                <Newspaper className="mb-3 h-5 w-5 text-amber" />
                <h3 className="mb-2 text-sm font-semibold text-foreground">For Your Story</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our tagline is &quot;Your Vibe, Multiplied.&quot; Feel free to use our logo and screenshots in editorial coverage. Please link back to codanium.com when possible.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
