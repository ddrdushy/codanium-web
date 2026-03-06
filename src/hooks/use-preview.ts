'use client';

import { create } from 'zustand';

export type PreviewTier = 'sandpack' | 'webcontainer' | 'cloud';
export type PreviewStatus = 'idle' | 'loading' | 'installing' | 'building' | 'running' | 'error';
export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
export type BottomTab = 'console' | 'terminal' | 'network';

interface PreviewState {
  // Panel visibility
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;

  // Preview tier
  tier: PreviewTier;
  setTier: (tier: PreviewTier) => void;

  // Status
  status: PreviewStatus;
  setStatus: (status: PreviewStatus) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // URL (for WebContainer/Cloud)
  url: string;
  setUrl: (url: string) => void;

  // Device preview
  device: PreviewDevice;
  setDevice: (device: PreviewDevice) => void;

  // Bottom panel
  bottomTab: BottomTab;
  setBottomTab: (tab: BottomTab) => void;
  showBottomPanel: boolean;
  setShowBottomPanel: (show: boolean) => void;

  // Terminal output
  terminalOutput: string[];
  appendTerminal: (line: string) => void;
  clearTerminal: () => void;

  // Console output
  consoleOutput: string[];
  appendConsole: (line: string) => void;
  clearConsole: () => void;

  // Reset
  reset: () => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  // Panel visibility
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  // Preview tier
  tier: 'sandpack',
  setTier: (tier) => set({ tier }),

  // Status
  status: 'idle',
  setStatus: (status) => set({ status }),
  error: null,
  setError: (error) => set({ error }),

  // URL
  url: '',
  setUrl: (url) => set({ url }),

  // Device
  device: 'desktop',
  setDevice: (device) => set({ device }),

  // Bottom panel
  bottomTab: 'console',
  setBottomTab: (bottomTab) => set({ bottomTab }),
  showBottomPanel: false,
  setShowBottomPanel: (showBottomPanel) => set({ showBottomPanel }),

  // Terminal output
  terminalOutput: [],
  appendTerminal: (line) =>
    set((s) => ({
      terminalOutput: [...s.terminalOutput.slice(-500), line],
    })),
  clearTerminal: () => set({ terminalOutput: [] }),

  // Console output
  consoleOutput: [],
  appendConsole: (line) =>
    set((s) => ({
      consoleOutput: [...s.consoleOutput.slice(-500), line],
    })),
  clearConsole: () => set({ consoleOutput: [] }),

  // Reset
  reset: () =>
    set({
      status: 'idle',
      error: null,
      url: '',
      terminalOutput: [],
      consoleOutput: [],
    }),
}));
