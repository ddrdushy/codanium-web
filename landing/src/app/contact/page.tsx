'use client';

import { motion } from 'framer-motion';
import {
  Mail,
  Github,
  MessageCircle,
  Send,
  ChevronDown,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const subjects = [
  'General Inquiry',
  'Enterprise Sales',
  'Partnership',
  'Technical Support',
  'Bug Report',
  'Feature Request',
];

const contactChannels = [
  {
    icon: Mail,
    label: 'Email',
    value: 'hello@codanium.com',
    href: 'mailto:hello@codanium.com',
    description: 'Drop us a line anytime. We typically respond within 24 hours.',
  },
  {
    icon: Github,
    label: 'GitHub',
    value: 'github.com/AiSenseiMY/Codanium',
    href: 'https://github.com/AiSenseiMY/Codanium',
    description: 'Open an issue, submit a PR, or explore our codebase.',
  },
  {
    icon: MessageCircle,
    label: 'Community',
    value: 'Join our Discord',
    href: '#',
    description: 'Chat with the team and other builders in real time.',
  },
];

export default function ContactPage() {
  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
        <div className="grid-pattern absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-sm font-semibold uppercase tracking-widest text-amber"
          >
            Contact Us
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Get in{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              Touch
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground"
          >
            Have a question, partnership idea, or just want to say hi? We&apos;d love
            to hear from you.
          </motion.p>
        </div>
      </section>

      {/* ─── Form + Sidebar ─── */}
      <section className="relative py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
            {/* ── Contact Form ── */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-3"
            >
              <div className="rounded-2xl border border-border bg-[var(--surface)] p-8 sm:p-10 backdrop-blur-sm">
                <h2 className="text-2xl font-bold text-foreground">
                  Send us a message
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Fill out the form below and we&apos;ll get back to you as soon as
                  possible.
                </p>

                <div className="mt-8 space-y-6">
                  {/* Name + Email row */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="name"
                        className="mb-2 block text-sm font-medium text-foreground"
                      >
                        Name
                      </label>
                      <input
                        id="name"
                        type="text"
                        placeholder="Your full name"
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-medium text-foreground"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label
                      htmlFor="subject"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Subject
                    </label>
                    <div className="relative">
                      <select
                        id="subject"
                        defaultValue=""
                        className="w-full appearance-none rounded-lg border border-border bg-background px-4 py-3 pr-10 text-sm text-foreground focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
                      >
                        <option value="" disabled>
                          Select a topic
                        </option>
                        {subjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      placeholder="Tell us what you need..."
                      className="w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber transition-colors"
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    size="lg"
                    className="bg-amber text-background hover:bg-amber/90 font-semibold w-full sm:w-auto px-10 h-12 glow-amber"
                  >
                    Send Message
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* ── Sidebar ── */}
            <div className="space-y-6 lg:col-span-2">
              {contactChannels.map((channel, i) => (
                <motion.a
                  key={channel.label}
                  href={channel.href}
                  target={channel.href.startsWith('http') ? '_blank' : undefined}
                  rel={
                    channel.href.startsWith('http')
                      ? 'noopener noreferrer'
                      : undefined
                  }
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  className="group block rounded-xl border border-border bg-[var(--surface)] p-6 transition-all hover:border-amber/40 hover:shadow-lg hover:shadow-amber/5 card-lift"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber/10 border border-amber/20 text-amber">
                      <channel.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        {channel.label}
                      </p>
                      <p className="mt-1 text-base font-semibold text-foreground group-hover:text-amber transition-colors truncate">
                        {channel.value}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {channel.description}
                      </p>
                    </div>
                  </div>
                </motion.a>
              ))}

              {/* Extra info card */}
              <motion.div
                custom={contactChannels.length}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-xl border border-border bg-[var(--surface)] p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber/10 border border-amber/20 text-amber">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Location
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      Remote-first
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      Our team works across multiple time zones. We&apos;re everywhere
                      our builders are.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Prefer to dive straight in?
            </h2>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              Skip the form and start building with Codanium right away. Your first
              project is free.
            </p>
            <div className="pt-2">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-10 h-13 glow-amber"
                >
                  Start Your Project Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
