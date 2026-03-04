'use client';

import { AuthIllustration } from '@/components/auth/auth-illustration';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: Illustration */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative">
        <AuthIllustration />
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
