import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LifeOS Admin',
  description: 'Operations portal for LifeOS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
