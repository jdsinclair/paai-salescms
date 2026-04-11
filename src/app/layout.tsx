import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAAI Sales CMS",
  description: "Provider Assessment Intelligence — Sales CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
