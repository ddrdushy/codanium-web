'use client';

import { HeroSection } from '@/components/marketing/hero-section';
import { LogosSection } from '@/components/marketing/logos-section';
import { FeaturesSection } from '@/components/marketing/features-section';
import { HowItWorksSection } from '@/components/marketing/how-it-works-section';
import { DownloadSection } from '@/components/marketing/download-section';
import { CTASection } from '@/components/marketing/cta-section';

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <LogosSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DownloadSection />
      <CTASection />
    </>
  );
}
