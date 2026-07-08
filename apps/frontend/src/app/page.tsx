import Link from 'next/link';
import {
  BarChart3Icon,
  CheckSquareIcon,
  FileTextIcon,
  KanbanSquareIcon,
  LockIcon,
  MessageSquareIcon,
  PlusIcon,
  UsersIcon,
} from '@/components/ui/Icons';

const features = [
  ['Meta + WhatsApp Inbox', 'Bring Facebook, Instagram, WhatsApp, and manual conversations into one unified sales inbox.', MessageSquareIcon],
  ['Lead Pipeline', 'Convert contacts into deals, track every stage, and keep open pipeline value consistent.', KanbanSquareIcon],
  ['Quotations & Invoices', 'Create professional GST-ready quotations, convert them to invoices, and download PDFs.', FileTextIcon],
  ['Follow-up Tasks', 'Schedule callbacks, reminders, and quotation follow-ups without losing context.', CheckSquareIcon],
  ['Team Roles', 'Admin, manager, and sales roles keep workspace access clean and production-ready.', UsersIcon],
  ['Analytics', 'See open deals, won revenue, lead sources, monthly sales, and conversion performance.', BarChart3Icon],
] as const;

const workflow = [
  'Meta/Facebook/Instagram/WhatsApp Lead',
  'Contact',
  'Deal',
  'Follow-up',
  'Quotation',
  'Invoice',
  'Payment',
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6">
        <Link href="/" className="flex items-center gap-3 font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-sm text-white">LF</span>
          LeadFlow
        </Link>
        <Link href="/login" className="btn-secondary inline-flex items-center gap-2">
          <LockIcon className="h-4 w-4" />
          Login
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700 shadow-sm">
            Meta & WhatsApp CRM for growing businesses
          </p>
          <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Capture Meta leads, manage WhatsApp conversations, and close deals faster.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--color-muted)]">
            LeadFlow brings WhatsApp, Facebook, Instagram, contacts, pipeline, quotations, invoices, and follow-ups into one sales workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary inline-flex h-12 items-center gap-2 px-6">
              <LockIcon className="h-4 w-4" />
              Login
            </Link>
            <a href="mailto:hello@code2crest.com?subject=LeadFlow%20Demo%20Request" className="btn-secondary inline-flex h-12 items-center gap-2 px-6">
              <MessageSquareIcon className="h-4 w-4" />
              Request Demo
            </a>
          </div>
          <p className="mt-4 text-sm text-[var(--color-muted)]">Access is created by your company admin or Code2Crest Hub. No public signup required.</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <div className="rounded-2xl bg-[var(--color-bg)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Live sales workspace</p>
                <h2 className="mt-2 text-2xl font-bold">Today in LeadFlow</h2>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Active</span>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ['Instagram lead captured', 'New website enquiry added to contacts'],
                ['WhatsApp reply received', 'Sales team can continue the conversation'],
                ['Quotation ready', 'GST-ready PDF can be sent to customer'],
                ['Invoice payment pending', 'Follow-up task scheduled for tomorrow'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(([title, text, Icon]) => (
            <article key={title} className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Workflow</p>
          <h2 className="mt-2 text-3xl font-bold">From social lead to paid invoice</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {workflow.map((step, index) => (
              <div key={step} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-[var(--color-primary)]">{index + 1}</span>
                <p className="mt-4 text-sm font-semibold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary)] p-8 text-white shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Ready to centralize your sales follow-up?</h2>
            <p className="mt-2 max-w-2xl text-white/75">Use LeadFlow to move every Meta and WhatsApp lead through contacts, deals, quotations, invoices, and payment follow-ups.</p>
          </div>
          <a href="mailto:hello@code2crest.com?subject=LeadFlow%20Demo%20Request" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-[var(--color-primary)]">
            <PlusIcon className="h-4 w-4" />
            Request Demo
          </a>
        </div>
      </section>
    </main>
  );
}
