import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

export const metadata = {
  title: 'Set Up Your Platform — AI Team Studio',
  description: 'Configure your AI provider, budget, and preferences to get started.',
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
