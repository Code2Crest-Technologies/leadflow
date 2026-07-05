// src/app/layout.tsx

import type { Metadata } from 'next';
import { Providers } from './providers';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'LeadFlow CRM',
  description: 'WhatsApp-focused CRM for leads, follow-ups, quotations and invoices.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--color-bg)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
