'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TourStep {
  id: string;
  target?: string;       // data-tour attribute selector (null = full modal)
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Codanium!',
    description: 'Let\'s take a quick tour of your AI-powered development team. Your 23 AI specialists are ready to build your product.',
  },
  {
    id: 'ai-provider',
    target: '[data-tour="settings"]',
    title: 'Configure your AI Provider',
    description: 'Codanium runs on your own API keys — OpenAI, Anthropic, Ollama, Mistral, Groq, or any compatible provider. Click the gear icon to add or change yours. Keys are encrypted at rest with AES-256-GCM.',
    position: 'bottom',
  },
  {
    id: 'new-project',
    target: '[data-tour="new-project"]',
    title: 'Start a New Project',
    description: 'Click here to describe your idea. Our AI team handles requirements, architecture, design, coding, testing, and deployment.',
    position: 'bottom',
  },
  {
    id: 'chat',
    target: '[data-tour="chat"]',
    title: 'Chat with Your AI Team',
    description: 'The Business Analyst starts by asking you questions about your project. Just describe what you need in plain language.',
    position: 'right',
  },
  {
    id: 'board',
    target: '[data-tour="board"]',
    title: 'Track Progress on the Board',
    description: 'All tasks are managed here as kanban cards. AI agents create and update cards as they work through your project.',
    position: 'right',
  },
  {
    id: 'agents',
    target: '[data-tour="agents"]',
    title: 'Meet Your AI Team',
    description: '23 AI specialists — from Business Analyst to QA Engineer to DevOps. Each has specific skills and works autonomously.',
    position: 'right',
  },
  {
    id: 'documents',
    target: '[data-tour="documents"]',
    title: 'Auto-Generated Documents',
    description: 'BRD, SDD, and design documents are created automatically by your AI team. Review and approve them as they\'re generated.',
    position: 'right',
  },
  {
    id: 'settings',
    target: '[data-tour="user-menu"]',
    title: 'Your Settings',
    description: 'Configure preferences, API keys, billing, and more. You\'re all set to start building!',
    position: 'bottom',
  },
];

interface TutorialState {
  isActive: boolean;
  currentStep: number;
  completed: boolean;
  loading: boolean;
}

export function useTutorial() {
  const [state, setState] = useState<TutorialState>({
    isActive: false,
    currentStep: 0,
    completed: false,
    loading: true,
  });

  // Fetch tutorial status on mount
  useEffect(() => {
    fetch('/api/tutorial/status')
      .then((r) => r.json())
      .then((data) => {
        setState({
          isActive: !data.completed && data.step === 0,
          currentStep: data.step,
          completed: data.completed,
          loading: false,
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  const startTour = useCallback(() => {
    setState((s) => ({ ...s, isActive: true, currentStep: 0 }));
  }, []);

  const nextStep = useCallback(() => {
    setState((s) => {
      const next = s.currentStep + 1;
      if (next >= TOUR_STEPS.length) {
        // Tour complete
        fetch('/api/tutorial/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: true, step: TOUR_STEPS.length }),
        }).catch(() => {});
        return { ...s, isActive: false, completed: true, currentStep: next };
      }
      // Save progress
      fetch('/api/tutorial/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: next }),
      }).catch(() => {});
      return { ...s, currentStep: next };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((s) => ({
      ...s,
      currentStep: Math.max(0, s.currentStep - 1),
    }));
  }, []);

  const skipTour = useCallback(() => {
    fetch('/api/tutorial/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true, step: -1 }),
    }).catch(() => {});
    setState((s) => ({ ...s, isActive: false, completed: true }));
  }, []);

  return {
    ...state,
    step: TOUR_STEPS[state.currentStep] || null,
    totalSteps: TOUR_STEPS.length,
    startTour,
    nextStep,
    prevStep,
    skipTour,
  };
}
