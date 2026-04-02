'use client';

import { motion } from 'framer-motion';
import {
  Search,
  CreditCard,
  Rocket,
  Bot,
  FolderKanban,
  Monitor,
  Wrench,
  ArrowRight,
  ChevronRight,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const categories = [
  {
    icon: CreditCard,
    title: 'Account & Billing',
    description: 'Manage your subscription, update payment methods, and view invoices.',
    articles: 12,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    icon: Rocket,
    title: 'Getting Started',
    description: 'Set up your first project, invite team members, and learn the workflow.',
    articles: 8,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    icon: Bot,
    title: 'AI Agents',
    description: 'Understand agent roles, customize behavior, and troubleshoot responses.',
    articles: 15,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    icon: FolderKanban,
    title: 'Projects',
    description: 'Create, manage, and organize projects. Learn about the SDLC pipeline.',
    articles: 10,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
  },
  {
    icon: Monitor,
    title: 'Desktop App',
    description: 'Install Codanium Desktop, troubleshoot launch issues, and configure settings.',
    articles: 7,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
  },
  {
    icon: Wrench,
    title: 'Troubleshooting',
    description: 'Fix common issues with builds, deployments, agents, and connectivity.',
    articles: 11,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20',
  },
];

const popularQuestions = [
  { question: 'How do I reset my password?', category: 'Account & Billing' },
  { question: 'Why is my AI agent stuck on a task?', category: 'AI Agents' },
  { question: 'How do I export my project code?', category: 'Projects' },
  { question: 'Can I use my own LLM API key?', category: 'AI Agents' },
  { question: 'The Desktop App will not open on macOS', category: 'Desktop App' },
  { question: 'How do I upgrade my plan?', category: 'Account & Billing' },
  { question: 'What happens when an agent makes a mistake?', category: 'AI Agents' },
  { question: 'How do I deploy to my own server?', category: 'Projects' },
];

export default function HelpPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5" />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">
              Support Center
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              How Can We{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Help
              </span>
              ?
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Find answers fast. Browse topics below or search for what you need.
            </p>

            {/* Search bar (UI only) */}
            <div className="mx-auto max-w-xl pt-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-[var(--surface)] px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Describe your issue..."
                  className="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                  readOnly
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
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
                  <h3 className="mb-1 text-lg font-semibold text-foreground">{cat.title}</h3>
                  <p className="mb-3 text-sm text-muted-foreground leading-relaxed">{cat.description}</p>
                  <span className="text-xs text-muted-foreground">{cat.articles} articles</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Questions */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="mb-8 text-2xl font-bold text-foreground">Popular Questions</h2>
            <div className="space-y-3">
              {popularQuestions.map((item, i) => (
                <motion.div
                  key={item.question}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="group flex items-center justify-between rounded-xl border border-border bg-[var(--surface)] px-5 py-4 card-lift cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber transition-colors" />
                    <span className="font-medium text-foreground group-hover:text-amber transition-colors">
                      {item.question}
                    </span>
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:inline-block">{item.category}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact Support CTA */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-[var(--surface)]" />
        <div className="relative mx-auto max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-border bg-[var(--surface)] p-8 sm:p-12 text-center"
          >
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Still Need Help?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Our support team typically responds within a few hours. You can also reach us on Discord for real-time help.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-8 h-13 glow-amber"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
              <Link href="/community">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-semibold text-base px-8 h-13 border-border"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Ask on Discord
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
