import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "next-auth/react";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette-provider";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { ToastProvider } from "@/components/notifications/toast-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Team Studio",
  description: "AI-Powered Product Delivery Operating System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased grain`}
      >
        <SessionProvider>
          <ThemeProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <CommandPaletteProvider />
              <NotificationPanel />
              <ToastProvider />
            </TooltipProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
