import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrateDig — Dig deeper into your collection",
  description: "Upload your music library, roll the dice, discover new tracks via YouTube Music.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
