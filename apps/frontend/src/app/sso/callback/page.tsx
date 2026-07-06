"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthService } from "@/services";

function SsoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      router.replace("/login?error=sso_missing");
      return;
    }
    const ssoToken = token;

    async function completeLogin() {
      try {
        await AuthService.completeSso(ssoToken);
        router.replace("/dashboard");
        router.refresh();
      } catch {
        setError("SSO login failed. Please request a fresh login from Code2Crest Unified Portal.");
        router.replace("/login?error=sso_invalid");
      }
    }

    void completeLogin();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-5 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-sm font-bold text-white">LF</div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-emerald-700">Unified Portal</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Signing you in...</h1>
        <p className="mt-3 text-sm text-slate-500">Please wait while LeadFlow verifies your Code2Crest session.</p>
        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
            <Link href="/login" className="mt-3 block font-semibold underline">
              Back to login
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense fallback={null}>
      <SsoCallbackContent />
    </Suspense>
  );
}
