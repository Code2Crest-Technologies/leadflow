"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LeadService } from "@/services";
import type { Project } from "@/types";

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function clientName(project: Project) {
  const contact = project.contact;
  if (!contact) return "Client";
  return contact.contactType === "COMPANY" ? contact.companyName || contact.firstName : `${contact.firstName} ${contact.lastName || ""}`.trim();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  async function load(params?: Record<string, string>) {
    setLoading(true);
    setError("");
    try {
      setProjects(await LeadService.getProjects(params));
    } catch {
      setError("Could not load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((project) => project.status === "ACTIVE").length,
      kickoff: projects.filter((project) => project.status === "READY_FOR_KICKOFF").length,
      draft: projects.filter((project) => project.status === "DRAFT").length,
    }),
    [projects],
  );

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    load({ ...(search.trim() ? { search: search.trim() } : {}), ...(status ? { status } : {}) });
  }

  return (
    <main className="min-h-screen p-5 lg:p-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-700">Delivery Handoff</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Projects</h1>
          <p className="mt-1 text-slate-500">Track sales-to-kickoff readiness and handoff workspaces.</p>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Total", counts.total],
          ["Ready", counts.kickoff],
          ["Active", counts.active],
          ["Draft", counts.draft],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
            <p className="text-sm text-[var(--color-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-bold text-[var(--color-text)]">{value}</p>
          </div>
        ))}
      </section>

      <form onSubmit={submitFilters} className="mt-6 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm md:flex-row">
        <input
          className="input-field flex-1"
          placeholder="Search project, client, or deal..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="input-field md:w-64" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {["DRAFT", "READY_FOR_KICKOFF", "ACTIVE", "ON_HOLD", "CLIENT_REVIEW", "COMPLETED", "CANCELLED"].map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <button className="btn-primary justify-center" type="submit">Apply</button>
      </form>

      {error && <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-4 border-b border-[var(--color-border)] bg-slate-50 px-5 py-3 text-xs font-bold uppercase text-slate-500 max-lg:hidden">
          <span>Project</span>
          <span>Client</span>
          <span>Manager</span>
          <span>Status</span>
          <span>Target</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading projects...</div>
        ) : projects.length ? (
          <div className="divide-y divide-[var(--color-border)]">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
              >
                <div>
                  <p className="font-bold text-slate-950">{project.name}</p>
                  <p className="text-sm text-slate-500">{project.serviceType || "GENERAL"} · {project.deal?.title || "Deal"}</p>
                </div>
                <p className="text-sm font-semibold text-slate-700">{clientName(project)}</p>
                <p className="text-sm text-slate-600">
                  {project.projectManager ? `${project.projectManager.firstName} ${project.projectManager.lastName}` : "Unassigned"}
                </p>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{project.status}</span>
                <p className="text-sm text-slate-600">{formatDate(project.targetDate)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <h3 className="font-bold text-slate-950">No projects yet</h3>
            <p className="mt-2 text-sm text-slate-500">Create a project from a WON deal after onboarding is completed.</p>
          </div>
        )}
      </section>
    </main>
  );
}
