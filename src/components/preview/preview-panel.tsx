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
      <div className="flex items-center gap-1.5 px-3 h-10 border-b border-border bg-[var(--surface-raised)] shrink-0">
        {/* Reload */}
        <button
          onClick={handleReload}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Reload"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* URL bar */}
        <div className="flex-1 flex items-center h-6 px-2 rounded bg-background border border-border/50 text-[11px] text-muted-foreground font-mono truncate">
          <Globe className="w-3 h-3 mr-1.5 shrink-0 text-muted-foreground/50" />
          {url || 'localhost:3000'}
        </div>

        {/* Device toggles */}
        <div className="flex items-center gap-0.5 border-l border-border pl-1.5 ml-1">
          {(
            [
              { key: 'mobile' as const, icon: Smartphone },
              { key: 'tablet' as const, icon: Tablet },
              { key: 'desktop' as const, icon: Monitor },
            ] as const
          ).map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              className={cn(
                'p-1 rounded transition-colors',
                device === key
                  ? 'text-foreground bg-background'
                  : 'text-muted-foreground/50 hover:text-muted-foreground',
              )}
              title={key}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* Tier selector */}
        <div className="relative border-l border-border pl-1.5 ml-1">
          <button
            onClick={() => setShowTierMenu(!showTierMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors hover:bg-background"
            style={{ color: tierConfig.color }}
          >
            <TierIcon className="w-3 h-3" />
            {tierConfig.label}
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {showTierMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowTierMenu(false)}
              />
              <div className="absolute right-0 top-8 z-50 w-52 bg-[var(--surface)] border border-border rounded-lg shadow-lg overflow-hidden">
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
                          'flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-colors',
                          !isAllowed && 'opacity-50 cursor-not-allowed',
                          tier === key
                            ? 'bg-[var(--surface-raised)]'
                            : isAllowed
                              ? 'hover:bg-[var(--surface-raised)]'
                              : '',
                        )}
                      >
                        <config.icon
                          className="w-3.5 h-3.5"
                          style={{ color: isAllowed ? config.color : undefined }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            'font-medium',
                            isAllowed ? 'text-foreground' : 'text-muted-foreground',
                          )}>
                            {config.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {config.description}
                          </div>
                        </div>
                        {tier === key && isAllowed && (
                          <Badge
                            variant="outline"
                            className="ml-auto text-[8px] px-1 py-0 shrink-0"
                            style={{
                              color: config.color,
                              borderColor: config.color + '40',
                            }}
                          >
                            Active
                          </Badge>
                        )}
                        {!isAllowed && upgradeLabel && (
                          <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground/60 shrink-0">
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

        {/* Download ZIP */}
        <button
          onClick={handleDownloadZip}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Download ZIP"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
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
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title="Close preview"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Preview Content ── */}
      <div className="flex-1 relative overflow-hidden bg-background">
        {/* Status overlay */}
        {(status === 'loading' || status === 'installing' || status === 'building') && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground capitalize">{status}...</p>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm px-8">
            <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
            <p className="text-sm text-red-400 text-center max-w-md">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleReload}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {artifacts.length === 0 && !loadingArtifacts && status === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Play className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground font-medium mb-1">
              No code artifacts yet
            </p>
            <p className="text-xs text-muted-foreground/60 max-w-xs">
              Once your AI team generates code, it will appear here as a live
              preview.
            </p>
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
                  <Server className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">
                    Cloud Containers
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Coming soon — Enterprise tier
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Panel Toggle ── */}
      <div className="flex items-center h-8 border-t border-border bg-[var(--surface-raised)] px-2 shrink-0">
        <button
          onClick={() => setShowBottomPanel(!showBottomPanel)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showBottomPanel ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </button>

        <div className="flex items-center gap-0.5 ml-2">
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
                'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors',
                bottomTab === key && showBottomPanel
                  ? 'text-foreground bg-background'
                  : 'text-muted-foreground/60 hover:text-muted-foreground',
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
              {key === 'console' && consoleOutput.length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-amber-500/20 text-amber-500 text-[8px] flex items-center justify-center">
                  {Math.min(consoleOutput.length, 99)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              status === 'running' && 'bg-green-500',
              status === 'error' && 'bg-red-400',
              (status === 'idle' || status === 'loading') && 'bg-muted-foreground/30',
              (status === 'installing' || status === 'building') &&
                'bg-amber-500 animate-pulse',
            )}
          />
          <span className="text-[10px] text-muted-foreground capitalize">
            {status}
          </span>
        </div>
      </div>

      {/* ── Bottom Panel Content ── */}
      <AnimatePresence>
        {showBottomPanel && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 160 }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
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
