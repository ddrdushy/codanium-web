'use client';

import { useEffect, useState } from 'react';
import { Download, Monitor, Apple, Terminal, CheckCircle2, Zap, GitBranch, Code2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REPO = 'AiSenseiMY/Codanium';

interface ReleaseInfo {
  tag: string;        // e.g. "v0.1.0"
  version: string;    // e.g. "0.1.0"
  baseUrl: string;    // e.g. "https://github.com/.../releases/download/v0.1.0"
  assets: string[];   // list of asset filenames
}

function buildPlatforms(v: string) {
  return [
    {
      name: 'macOS',
      icon: Apple,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
      downloads: [
        { label: 'Apple Silicon (M1/M2/M3)', file: `Codanium_${v}_aarch64.dmg`, badge: 'ARM64' },
        { label: 'Intel Mac', file: `Codanium_${v}_x64.dmg`, badge: 'x64' },
      ],
    },
    {
      name: 'Windows',
      icon: Monitor,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/20',
      downloads: [
        { label: 'Windows Installer (.msi)', file: `Codanium_${v}_x64_en-US.msi`, badge: 'x64' },
        { label: 'Windows Setup (.exe)', file: `Codanium_${v}_x64-setup.exe`, badge: 'x64' },
      ],
    },
    {
      name: 'Linux',
      icon: Terminal,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      downloads: [
        { label: 'Debian / Ubuntu (.deb)', file: `Codanium_${v}_amd64.deb`, badge: 'x64' },
        { label: 'AppImage (Universal)', file: `Codanium_${v}_amd64.AppImage`, badge: 'x64' },
        { label: 'RPM Package', file: `Codanium-${v}-1.x86_64.rpm`, badge: 'x64' },
      ],
    },
  ];
}

const features = [
  { icon: Code2, text: 'Built-in code editor with syntax highlighting' },
  { icon: Terminal, text: 'Integrated terminal — run builds, git, npm' },
  { icon: GitBranch, text: 'Git integration — view diffs, commit, push' },
  { icon: Zap, text: 'Live agent status — watch AI team work in real time' },
];

export function DownloadSection() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    // Fetch latest release from GitHub API (cached by browser, lightweight)
    fetch(`https://api.github.com/repos/${REPO}/releases`)
      .then((r) => r.json())
      .then((releases) => {
        if (!Array.isArray(releases) || releases.length === 0) return;
        // Find the first non-draft, non-prerelease release (or fall back to first)
        const latest = releases.find((r: any) => !r.draft) || releases[0];
        const tag = latest.tag_name || 'v0.1.0';
        const version = tag.replace(/^v/, '');
        setRelease({
          tag,
          version,
          baseUrl: `https://github.com/${REPO}/releases/download/${tag}`,
          assets: (latest.assets || []).map((a: any) => a.name),
        });
      })
      .catch(() => {
        // Fallback to hardcoded v0.1.0
        setRelease({
          tag: 'v0.1.0',
          version: '0.1.0',
          baseUrl: `https://github.com/${REPO}/releases/download/v0.1.0`,
          assets: [],
        });
      });
  }, []);

  const version = release?.version || '0.1.0';
  const baseUrl = release?.baseUrl || `https://github.com/${REPO}/releases/download/v0.1.0`;
  const platforms = buildPlatforms(version);

  return (
    <section id="download" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber/3 to-transparent" />
      <div className="relative mx-auto max-w-7xl px-6">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber/20 bg-amber/5 px-4 py-1.5 text-sm font-medium text-amber mb-4">
            <Download className="h-3.5 w-3.5" />
            Codanium Desktop {release ? `v${version}` : <Loader2 className="h-3 w-3 animate-spin" />}
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl mt-4">
            Your IDE.{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Powered by AI.
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Download Codanium Desktop — a cross-platform IDE built for working alongside your AI team.
            No VS Code extension needed.
          </p>
        </div>

        {/* Features strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {features.map((f) => (
            <div key={f.text} className="flex items-start gap-3 rounded-xl border border-border bg-[var(--surface)] p-4">
              <f.icon className="h-4 w-4 text-amber mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground leading-snug">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Platform cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {platforms.map((platform) => (
            <div
              key={platform.name}
              className="rounded-2xl border border-border bg-[var(--surface)] p-6"
            >
              {/* Platform header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${platform.bg} border ${platform.border}`}>
                  <platform.icon className={`h-5 w-5 ${platform.color}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{platform.name}</h3>
                  <p className="text-xs text-muted-foreground">{platform.downloads.length} packages available</p>
                </div>
              </div>

              {/* Download buttons */}
              <div className="space-y-3">
                {platform.downloads.map((dl) => (
                  <a
                    key={dl.file}
                    href={`${baseUrl}/${dl.file}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-[var(--surface-raised)] px-4 py-3 transition-colors hover:border-amber/30 hover:bg-amber/5 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Download className="h-4 w-4 text-muted-foreground group-hover:text-amber transition-colors shrink-0" />
                      <span className="text-sm text-foreground truncate">{dl.label}</span>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ml-2 ${platform.bg} ${platform.color}`}>
                      {dl.badge}
                    </span>
                  </a>
                ))}
              </div>

              {/* Requirement note */}
              <p className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                {platform.name === 'macOS'
                  ? 'Requires macOS 10.15 Catalina or later'
                  : platform.name === 'Windows'
                  ? 'Requires Windows 10 or later (64-bit)'
                  : 'Requires glibc 2.17+ (most modern distros)'}
              </p>
            </div>
          ))}
        </div>

        {/* All releases link */}
        <div className="mt-10 text-center">
          <a
            href={`https://github.com/${REPO}/releases`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="gap-2">
              View all releases on GitHub
            </Button>
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Open source &middot; Free to download &middot; v{version}
          </p>
        </div>
      </div>
    </section>
  );
}
