'use client';

import { useEffect, useRef, useCallback, type RefObject } from 'react';
import { usePreviewStore } from '@/hooks/use-preview';
import {
  isWebContainerSupported,
  syncFilesToContainer,
  npmInstall,
  startDevServer,
  teardown,
} from '@/lib/preview/webcontainer-manager';
import { AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WebContainerPreviewProps {
  files: Record<string, string>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function WebContainerPreview({
  files,
  iframeRef,
}: WebContainerPreviewProps) {
  const {
    setStatus,
    setError,
    setUrl,
    appendTerminal,
    clearTerminal,
    url,
    status,
  } = usePreviewStore();

  const hasBooted = useRef(false);
  const supported = isWebContainerSupported();

  const bootAndRun = useCallback(async () => {
    if (hasBooted.current && status === 'running') return;

    clearTerminal();
    setError(null);

    try {
      // Step 1: Sync files
      setStatus('loading');
      appendTerminal('> Syncing project files to WebContainer...');
      await syncFilesToContainer(files);
      appendTerminal('> Files synced successfully.');

      // Check if package.json exists
      const hasPkgJson = files['/package.json'] || files['package.json'];

      if (hasPkgJson) {
        // Step 2: npm install
        setStatus('installing');
        appendTerminal('> npm install --legacy-peer-deps');

        const { exitCode, output } = await npmInstall((data) => {
          appendTerminal(data);
        });

        if (exitCode !== 0) {
          setStatus('error');
          setError(`npm install failed with exit code ${exitCode}`);
          return;
        }

        appendTerminal('> Dependencies installed successfully.');
      }

      // Step 3: Start dev server
      setStatus('building');
      appendTerminal('> Starting development server...');

      const { url: serverUrl, port } = await startDevServer((data) => {
        appendTerminal(data);
      });

      setUrl(serverUrl);
      setStatus('running');
      appendTerminal(`> Server running on port ${port}`);
      appendTerminal(`> Preview URL: ${serverUrl}`);

      hasBooted.current = true;
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'WebContainer failed to start');
      appendTerminal(`> Error: ${err.message}`);
    }
  }, [files, appendTerminal, clearTerminal, setStatus, setError, setUrl, status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardown();
      hasBooted.current = false;
    };
  }, []);

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--surface)] p-8 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500/50 mb-3" />
        <p className="text-sm text-foreground font-medium mb-1">
          WebContainer Not Supported
        </p>
        <p className="text-xs text-muted-foreground max-w-sm mb-4">
          Your browser does not support SharedArrayBuffer, which is required for
          WebContainer. Try using Chrome, Edge, or Firefox with cross-origin
          isolation enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Boot button (before running) */}
      {status === 'idle' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--surface)]">
          <Zap className="w-10 h-10 text-blue-400/30 mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">
            WebContainer Preview
          </p>
          <p className="text-xs text-muted-foreground max-w-sm text-center mb-4">
            Run a full Node.js development environment in your browser. Supports
            npm, hot reload, and API routes.
          </p>
          <Button
            size="sm"
            onClick={bootAndRun}
            className="bg-blue-500 hover:bg-blue-600 text-white gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            Start Preview
          </Button>
        </div>
      )}

      {/* The actual iframe that shows the running app */}
      {url && (
        <iframe
          ref={iframeRef}
          src={url}
          className="w-full h-full border-0"
          title="WebContainer Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      )}
    </div>
  );
}
