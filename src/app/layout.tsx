import type { Metadata } from "next";
import { Geist_Mono, Hanken_Grotesk } from "next/font/google";

import { messages } from "@/messages/pt-BR";

import "./globals.css";

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: messages.appName,
  description: messages.appDescription,
  appleWebApp: {
    capable: true,
    title: messages.appName,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${hankenGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
