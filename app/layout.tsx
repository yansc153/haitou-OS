import type { Metadata } from 'next';
import './globals.css';
import { ThemeWrapper } from './theme-wrapper';

export const metadata: Metadata = {
  title: '海投助手 — Haitou OS',
  description: 'AI-powered job search automation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen antialiased">
        <ThemeWrapper>{children}</ThemeWrapper>
      </body>
    </html>
  );
}
