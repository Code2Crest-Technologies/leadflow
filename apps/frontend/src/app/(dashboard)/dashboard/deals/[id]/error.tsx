"use client";

export default function DealDetailsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen p-5 lg:p-10">
      <div className="rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">Deal Workspace</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Something went wrong</h1>
        <p className="mt-2 text-slate-500">Refresh this workspace and try again.</p>
        <button type="button" onClick={reset} className="mt-5 btn-primary">
          Retry
        </button>
      </div>
    </main>
  );
}
