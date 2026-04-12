import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { THEME_INLINE_SCRIPT } from "@/lib/theme-inline-script";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rhapsody - Ticketing & Event Management",
  description: "Ticketing & Event Management platform for Thenmozhi Memorial Trust",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint to prevent theme flash; keep in sync with src/lib/theme.ts */}
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{ __html: THEME_INLINE_SCRIPT }}
          suppressHydrationWarning
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
