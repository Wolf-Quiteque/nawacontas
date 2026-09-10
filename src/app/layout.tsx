import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "NawaNotas",
  description: "Gerador de notas de pagamento NawaBus — preencha os dados e obtenha o PDF.",
  applicationName: "NawaNotas",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NawaNotas",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#F28C1B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
