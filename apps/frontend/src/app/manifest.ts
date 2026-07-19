import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const icons = [
    {
      src: '/web-app-manifest-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: '/web-app-manifest-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ] as unknown as MetadataRoute.Manifest['icons'];

  return {
    name: 'LeadFlow CRM',
    short_name: 'LeadFlow',
    description:
      'Meta and WhatsApp CRM for leads, conversations, follow-ups, quotations, invoices, and sales teams.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F0EDE4',
    theme_color: '#004741',
    icons,
  };
}
