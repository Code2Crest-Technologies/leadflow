import Link from 'next/link';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-sm font-bold text-white">LF</div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-emerald-700">Managed access</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Public signup is disabled</h1>
        <p className="mt-3 text-sm text-slate-500">
          Company Admin creates users from the Team page. Sub users login using credentials or an invite link when that flow is enabled.
        </p>
        <Link href="/login" className="btn-primary mt-6 w-full">Back to login</Link>
      </section>
    </main>
  );
}
