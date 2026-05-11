'use client';

import { useEffect, useState, useMemo } from 'react';
import { Download, Monitor, Apple, Terminal, CheckCircle2, Zap, GitBranch, Code2, Loader2, Cpu, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const REPO = 'ddrdushy/codanium-desktop';

type OSType = 'macOS' | 'Windows' | 'Linux' | null;
type ArchType = 'arm64' | 'x64';

interface ReleaseInfo {
  tag: string;
  version: string;
  baseUrl: string;
  assets: string[];
}

interface DownloadItem {
  label: string;
  file: string;
  badge: string;
  recommended?: boolean;
}

interface Platform {
  name: string;
  icon: typeof Apple;
  color: string;
  bg: string;
  border: string;
  glowColor: string;
  downloads: DownloadItem[];
  requirement: string;
}

function detectOS(): { os: OSType; arch: ArchType } {
  if (typeof navigator === 'undefined') return { os: null, arch: 'x64' };

  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();

  let os: OSType = null;
  let arch: ArchType = 'x64';

  // Detect OS
  if (ua.includes('mac') || platform.includes('mac')) {
    os = 'macOS';
  } else if (ua.includes('win') || platform.includes('win')) {
    os = 'Windows';
  } else if (ua.includes('linux') || platform.includes('linux')) {
    os = 'Linux';
  }

  // Detect architecture for macOS (Apple Silicon vs Intel)
  if (os === 'macOS') {
    // Check for Apple Silicon indicators
    const isAppleSilicon =
      ua.includes('arm') ||
      // Safari on Apple Silicon reports differently
      (typeof navigator !== 'undefined' && 'userAgentData' in navigator);

    // Canvas-based detection as fallback
    if (isAppleSilicon || platform.includes('arm')) {
      arch = 'arm64';
    }

    // GPU renderer check (most reliable for Apple Silicon)
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer && (renderer.includes('Apple M') || renderer.includes('Apple GPU'))) {
            arch = 'arm64';
          }
        }
      }
    } catch {
      // Silently fall back to platform check
    }
  }

  return { os, arch };
}

function buildPlatforms(v: string, detectedArch: ArchType): Platform[] {
  return [
    {
      name: 'macOS',
      icon: Apple,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
      glowColor: 'shadow-blue-500/20',
      downloads: [
        {
          label: 'Apple Silicon (M1/M2/M3/M4)',
          file: `Codanium_${v}_aarch64.dmg`,
          badge: 'ARM64',
          recommended: detectedArch === 'arm64',
        },
        {
          label: 'Intel Mac',
          file: `Codanium_${v}_x64.dmg`,
          badge: 'x64',
          recommended: detectedArch === 'x64',
        },
      ],
      requirement: 'Requires macOS 10.15 Catalina or later',
    },
    {
      name: 'Windows',
      icon: Monitor,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/20',
      glowColor: 'shadow-purple-500/20',
      downloads: [
        { label: 'Windows Installer (.msi)', file: `Codanium_${v}_x64_en-US.msi`, badge: 'x64', recommended: true },
        { label: 'Windows Setup (.exe)', file: `Codanium_${v}_x64-setup.exe`, badge: 'x64' },
      ],
      requirement: 'Requires Windows 10 or later (64-bit)',
    },
    {
      name: 'Linux',
      icon: Terminal,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      glowColor: 'shadow-emerald-500/20',
      downloads: [
        { label: 'Debian / Ubuntu (.deb)', file: `Codanium_${v}_amd64.deb`, badge: 'x64', recommended: true },
        { label: 'AppImage (Universal)', file: `Codanium_${v}_amd64.AppImage`, badge: 'x64' },
        { label: 'RPM Package', file: `Codanium-${v}-1.x86_64.rpm`, badge: 'x64' },
      ],
      requirement: 'Requires glibc 2.17+ (most modern distros)',
    },
  ];
}

const ideFeatures = [
  { icon: Code2, text: 'Built-in code editor with syntax highlighting' },
  { icon: Terminal, text: 'Integrated terminal — run builds, git, npm' },
  { icon: GitBranch, text: 'Git integration — view diffs, commit, push' },
  { icon: Zap, text: 'Live agent status — watch AI team work in real time' },
];

function RecommendedBanner({ os, arch, baseUrl, platform }: {
  os: OSType;
  arch: ArchType;
  baseUrl: string;
  platform: Platform;
}) {
  const recommended = platform.downloads.find((d) => d.recommended);
  if (!recommended) return null;

  return (
    <div className="mb-10 animate-fade-in">
      <div className={cn(
        'relative rounded-2xl border-2 border-amber/30 bg-gradient-to-br from-amber/5 via-[var(--surface)] to-orange-500/5 p-8 overflow-hidden',
        'shadow-xl shadow-amber/10'
      )}>
        {/* Top glow line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3 bg-gradient-to-r from-transparent via-amber/50 to-transparent" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Icon + Detection info */}
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-16 w-16 items-center justify-center rounded-2xl border',
              platform.bg, platform.border,
              'shadow-lg', platform.glowColor
            )}>
              <platform.icon className={cn('h-8 w-8', platform.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-amber" />
                <span className="text-sm font-semibold text-amber">Recommended for you</span>
              </div>
              <h3 className="text-xl font-bold text-foreground">
                {recommended.label}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5" />
                Detected: {os} ({arch === 'arm64' ? 'Apple Silicon' : 'Intel/AMD 64-bit'})
              </p>
            </div>
          </div>

          {/* Download CTA */}
          <div className="sm:ml-auto shrink-0">
            <a href={`${baseUrl}/${recommended.file}`}>
              <Button
                size="lg"
                className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-8 h-13 glow-amber group gap-2"
              >
                <Download className="h-5 w-5" />
                Download for {os}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Button>
            </a>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              {recommended.file} &middot; Free &amp; open source
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DownloadSection() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [detected, setDetected] = useState<{ os: OSType; arch: ArchType }>({ os: null, arch: 'x64' });

  useEffect(() => {
    setDetected(detectOS());
  }, []);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases`)
      .then((r) => {
        if (!r.ok) return []; // Suppress 404 when no releases exist
        return r.json();
      })
      .then((releases) => {
        if (!Array.isArray(releases) || releases.length === 0) return;
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
      .catch(() => { /* Silently use fallback defaults */ });
  }, []);

  const version = release?.version || '0.1.0';
  const baseUrl = release?.baseUrl || `https://github.com/${REPO}/releases/download/v0.1.0`;
  const platforms = useMemo(() => buildPlatforms(version, detected.arch), [version, detected.arch]);

  // Sort platforms: detected OS first
  const sortedPlatforms = useMemo(() => {
    if (!detected.os) return platforms;
    const detectedPlatform = platforms.find((p) => p.name === detected.os);
    const others = platforms.filter((p) => p.name !== detected.os);
    return detectedPlatform ? [detectedPlatform, ...others] : platforms;
  }, [platforms, detected.os]);

  const detectedPlatform = detected.os ? platforms.find((p) => p.name === detected.os) : null;

  return (
    <section id="download" className="py-24 sm:py-32 relative overflow-hidden">
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

        {/* Recommended download banner */}
        {detected.os && detectedPlatform && (
          <RecommendedBanner
            os={detected.os}
            arch={detected.arch}
            baseUrl={baseUrl}
            platform={detectedPlatform}
          />
        )}

        {/* Features strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {ideFeatures.map((f) => (
            <div key={f.text} className="flex items-start gap-3 rounded-xl border border-border bg-[var(--surface)] p-4 card-lift">
              <f.icon className="h-4 w-4 text-amber mt-0.5 shrink-0" />
              <span className="text-sm text-muted-foreground leading-snug">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Platform cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {sortedPlatforms.map((platform) => {
            const isDetected = platform.name === detected.os;
            return (
              <div
                key={platform.name}
                className={cn(
                  'rounded-2xl border p-6 transition-all',
                  isDetected
                    ? 'border-amber/30 bg-[var(--surface)] shadow-lg shadow-amber/5 ring-1 ring-amber/10'
                    : 'border-border bg-[var(--surface)]'
                )}
              >
                {/* Platform header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border',
                    platform.bg, platform.border
                  )}>
                    <platform.icon className={cn('h-5 w-5', platform.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{platform.name}</h3>
                      {isDetected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 border border-amber/20 px-2 py-0.5 text-[10px] font-semibold text-amber">
                          <CheckCircle2 className="h-3 w-3" />
                          Your system
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{platform.downloads.length} packages available</p>
                  </div>
                </div>

                {/* Download buttons */}
                <div className="space-y-3">
                  {platform.downloads.map((dl) => (
                    <a
                      key={dl.file}
                      href={`${baseUrl}/${dl.file}`}
                      className={cn(
                        'flex items-center justify-between rounded-lg border px-4 py-3 transition-all group',
                        isDetected && dl.recommended
                          ? 'border-amber/30 bg-amber/5 hover:bg-amber/10 hover:border-amber/50'
                          : 'border-border bg-[var(--surface-raised)] hover:border-amber/30 hover:bg-amber/5'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Download className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isDetected && dl.recommended ? 'text-amber' : 'text-muted-foreground group-hover:text-amber'
                        )} />
                        <div className="min-w-0">
                          <span className="text-sm text-foreground truncate block">{dl.label}</span>
                          {isDetected && dl.recommended && (
                            <span className="text-[10px] text-amber font-medium">Recommended</span>
                          )}
                        </div>
                      </div>
                      <span className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ml-2',
                        platform.bg, platform.color
                      )}>
                        {dl.badge}
                      </span>
                    </a>
                  ))}
                </div>

                {/* Requirement note */}
                <p className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {platform.requirement}
                </p>
              </div>
            );
          })}
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
