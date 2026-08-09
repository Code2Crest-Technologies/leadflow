"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LeadService } from "@/services";
import type { Project, User } from "@/types";

type Tab = "Overview" | "Brief" | "Team" | "Milestones" | "Tasks" | "Assets & Access" | "Documents" | "Commercial" | "Activity";
const tabs: Tab[] = ["Overview", "Brief", "Team", "Milestones", "Tasks", "Assets & Access", "Documents", "Commercial", "Activity"];

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function localDateValue(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function fullName(user?: Pick<User, "firstName" | "lastName"> | null) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "Unassigned";
}

export default function ProjectDetailsPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [managerId, setManagerId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("DEVELOPER");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [projectData, userData] = await Promise.all([LeadService.getProject(params.id), LeadService.getUsers()]);
      setProject(projectData);
      setUsers(userData);
      setManagerId(projectData.projectManagerId || "");
      setStartDate(localDateValue(projectData.startDate));
      setTargetDate(localDateValue(projectData.targetDate));
    } catch {
      setError("Could not load this project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  const commercial = useMemo(() => {
    const quote = project?.deal?.quotations?.[0];
    const agreement = project?.documents?.find((doc) => ["SERVICE_AGREEMENT", "STATEMENT_OF_WORK"].includes(doc.type));
    return {
      quotation: quote ? `${quote.quoteNumber} (${quote.status})` : "NOT_AVAILABLE",
      agreement: agreement ? `${agreement.type} (${agreement.status})` : "PENDING",
      advancePayment: "NOT_CONFIGURED",
    };
  }, [project]);

  async function saveDates(event: FormEvent) {
    event.preventDefault();
    setMutating(true);
    setError("");
    try {
      setProject(await LeadService.updateProject(params.id, {
        startDate: startDate ? new Date(startDate).toISOString() : null,
        targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      }));
    } catch {
      setError("Could not update project dates.");
    } finally {
      setMutating(false);
    }
  }

  async function assignManager(event: FormEvent) {
    event.preventDefault();
    setMutating(true);
    setError("");
    try {
      setProject(await LeadService.assignProject(params.id, { projectManagerId: managerId || null }));
    } catch {
      setError("Could not assign project manager.");
    } finally {
      setMutating(false);
    }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!memberId) return;
    setMutating(true);
    setError("");
    try {
      setProject(await LeadService.upsertProjectMember(params.id, { userId: memberId, role: memberRole }));
      setMemberId("");
    } catch {
      setError("Could not update project team.");
    } finally {
      setMutating(false);
    }
  }

  async function removeMember(memberIdToRemove: string) {
    if (!window.confirm("Remove this project member?")) return;
    setMutating(true);
    setError("");
    try {
      setProject(await LeadService.removeProjectMember(params.id, memberIdToRemove));
    } catch {
      setError("Could not remove project member.");
    } finally {
      setMutating(false);
    }
  }

  async function startProject() {
    setMutating(true);
    setError("");
    try {
      setProject(await LeadService.transitionProjectStatus(params.id, { status: "ACTIVE" }));
    } catch {
      setError("Could not start project. Ensure readiness is clean, manager is assigned, and start date is set.");
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen p-5 lg:p-10"><div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" /></main>;
  }

  if (!project) {
    return <main className="min-h-screen p-5 lg:p-10"><p className="rounded-2xl bg-red-50 p-4 text-red-700">{error || "Project not found."}</p></main>;
  }

  return (
    <main className="min-h-screen p-5 lg:p-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard/projects" className="text-sm font-semibold text-emerald-700">Back to projects</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{project.name}</h1>
          <p className="mt-1 text-slate-500">Kickoff, delivery handoff, and execution readiness workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">{project.status}</span>
          <button type="button" onClick={startProject} disabled={mutating || project.status === "ACTIVE"} className="btn-primary">
            Start Project
          </button>
        </div>
      </header>

      {error && <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Client</p>
          <p className="mt-2 font-bold text-slate-950">{project.contact?.companyName || `${project.contact?.firstName || ""} ${project.contact?.lastName || ""}`.trim()}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Service</p>
          <p className="mt-2 font-bold text-slate-950">{project.serviceType || "GENERAL"}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Project Manager</p>
          <p className="mt-2 font-bold text-slate-950">{fullName(project.projectManager)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-400">Target</p>
          <p className="mt-2 font-bold text-slate-950">{formatDate(project.targetDate)}</p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--color-border)] p-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "Overview" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <form onSubmit={saveDates} className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-950">Project Dates</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">Start Date<input className="input-field mt-2" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                  <label className="text-sm font-semibold text-slate-700">Target Date<input className="input-field mt-2" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
                </div>
                <button className="btn-primary mt-4" disabled={mutating}>Save Dates</button>
              </form>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <h3 className="font-bold">Sensitive access warning</h3>
                <p className="mt-2">Do not store passwords, OTPs, banking credentials, or secret API keys in LeadFlow. Use approved secure access-sharing methods.</p>
              </div>
            </div>
          )}

          {activeTab === "Brief" && (
            <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-800">{project.brief || "Project brief was not generated."}</pre>
          )}

          {activeTab === "Team" && (
            <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
              <div className="space-y-4">
                <form onSubmit={assignManager} className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="font-bold text-slate-950">Assign Project Manager</h3>
                  <select className="input-field mt-3" value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                    <option value="">Unassigned</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} - {user.role}</option>)}
                  </select>
                  <button className="btn-primary mt-3" disabled={mutating}>Save Manager</button>
                </form>
                <form onSubmit={addMember} className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="font-bold text-slate-950">Add Team Member</h3>
                  <select className="input-field mt-3" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                    <option value="">Choose user</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}
                  </select>
                  <select className="input-field mt-3" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                    {["PROJECT_MANAGER", "DEVELOPER", "DESIGNER", "QA", "SALES", "SUPPORT", "OTHER"].map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <button className="btn-primary mt-3" disabled={mutating || !memberId}>Add Member</button>
                </form>
              </div>
              <div className="grid gap-3">
                {project.members?.length ? project.members.map((member) => (
                  <article key={member.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">{member.user.firstName} {member.user.lastName}</p>
                      <p className="text-sm text-slate-500">{member.role} · {member.user.email}</p>
                    </div>
                    <button type="button" className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600" onClick={() => removeMember(member.id)} disabled={mutating}>Remove</button>
                  </article>
                )) : <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No project team assigned yet.</p>}
              </div>
            </div>
          )}

          {activeTab === "Milestones" && (
            <div className="grid gap-3 md:grid-cols-2">
              {project.milestones?.map((milestone) => (
                <article key={milestone.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-950">{milestone.sortOrder}. {milestone.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{milestone.status}</p>
                </article>
              ))}
            </div>
          )}

          {activeTab === "Tasks" && (
            <div className="grid gap-3 md:grid-cols-2">
              {project.tasks?.map((task) => (
                <article key={task.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-950">{task.title}</p>
                  <p className="mt-2 text-sm text-slate-500">{task.status} · Due {formatDate(task.dueDate)}</p>
                </article>
              ))}
            </div>
          )}

          {activeTab === "Assets & Access" && (
            <div className="grid gap-3 md:grid-cols-2">
              {project.requirements?.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">{item.type}</p>
                  <p className="mt-1 font-bold text-slate-950">{item.label}</p>
                  <p className="mt-2 text-sm text-slate-500">{item.status}</p>
                </article>
              ))}
            </div>
          )}

          {activeTab === "Documents" && (
            <div className="grid gap-3">
              {project.documents?.length ? project.documents.map((doc) => (
                <article key={doc.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-400">{doc.type}</p>
                      <p className="mt-1 font-bold text-slate-950">{doc.title}</p>
                      <p className="mt-1 text-sm text-slate-500">Version {doc.currentVersion?.versionNumber || 1} · Expires {formatDate(doc.expiresAt)}</p>
                    </div>
                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{doc.status}</span>
                  </div>
                </article>
              )) : (
                <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No project documents yet. Create documents from the linked deal workspace.</p>
              )}
            </div>
          )}

          {activeTab === "Commercial" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase text-slate-400">Quotation</p><p className="mt-2 font-bold">{commercial.quotation}</p></div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase text-slate-400">Agreement / SOW</p><p className="mt-2 font-bold">{commercial.agreement}</p></div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase text-slate-400">Advance Payment</p><p className="mt-2 font-bold">{commercial.advancePayment}</p></div>
            </div>
          )}

          {activeTab === "Activity" && (
            <div className="space-y-3">
              {project.activityLogs?.length ? project.activityLogs.map((activity) => (
                <article key={activity.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-950">{activity.eventType}</p>
                  <p className="mt-1 text-sm text-slate-500">{new Date(activity.createdAt).toLocaleString("en-IN")}</p>
                </article>
              )) : <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">No project activity yet.</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
