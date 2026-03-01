import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LiveTranslatorProvider } from "@/contexts/TranscriptionContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "The Send — Live Translator",
  description: "Real-time speech transcription and AI-powered translation",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The Send",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <LiveTranslatorProvider>
          {children}
        </LiveTranslatorProvider>
      </body>
    </html>
  );
}
