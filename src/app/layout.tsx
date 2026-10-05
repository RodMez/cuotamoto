import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CuotaMoto - Pagos de alquiler",
  description: "Control de cuota diaria, pagos y deuda por moto",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
