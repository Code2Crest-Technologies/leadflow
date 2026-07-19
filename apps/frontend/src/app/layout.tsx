// src/app/layout.tsx

import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import '../styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://leadflow.code2crest.com'),
  title: {
    default: 'LeadFlow CRM',
    template: '%s | LeadFlow',
  },
  description:
    'Meta and WhatsApp CRM for managing leads, conversations, deals, follow-ups, quotations, invoices, and team workflows.',
  applicationName: 'LeadFlow',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'LeadFlow',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'LeadFlow CRM',
    description:
      'Meta and WhatsApp CRM for managing leads, conversations, deals, follow-ups, quotations, invoices, and team workflows.',
    url: 'https://leadflow.code2crest.com',
    siteName: 'LeadFlow',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'LeadFlow CRM',
    description:
      'Meta and WhatsApp CRM for managing leads, conversations, deals, follow-ups, quotations, invoices, and team workflows.',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F0EDE4' },
    { media: '(prefers-color-scheme: dark)', color: '#004741' },
  ],
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
