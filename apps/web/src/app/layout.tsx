import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { ErrorReporter } from '@/components/error-reporter';

export const metadata: Metadata = {
  title: 'Sitelog — Construction BOQ + Daily Reporting',
  description: 'End-to-end SaaS for construction estimation, scheduling, and production tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-sans">
        <ErrorReporter />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
