import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "../components/Sidebar";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter", 
});
const jbMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: "--font-jetbrains-mono", 
});

export const metadata: Metadata = {
  title: "AI Assistant — Trace",
  description: "Open-source AI assistant with Standard Chat and Trace structured decision canvas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jbMono.variable}`}>
      <body id="app-root">
        <Sidebar />
        
        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}
