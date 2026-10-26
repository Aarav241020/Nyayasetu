import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/components/layout/LanguageProvider";
import DemoBanner from "@/components/layout/DemoBanner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "NyayaSetu: report civic issues, track them to resolution",
  description: "Geo-tagged civic issue reporting with explainable priority scores and a public resolution tracker.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DemoBanner />
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
