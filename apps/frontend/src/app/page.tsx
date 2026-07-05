import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/" className="flex items-center gap-3 font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-sm text-white">LF</span>
          LeadFlow
        </Link>
        <Link href="/login" className="btn-secondary">Login</Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-700">LeadFlow CRM</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            WhatsApp-focused CRM for small businesses
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-500">
            Capture leads, manage follow-ups, move deals through the pipeline, and generate quotations and invoices from one calm workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary h-12 px-6">Login</Link>
            <a href="mailto:hello@code2crest.com?subject=LeadFlow%20Demo%20Request" className="btn-secondary h-12 px-6">Request Demo</a>
          </div>
          <p className="mt-4 text-sm text-slate-500">Access is created by your company admin. No public signup required.</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <div className="rounded-2xl bg-[var(--color-bg)] p-5">
            <p className="text-sm font-semibold text-emerald-700">Today in LeadFlow</p>
            <div className="mt-4 grid gap-3">
              {['New lead captured', 'Follow-up task due', 'Quotation ready', 'Invoice payment pending'].map((item) => (
                <div key={item} className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-sm font-semibold">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-8 md:grid-cols-3">
        {[
          ['Features', 'Contacts, conversations, tasks, pipeline, quotations, invoices, and analytics.'],
          ['Workflow', 'Login, capture a contact, create a deal, follow up, quote, invoice, and track activity.'],
          ['Benefits', 'Simple operations, faster follow-up, cleaner billing, and better team visibility.'],
        ].map(([title, text]) => (
          <article key={title} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
