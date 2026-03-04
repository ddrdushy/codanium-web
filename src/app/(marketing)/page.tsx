'use client';

import Link from 'next/link';
import { Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto">
          <Zap className="w-8 h-8 text-amber" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">AI Team Studio</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          AI-Powered Product Delivery Operating System. Full landing page coming soon.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/login">
            <Button variant="outline">Login</Button>
          </Link>
          <Link href="/projects">
            <Button className="bg-amber text-background hover:bg-amber/90">
              Go to Projects <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
