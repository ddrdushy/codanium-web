import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { CookieConsent } from '@/components/marketing/cookie-consent';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-zinc-950 text-zinc-50 min-h-screen">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
      <CookieConsent />
    </div>
  );
}
