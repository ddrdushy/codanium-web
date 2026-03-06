'use client';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { PreviewPanel } from '@/components/preview/preview-panel';
import { usePreviewStore } from '@/hooks/use-preview';
import { AnimatePresence } from 'framer-motion';

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const isPreviewOpen = usePreviewStore((s) => s.isOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 min-w-0">
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
        <AnimatePresence>
          {isPreviewOpen && <PreviewPanel />}
        </AnimatePresence>
      </div>
    </div>
  );
}
