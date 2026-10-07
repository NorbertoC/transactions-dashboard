import type { Metadata, Viewport } from "next";
import "./fonts.css";
import interLatin from "./fonts/inter-c940764593d0fe5d.woff2";
import dmSansLatin from "./fonts/dmsans-468d56b6b25b05b7.woff2";
import manropeLatin from "./fonts/manrope-e310b55a7fd9677f.woff2";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { LocaleProvider } from "@/i18n/LocaleProvider";

export const metadata: Metadata = {
  title: "Transactions Dashboard",
  description: "Private financial transactions dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gastos",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1118",
};

const themeInitializationScript = `try {
  var theme = localStorage.getItem('gastos.theme') === 'light' ? 'light' : 'dark';
  var palette = localStorage.getItem('gastos.palette');
  if (!['green','blue','orange','pink','purple'].includes(palette)) palette = 'green';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.palette = palette;
  document.documentElement.style.colorScheme = theme;
} catch (_) { document.documentElement.dataset.theme = 'dark'; document.documentElement.dataset.palette = 'green'; }`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href={interLatin} as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href={dmSansLatin} as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href={manropeLatin} as="font" type="font/woff2" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body
        className="font-display bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <SessionProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
