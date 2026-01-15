import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Pinball Brackets",
  description: "Create free March-Madness style prediction brackets for your state's IFPA Open and Women's Championships!",
  metadataBase: new URL("https://www.pinballbrackets.com"),
  openGraph: {
    title: "Pinball Brackets",
    description: "Create free March-Madness style prediction brackets for your state's IFPA Open and Women's Championships!",
    url: "https://www.pinballbrackets.com",
    siteName: "Pinball Brackets",
    images: [
      {
        url: "/pinball-bracket-logo-expanded.png",
        width: 1200,
        height: 630,
        alt: "Pinball Brackets",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pinball Brackets",
    description: "Create free March-Madness style prediction brackets for your state's IFPA Open and Women's Championships!",
    images: ["/pinball-bracket-logo-expanded.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Always apply dark mode - light mode code kept for potential future use */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('dark');`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-text-primary))]">
        <ThemeProvider>
          <div className="flex-1">{children}</div>
          <Footer />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
