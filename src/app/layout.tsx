import type { Metadata, Viewport } from "next";
import { Inter, DM_Sans, Manrope } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { LocaleProvider } from "@/i18n/LocaleProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
});

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

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
      <head><script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} /></head>
      <body
        className={`${inter.variable} ${dmSans.variable} ${manrope.variable} font-display bg-background text-foreground antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
