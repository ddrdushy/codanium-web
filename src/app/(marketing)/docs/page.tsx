'use client';

import { motion } from 'framer-motion';
import {
  Search,
  Rocket,
  Bot,
  Code2,
  Monitor,
  Cloud,
  HelpCircle,
  ArrowRight,
  FileText,
  ExternalLink,
  Github,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const categories = [
  {
    icon: Rocket,
    title: 'Getting Started',
    description: 'Create your first project in under 2 minutes. Learn the basics of describing your idea and letting the AI team take over.',
    href: '#',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    icon: Bot,
    title: 'AI Agents Guide',
    description: 'Understand the 23 specialized agents, their roles, and how they collaborate to deliver your software.',
    href: '#',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    icon: Code2,
    title: 'API Reference',
    description: 'Full REST API documentation for integrations, webhooks, and programmatic project management.',
    href: '#',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    icon: Monitor,
    title: 'Desktop App',
    description: 'Install and configure Codanium Desktop for Mac, Windows, and Linux with file explorer and terminal access.',
    href: '#',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
  },
  {
    icon: Cloud,
    title: 'Deployment',
    description: 'Deploy your finished projects to production. Guides for Docker, Vercel, AWS, and self-hosted environments.',
    href: '#',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
  },
  {
    icon: HelpCircle,
    title: 'FAQ',
    description: 'Answers to the most common questions about billing, AI model usage, project limits, and data privacy.',
    href: '#',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20',
  },
];

const popularArticles = [
  { title: 'How to Write a Great Project Brief', category: 'Getting Started', readTime: '3 min' },
  { title: 'Understanding Agent Decision Points', category: 'AI Agents', readTime: '5 min' },
  { title: 'Connecting Your Own LLM Provider', category: 'Configuration', readTime: '4 min' },
  { title: 'Exporting and Deploying Your Code', category: 'Deployment', readTime: '6 min' },
  { title: 'Managing Team Members and Permissions', category: 'Account', readTime: '3 min' },
  { title: 'Desktop App Keyboard Shortcuts', category: 'Desktop App', readTime: '2 min' },
];

export default function DocsPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">
              Learn Codanium
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Documentation
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Everything you need to get the most out of Codanium. From first project to advanced workflows.
            </p>

            {/* Search bar (UI only) */}
            <div className="mx-auto max-w-xl pt-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-[var(--surface)] px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                  readOnly
                />
                <kbd className="hidden rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground sm:inline-block">
                  Ctrl K
                </kbd>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category grid */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <motion.div
                  key={cat.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="group rounded-xl border border-border bg-[var(--surface)] p-6 card-lift cursor-pointer"
                >
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${cat.bg} border ${cat.border}`}>
                    <Icon className={`h-6 w-6 ${cat.color}`} />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground">{cat.title}</h3>
                  <p className="mb-4 text-sm text-muted-foreground leading-relaxed">{cat.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber group-hover:gap-2.5 transition-all">
                    Read More <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular articles */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="mb-8 text-2xl font-bold text-foreground">Popular Articles</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {popularArticles.map((article, i) => (
                <motion.div
                  key={article.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-[var(--surface)] p-4 card-lift cursor-pointer"
                >
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-amber transition-colors" />
                  <div>
                    <h4 className="font-medium text-foreground group-hover:text-amber transition-colors">{article.title}</h4>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{article.category}</span>
                      <span>&middot;</span>
                      <span>{article.readTime} read</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* GitHub CTA */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-[var(--surface)]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 border border-amber/20">
              <Github className="h-7 w-7 text-amber" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Open Source
            </h2>
            <p className="text-lg text-muted-foreground">
              Our documentation is open source. Found a typo or want to contribute a guide? We welcome pull requests.
            </p>
            <a
              href="https://github.com/ddrdushy/codanium-web"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-10 h-13 glow-amber"
              >
                View on GitHub
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
    </>
  );
}
