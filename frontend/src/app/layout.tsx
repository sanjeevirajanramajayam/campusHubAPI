import type { Metadata } from 'next';
import { Archivo_Black, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-header',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CAMPUSHUB // TACTICAL FEED & FORUM',
  description: 'Industrial Brutalism Campus Communication & High-Concurrency Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${jetbrainsMono.variable}`}>
      <body className={jetbrainsMono.className}>{children}</body>
    </html>
  );
}
