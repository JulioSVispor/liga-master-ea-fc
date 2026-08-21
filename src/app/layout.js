import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { MaintenanceBanner } from "@/components/ui/MaintenanceBanner";

export const metadata = {
  title: {
    default: "Liga Master",
    template: "%s | Liga Master",
  },
  description: "Gestão objetiva de clubes, competições, partidas, mercado e história de comunidades de EA FC.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MaintenanceBanner />
        {children}
      </body>
    </html>
  );
}
