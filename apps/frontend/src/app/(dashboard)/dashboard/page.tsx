"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LeadService } from "@/services";
import { activityIcons, formatActivityMessage, type DashboardActivity } from "@/utils/activity";
import type { Task } from "@/types";
import { CheckCircleIcon, FileTextIcon, MessageSquareIcon, PlusIcon } from "@/components/ui/Icons";

type RecentMessage = {
  id: string;
  content: string;
  direction: "INBOUND" | "OUTBOUND" | string;
  status?: string | null;
  createdAt: string;
  contact?: {
    firstName: string;
    lastName?: string | null;
    phoneNumber?: string | null;
  } | null;
};

type Summary = {
  contacts: number;
  conversations: number;
  openDeals: number;
  messagesToday: number;
  todayTasks: number;
  overdueTasks: number;
  upcomingTasks: number;
  recentActivity: DashboardActivity[];
  recentMessages: RecentMessage[];
};

type MetricCard = {
  label: string;
  value: number;
  detail: string;
};

function formatPersonName(contact?: RecentMessage["contact"]) {
  const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ");
  return name || contact?.phoneNumber || "Unknown contact";
}

function messagePreview(message: RecentMessage) {
  const content = message.content?.trim();

  if (content) {
    return content.length > 78 ? `${content.slice(0, 78)}...` : content;
  }

  return message.direction === "INBOUND"
    ? "Incoming WhatsApp message received"
    : "CRM message created";
}

function formatDashboardTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const time = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date >= startOfToday) return `Today, ${time}`;
  if (date >= startOfYesterday) return `Yesterday, ${time}`;

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskUpdating, setTaskUpdating] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const summary = (await LeadService.getDashboard()) as Summary;
      const taskData = (await LeadService.getTasks()) as Task[];
      setData(summary);
      setTasks(taskData);
    } catch {
      setError("Could not load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cards: MetricCard[] = [
    {
      label: "Today's tasks",
      value: data?.todayTasks ?? 0,
      detail: "Follow-ups due before midnight",
    },
    {
      label: "Overdue tasks",
      value: data?.overdueTasks ?? 0,
      detail: "Pending follow-ups past due",
    },
    {
      label: "Upcoming tasks",
      value: data?.upcomingTasks ?? 0,
      detail: "Next 7 days of follow-ups",
    },
    {
      label: "Open deals",
      value: data?.openDeals ?? 0,
      detail: "Active sales opportunities",
    },
  ];
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const actionableTasks = tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
  const panelTasks = actionableTasks
    .filter((task) => {
      const due = new Date(task.dueDate);
      return due < tomorrowStart;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  async function completeTask(taskId: string) {
    setTaskUpdating(taskId);
    try {
      await LeadService.updateTaskStatus(taskId, "COMPLETED");
      setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status: "COMPLETED" } : task));
    } finally {
      setTaskUpdating("");
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Command center
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Good to see you.
          </h1>
          <p className="mt-1 text-slate-500">
            Here is what is moving across your pipeline.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/contacts" className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            Add Contact
          </Link>
          <Link href="/dashboard/pipeline?openForm=1" className="btn-secondary">
            <PlusIcon className="h-4 w-4" />
            Create Deal
          </Link>
          <Link href="/dashboard/tasks" className="btn-secondary">
            <CheckCircleIcon className="h-4 w-4" />
            Create Task
          </Link>
          <Link href="/dashboard/quotations" className="btn-secondary">
            <FileTextIcon className="h-4 w-4" />
            Create Quotation
          </Link>
        </div>
      </header>

      {error && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-red-700"
          role="alert"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="text-sm font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy={isLoading}
      >
        {cards.map(({ label, value, detail }) => (
          <article
            key={label}
            className="card border border-slate-100 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">
              {isLoading ? "..." : value.toLocaleString()}
            </p>
            <p className="mt-3 text-xs text-slate-400">{detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="shrink-0">
            <h2 className="text-lg font-bold text-slate-900">Recent activity</h2>
          </div>
          <div className="no-scrollbar mt-4 flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading activity...</p>
            ) : data?.recentActivity.length ? (
              <div className="divide-y">
                {data.recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-3 text-sm"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                      {activityIcons[item.eventType] || "EV"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-700">{formatActivityMessage(item)}</p>
                      <time dateTime={item.createdAt} className="mt-1 block text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No activity yet. Add a contact or create a deal to begin.
              </p>
            )}
          </div>
        </div>

        <div className="flex h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Recent Messages</h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest CRM and WhatsApp conversations.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              WhatsApp
            </span>
          </div>

          <div className="no-scrollbar mt-4 flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading messages...</p>
            ) : data?.recentMessages.length ? (
              <div className="space-y-4">
                {data.recentMessages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {formatPersonName(message.contact)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {messagePreview(message)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          message.direction === "INBOUND"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {message.direction}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <time dateTime={message.createdAt}>
                        {formatDashboardTime(message.createdAt)}
                      </time>
                      {message.status && (
                        <span className="rounded-full bg-white px-2.5 py-1 font-semibold uppercase text-slate-500">
                          {message.status}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No WhatsApp messages yet.
              </div>
            )}
          </div>

          <Link
            href="/dashboard/messages"
            className="btn-primary mt-4 shrink-0"
          >
            <MessageSquareIcon className="h-4 w-4" />
            View messages
          </Link>
        </div>

        <div className="flex h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Follow-up Todo</h2>
              <p className="mt-1 text-sm text-slate-500">Today and overdue tasks.</p>
            </div>
            <Link href="/dashboard/tasks" className="btn-secondary h-9 px-3 text-xs">
              <PlusIcon className="h-3.5 w-3.5" />
              Add task
            </Link>
          </div>
          <div className="no-scrollbar mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
            {panelTasks.length ? (
              panelTasks.map((task) => {
                const due = new Date(task.dueDate);
                const overdue = due < todayStart;
                return (
                  <article key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{task.title}</p>
                        <p className="mt-1 text-slate-500">{task.contact ? `${task.contact.firstName} ${task.contact.lastName || ""}` : "No contact"}</p>
                        <p className={`mt-2 text-xs font-semibold ${overdue ? "text-red-600" : "text-emerald-700"}`}>
                          {overdue ? "Overdue" : "Today"} - {due.toLocaleString("en-IN", { timeStyle: "short", dateStyle: "medium" })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => completeTask(task.id)}
                        disabled={taskUpdating === task.id}
                        className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Done
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No overdue or today tasks.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
