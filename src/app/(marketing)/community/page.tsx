'use client';

import { motion } from 'framer-motion';
import {
  Github,
  MessageCircle,
  Twitter,
  Users,
  Star,
  FolderGit2,
  ArrowRight,
  ExternalLink,
  Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const channels = [
  {
    icon: Github,
    title: 'GitHub Discussions',
    description: 'Ask questions, share ideas, and report bugs. Our team monitors discussions daily.',
    cta: 'Open GitHub',
    href: 'https://github.com/ddrdushy/codanium-web/discussions',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    icon: MessageCircle,
    title: 'Discord Server',
    description: 'Chat with other builders in real time. Get help, show off your projects, and hang out.',
    cta: 'Join Discord',
    href: '#',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    icon: Twitter,
    title: 'X / Twitter',
    description: 'Follow us for product updates, tips, and community highlights.',
    cta: 'Follow @codanium',
    href: '#',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
];

const stats = [
  { icon: Users, label: 'Contributors', value: '120+' },
  { icon: Star, label: 'GitHub Stars', value: '2.4k' },
  { icon: FolderGit2, label: 'Projects Built', value: '8,500+' },
];

const featuredProjects = [
  {
    title: 'SaaS Starter Kit',
    author: 'community/alex',
    description: 'A full-featured SaaS boilerplate generated entirely by Codanium agents. Includes auth, billing, and dashboards.',
    tags: ['Next.js', 'Stripe', 'PostgreSQL'],
  },
  {
    title: 'AI Resume Builder',
    author: 'community/priya',
    description: 'Upload your resume and get an optimized version with AI suggestions. Built from a single project brief.',
    tags: ['React', 'GPT-4', 'PDF Export'],
  },
  {
    title: 'Inventory Manager',
    author: 'community/marco',
    description: 'Small business inventory tracker with barcode scanning, low-stock alerts, and reporting.',
    tags: ['Mobile', 'REST API', 'Charts'],
  },
];

export default function CommunityPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-blue-500/5" />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">
              Built together
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Join the{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Community
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Thousands of builders are using Codanium to ship their ideas. Connect, learn, and create with us.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Community channels */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {channels.map((channel, i) => {
              const Icon = channel.icon;
              return (
                <motion.a
                  key={channel.title}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="group rounded-xl border border-border bg-[var(--surface)] p-8 card-lift text-center"
                >
                  <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${channel.bg} border ${channel.border}`}>
                    <Icon className={`h-7 w-7 ${channel.color}`} />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-foreground">{channel.title}</h3>
                  <p className="mb-6 text-sm text-muted-foreground leading-relaxed">{channel.description}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber group-hover:gap-3 transition-all">
                    {channel.cta} <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                </motion.a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-border bg-[var(--surface)] p-8 sm:p-12"
          >
            <div className="grid gap-8 sm:grid-cols-3 text-center">
              {stats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <Icon className="mx-auto mb-3 h-6 w-6 text-amber" />
                    <p className="text-3xl font-extrabold text-foreground sm:text-4xl">{stat.value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured projects */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <h2 className="text-2xl font-bold text-foreground">Featured Community Projects</h2>
            <p className="mt-2 text-muted-foreground">Built with Codanium by members of the community.</p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {featuredProjects.map((project, i) => (
              <motion.div
                key={project.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-xl border border-border bg-[var(--surface)] p-6 card-lift"
              >
                <h3 className="mb-1 text-lg font-semibold text-foreground">{project.title}</h3>
                <p className="mb-3 text-xs text-muted-foreground">by {project.author}</p>
                <p className="mb-4 text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contribute CTA */}
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
              <Heart className="h-7 w-7 text-amber" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Want to Contribute?
            </h2>
            <p className="text-lg text-muted-foreground">
              Codanium is open source. Help us build the future of AI-powered software delivery.
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
                Contribute on GitHub
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>
    </>
  );
}
