// src/app/not-found.tsx

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-2xl text-gray-700 mb-8">Page not found</p>
        <p className="text-gray-600 mb-8">The page you're looking for doesn't exist.</p>
        <Link
          href="/"
          className="rounded-xl bg-[var(--color-primary)] px-8 py-3 text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
