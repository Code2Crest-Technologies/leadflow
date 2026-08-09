"use client";

import { FormEvent, useEffect, useState } from "react";
import { LeadService } from "@/services";
import type { DocumentTemplate, DocumentType } from "@/types";

const variableList = [
  "client_name",
  "client_company",
  "client_email",
  "client_phone",
  "project_name",
  "service_type",
  "deal_title",
  "quotation_number",
  "quotation_amount",
  "project_start_date",
  "project_target_date",
  "payment_terms",
  "company_name",
  "company_email",
  "company_website",
];

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "CUSTOM" as DocumentType,
    description: "",
    content: "<h1>{{project_name}}</h1>\n<p>Dear {{client_name}},</p>",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTemplates(await LeadService.getDocumentTemplates());
    } catch {
      setError("Could not load document templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createTemplate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await LeadService.createDocumentTemplate(form);
      setForm({ name: "", type: "CUSTOM", description: "", content: "<h1>{{project_name}}</h1>\n<p>Dear {{client_name}},</p>" });
      await load();
    } catch {
      setError("Could not create template. Admin access is required.");
    }
  }

  async function cloneTemplate(id: string) {
    setError("");
    try {
      await LeadService.cloneDocumentTemplate(id);
      await load();
    } catch {
      setError("Could not clone template.");
    }
  }

  return (
    <main className="min-h-screen p-5 lg:p-10">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-700">Document Settings</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Document Templates</h1>
        <p className="mt-1 text-slate-500">Manage reusable proposal, SOW, agreement, NDA, and custom templates.</p>
      </header>

      {error && <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={createTemplate} className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Create Custom Template</h2>
          <div className="mt-4 space-y-3">
            <input className="input-field" placeholder="Template name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <select className="input-field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as DocumentType })}>
              {["PROPOSAL", "STATEMENT_OF_WORK", "SERVICE_AGREEMENT", "NDA", "MAINTENANCE_AGREEMENT", "SAAS_SUBSCRIPTION_AGREEMENT", "CUSTOM"].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input className="input-field" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <textarea className="input-field min-h-56 font-mono text-sm" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
            <button className="btn-primary w-full justify-center">Create Template</button>
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800">Merge variables</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {variableList.map((variable) => (
                <code key={variable} className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">{`{{${variable}}}`}</code>
              ))}
            </div>
          </div>
        </form>

        <section className="rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="border-b border-[var(--color-border)] p-5">
            <h2 className="font-bold text-slate-950">Templates</h2>
            <p className="mt-1 text-sm text-slate-500">System templates should be cloned before customization. Legal templates need legal review before production use.</p>
          </div>
          {loading ? (
            <p className="p-6 text-slate-500">Loading templates...</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {templates.map((template) => (
                <article key={template.id} className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{template.type}</p>
                      <h3 className="mt-1 font-bold text-slate-950">{template.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{template.description || "No description"}</p>
                    </div>
                    <button className="btn-secondary" type="button" onClick={() => cloneTemplate(template.id)}>Clone</button>
                  </div>
                  <details className="mt-3 rounded-xl bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">Preview content</summary>
                    <pre className="mt-3 whitespace-pre-wrap text-xs text-slate-600">{template.content}</pre>
                  </details>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
