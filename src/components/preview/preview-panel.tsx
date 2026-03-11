'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  usePreviewStore,
  type PreviewTier,
  type PreviewDevice,
} from '@/hooks/use-preview';
import {
  Play,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  Minimize2,
  X,
  Terminal as TerminalIcon,
  MessageSquare,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Download,
  Zap,
  Server,
  Layers,
  Lock,
  Eye,
  Code2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { SandpackPreviewAdapter } from './sandpack-preview';
import { WebContainerPreview } from './webcontainer-preview';
import { TerminalOutput } from './terminal-output';

// ─── Device dimensions ───
const DEVICE_DIMS: Record<PreviewDevice, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

// ─── Tier config ───
const TIER_CONFIG: Record<
  PreviewTier,
  { label: string; icon: typeof Layers; color: string; description: string }
> = {
  sandpack: {
    label: 'Sandpack',
    icon: Layers,
    color: '#f59e0b',
    description: 'UI Preview (React/HTML)',
  },
  webcontainer: {
    label: 'WebContainer',
    icon: Zap,
    color: '#3b82f6',
    description: 'Full Node.js (Pro)',
  },
  cloud: {
    label: 'Cloud',
    icon: Server,
    color: '#8b5cf6',
    description: 'Any Language (Enterprise)',
  },
};

// ─── Main Preview Panel ───
export function PreviewPanel() {
  const { id: projectId } = useParams<{ id: string }>();
  const {
    isOpen,
    setOpen,
    tier,
    setTier,
    allowedTiers,
    setAllowedTiers,
    status,
    device,
    setDevice,
    error,
    bottomTab,
    setBottomTab,
    showBottomPanel,
    setShowBottomPanel,
    url,
    terminalOutput,
    consoleOutput,
  } = usePreviewStore();

  const [fullscreen, setFullscreen] = useState(false);
  const [showTierMenu, setShowTierMenu] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch allowed tiers from API based on user's plan
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/preview`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.allowedTiers) {
          setAllowedTiers(data.allowedTiers);
          // If current tier is not allowed, fall back to sandpack
          if (!data.allowedTiers.includes(tier)) {
            setTier('sandpack');
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Fetch artifacts for preview
  const [artifacts, setArtifacts] = useState<
    Array<{ id: string; name: string; type: string; content: string }>
  >([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  const fetchArtifacts = useCallback(async () => {
    if (!projectId) return;
    setLoadingArtifacts(true);
    try {
      // Fetch artifact list
      const listRes = await fetch(`/api/projects/${projectId}/artifacts`);
      if (!listRes.ok) return;
      const list = await listRes.json();

      // Fetch content for code/config artifacts
      const codeArtifacts = (list.artifacts ?? list).filter(
        (a: any) => a.type === 'CODE' || a.type === 'CONFIG' || a.type === 'TEST',
      );

      const withContent = await Promise.all(
        codeArtifacts.map(async (a: any) => {
          try {
            const res = await fetch(
              `/api/projects/${projectId}/artifacts/${a.id}`,
            );
            if (!res.ok) return { ...a, content: '' };
            const data = await res.json();
            return { ...a, content: data.content ?? '' };
          } catch {
            return { ...a, content: '' };
          }
        }),
      );

      setArtifacts(withContent);
    } catch (err) {
      console.error('Failed to fetch artifacts:', err);
    } finally {
      setLoadingArtifacts(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) fetchArtifacts();
  }, [isOpen, fetchArtifacts]);

  // File map for preview adapters
  const fileMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const art of artifacts) {
      const path = art.name.startsWith('/') ? art.name : `/${art.name}`;
      map[path] = art.content;
    }
    return map;
  }, [artifacts]);

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    fetchArtifacts();
  };

  const handleDownloadZip = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (!isOpen) return null;

  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig.icon;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{
        width: fullscreen ? '100%' : '50%',
        opacity: 1,
      }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'flex flex-col border-l border-border bg-[var(--surface)] overflow-hidden',
        fullscreen && 'fixed inset-0 z-50',
      )}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2.5 h-11 border-b border-border bg-[var(--surface-raised)] shrink-0">
        {/* Title */}
        <div className="flex items-center gap-1.5 mr-1">
          <Eye className="w-3.5 h-3.5 text-amber-500/70" />
          <span className="text-[11px] font-semibold text-foreground/80 tracking-wide uppercase">
            Preview
          </span>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Reload */}
        <button
          onClick={handleReload}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-background/60 transition-all duration-150"
          title="Reload preview"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* URL bar */}
        <div className="flex-1 flex items-center h-7 px-2.5 rounded-md bg-background/50 border border-border/40 text-[11px] text-muted-foreground/70 font-mono truncate mx-1 hover:border-border/60 transition-colors">
          <Globe className="w-3 h-3 mr-1.5 shrink-0 text-muted-foreground/40" />
          <span className="truncate">{url || 'localhost:3000'}</span>
        </div>

        {/* Device toggles */}
        <div className="flex items-center gap-0.5 bg-background/30 rounded-md p-0.5 border border-border/30">
          {(
            [
              { key: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
              { key: 'tablet' as const, icon: Tablet, label: 'Tablet' },
              { key: 'desktop' as const, icon: Monitor, label: 'Desktop' },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              className={cn(
                'p-1 rounded transition-all duration-150',
                device === key
                  ? 'text-amber-500 bg-amber-500/10 shadow-sm'
                  : 'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-background/50',
              )}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Tier selector */}
        <div className="relative">
          <button
            onClick={() => setShowTierMenu(!showTierMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-150 hover:bg-background/50 border border-transparent hover:border-border/30"
            style={{ color: tierConfig.color }}
          >
            <TierIcon className="w-3 h-3" />
            {tierConfig.label}
            <ChevronDown className={cn(
              'w-2.5 h-2.5 transition-transform duration-200',
              showTierMenu && 'rotate-180',
            )} />
          </button>

          {showTierMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowTierMenu(false)}
              />
              <div className="absolute right-0 top-9 z-50 w-56 bg-[var(--surface)] border border-border rounded-xl shadow-xl overflow-hidden backdrop-blur-sm">
                <div className="px-3 py-2 border-b border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    Preview Engine
                  </p>
                </div>
                {(Object.entries(TIER_CONFIG) as [PreviewTier, typeof tierConfig][]).map(
                  ([key, config]) => {
                    const isAllowed = allowedTiers.includes(key);
                    const upgradeLabel = key === 'webcontainer' ? 'Pro' : key === 'cloud' ? 'Enterprise' : null;

                    return (
                      <button
                        key={key}
                        onClick={() => {
                          if (!isAllowed) return;
                          // Persist tier change to server
                          fetch(`/api/projects/${projectId}/preview`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tier: key }),
                          }).catch(() => {});
                          setTier(key);
                          setShowTierMenu(false);
                        }}
                        disabled={!isAllowed}
                        className={cn(
                          'flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-xs transition-all duration-150',
                          !isAllowed && 'opacity-40 cursor-not-allowed',
                          tier === key
                            ? 'bg-[var(--surface-raised)]'
                            : isAllowed
                              ? 'hover:bg-[var(--surface-raised)]'
                              : '',
                        )}
                      >
                        <div
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                            isAllowed ? 'bg-background/80' : 'bg-background/40',
                          )}
                          style={isAllowed ? { borderColor: config.color + '30', borderWidth: 1 } : undefined}
                        >
                          <config.icon
                            className="w-3.5 h-3.5"
                            style={{ color: isAllowed ? config.color : undefined }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            'font-medium',
                            isAllowed ? 'text-foreground' : 'text-muted-foreground',
                          )}>
                            {config.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {config.description}
                          </div>
                        </div>
                        {tier === key && isAllowed && (
                          <Badge
                            variant="outline"
                            className="ml-auto text-[8px] px-1.5 py-0 shrink-0"
                            style={{
                              color: config.color,
                              borderColor: config.color + '40',
                              backgroundColor: config.color + '08',
                            }}
                          >
                            Active
                          </Badge>
                        )}
                        {!isAllowed && upgradeLabel && (
                          <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground/50 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            {upgradeLabel}
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Download ZIP */}
        <button
          onClick={handleDownloadZip}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-background/60 transition-all duration-150"
          title="Download project ZIP"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-background/60 transition-all duration-150"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Close */}
        <button
          onClick={() => {
            setOpen(false);
            setFullscreen(false);
          }}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-background/60 transition-all duration-150"
          title="Close preview"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Preview Content ── */}
      <div className="flex-1 relative overflow-hidden bg-background">
        {/* Loading overlay */}
        {(status === 'loading' || status === 'installing' || status === 'building') && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="relative mb-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500/60" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center">
                {status === 'loading' && <RefreshCw className="w-2.5 h-2.5 text-amber-500/70" />}
                {status === 'installing' && <Download className="w-2.5 h-2.5 text-amber-500/70" />}
                {status === 'building' && <Code2 className="w-2.5 h-2.5 text-amber-500/70" />}
              </div>
            </div>
            <p className="text-sm font-medium text-foreground/70 mb-1">
              {status === 'loading' && 'Loading preview...'}
              {status === 'installing' && 'Installing dependencies...'}
              {status === 'building' && 'Building project...'}
            </p>
            <p className="text-[11px] text-muted-foreground/50">
              This may take a moment
            </p>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm px-8">
            <div className="w-14 h-14 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-400/70" />
            </div>
            <p className="text-sm font-medium text-foreground/70 mb-1.5">Preview Error</p>
            <p className="text-xs text-red-400/80 text-center max-w-sm leading-relaxed mb-5 bg-red-500/5 border border-red-500/10 rounded-lg px-4 py-2.5">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-border/60 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all"
              onClick={handleReload}
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {artifacts.length === 0 && !loadingArtifacts && status === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center">
                <Play className="w-7 h-7 text-amber-500/30" />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-4 h-4 text-amber-500/20" />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground/70 mb-1.5">
              No code artifacts yet
            </p>
            <p className="text-xs text-muted-foreground/50 max-w-[280px] leading-relaxed">
              Once your AI team generates code, it will appear here as a live preview. Start a conversation in Chat to get building.
            </p>
            <div className="mt-8 flex items-center gap-3">
              {Object.entries(TIER_CONFIG).map(([key, config]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 px-2.5 py-1.5 rounded-md bg-background/30 border border-border/20"
                >
                  <config.icon className="w-3 h-3" style={{ color: config.color + '40' }} />
                  <span>{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview adapters */}
        {artifacts.length > 0 && (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <div
              className={cn(
                'bg-white rounded-lg overflow-hidden shadow-lg transition-all duration-300',
                device === 'desktop' && 'w-full h-full rounded-none shadow-none',
              )}
              style={
                device !== 'desktop'
                  ? {
                      width: DEVICE_DIMS[device].width,
                      height: DEVICE_DIMS[device].height,
                      maxWidth: '100%',
                      maxHeight: '100%',
                    }
                  : undefined
              }
            >
              {tier === 'sandpack' && (
                <SandpackPreviewAdapter files={fileMap} />
              )}
              {tier === 'webcontainer' && (
                <WebContainerPreview
                  files={fileMap}
                  iframeRef={iframeRef}
                />
              )}
              {tier === 'cloud' && (
                <div className="flex flex-col items-center justify-center h-full bg-[var(--surface)] p-8">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center mb-5">
                    <Server className="w-7 h-7 text-purple-400/30" />
                  </div>
                  <p className="text-sm font-medium text-foreground/70 mb-1">
                    Cloud Containers
                  </p>
                  <p className="text-xs text-muted-foreground/50 max-w-[260px] leading-relaxed">
                    Run any language in cloud-hosted containers. Available on the Enterprise plan.
                  </p>
                  <div className="mt-5 px-3 py-1.5 rounded-full bg-purple-500/5 border border-purple-500/10">
                    <span className="text-[10px] font-medium text-purple-400/60">Coming Soon</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Panel Toggle ── */}
      <div className="flex items-center h-9 border-t border-border bg-[var(--surface-raised)] px-2 shrink-0">
        <button
          onClick={() => setShowBottomPanel(!showBottomPanel)}
          className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-background/50 transition-all duration-150"
          title={showBottomPanel ? 'Hide panel' : 'Show panel'}
        >
          {showBottomPanel ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
          <span className="text-[9px] font-medium uppercase tracking-wider">
            {showBottomPanel ? 'Hide' : 'Show'}
          </span>
        </button>

        <div className="w-px h-3.5 bg-border mx-1.5" />

        <div className="flex items-center gap-0.5">
          {(
            [
              { key: 'console' as const, icon: MessageSquare, label: 'Console' },
              { key: 'terminal' as const, icon: TerminalIcon, label: 'Terminal' },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => {
                setBottomTab(key);
                if (!showBottomPanel) setShowBottomPanel(true);
              }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150',
                bottomTab === key && showBottomPanel
                  ? 'text-foreground bg-background/80 shadow-sm border border-border/40'
                  : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-background/30',
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
              {key === 'console' && consoleOutput.length > 0 && (
                <span className="ml-0.5 min-w-[16px] h-4 rounded-full bg-amber-500/15 text-amber-500 text-[8px] font-semibold flex items-center justify-center px-1">
                  {Math.min(consoleOutput.length, 99)}
                </span>
              )}
              {key === 'terminal' && terminalOutput.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
              )}
            </button>
          ))}
        </div>

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-2 pr-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-background/30">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                status === 'running' && 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]',
                status === 'error' && 'bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.4)]',
                (status === 'idle' || status === 'loading') && 'bg-muted-foreground/30',
                (status === 'installing' || status === 'building') &&
                  'bg-amber-500 animate-pulse shadow-[0_0_4px_rgba(245,158,11,0.4)]',
              )}
            />
            <span className="text-[10px] text-muted-foreground/60 font-medium capitalize">
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Panel Content ── */}
      <AnimatePresence>
        {showBottomPanel && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 180 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="border-t border-border overflow-hidden shrink-0"
          >
            {bottomTab === 'network' ? (
              <div className="h-full overflow-auto font-mono text-[11px] leading-relaxed p-3 bg-[#0d1117] text-gray-300">
                <span className="text-muted-foreground/40">Network inspection coming soon...</span>
              </div>
            ) : (
              <TerminalOutput
                lines={bottomTab === 'terminal' ? terminalOutput : consoleOutput}
                type={bottomTab}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
