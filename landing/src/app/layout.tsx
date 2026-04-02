import type { Metadata } from "next";
import { Geist, Orbitron } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { CookieConsent } from "@/components/marketing/cookie-consent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Codanium — Your Vibe, Multiplied",
  description:
    "Describe what you need. Codanium's AI team builds, tests, and ships your software.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${orbitron.variable} antialiased grain`}
      >
        <ThemeProvider>
          <MarketingNav />
          <main>{children}</main>
          <MarketingFooter />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
