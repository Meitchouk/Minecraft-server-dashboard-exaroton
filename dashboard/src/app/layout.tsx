import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Exaroton Panel",
  description: "Dashboard de control para servidores de Exaroton",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster richColors position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
