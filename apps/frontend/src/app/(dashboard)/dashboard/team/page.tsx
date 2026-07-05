"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import PasswordInput from "@/components/shared/PasswordInput";
import { LeadService } from "@/services";
import { AuthService } from "@/services/authService";
import type { User } from "@/types";
import { CheckCircleIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "AGENT",
};

const roleOptions = ["AGENT", "MANAGER", "ADMIN"] as const;
const statusOptions = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

function roleLabel(role: string) {
  return role === "AGENT" ? "SALES" : role;
}

function passwordIsStrong(password: string) {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function UserModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Team</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function TeamPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", role: "AGENT", status: "ACTIVE" });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = currentUser?.role === "ADMIN";

  useEffect(() => {
    setCurrentUser(AuthService.getUser());
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setError("");
    setLoading(true);
    try {
      setUsers((await LeadService.getUsers()) as User[]);
    } catch {
      setError("Could not load team members.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!passwordIsStrong(form.password)) {
      setError("Temporary password must be at least 8 characters and include uppercase, lowercase, number, and symbol.");
      return;
    }

    setMutatingId("create");
    try {
      await LeadService.createUser(form);
      setForm(emptyForm);
      setShowForm(false);
      setSuccess("User created successfully.");
      await load();
    } catch {
      setError("Could not create user. Check the email and temporary password.");
    } finally {
      setMutatingId("");
    }
  }

  function openEdit(user: User) {
    setError("");
    setSuccess("");
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status || "ACTIVE",
    });
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    setError("");
    setSuccess("");
    setMutatingId(editingUser.id);

    try {
      await LeadService.updateUser(editingUser.id, editForm);
      setEditingUser(null);
      setSuccess("User updated successfully.");
      await load();
    } catch {
      setError("Could not update user. Check admin safety rules and email uniqueness.");
    } finally {
      setMutatingId("");
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (!resetPasswordUser) return;
    setError("");
    setSuccess("");

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!passwordIsStrong(passwordForm.password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.");
      return;
    }

    setMutatingId(resetPasswordUser.id);
    try {
      await LeadService.resetUserPassword(resetPasswordUser.id, passwordForm.password);
      setResetPasswordUser(null);
      setPasswordForm({ password: "", confirmPassword: "" });
      setSuccess("Password reset successfully.");
    } catch {
      setError("Could not reset password.");
    } finally {
      setMutatingId("");
    }
  }

  async function toggleStatus(user: User) {
    setError("");
    setSuccess("");
    setMutatingId(user.id);
    try {
      await LeadService.updateUser(user.id, { status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      setSuccess(user.status === "ACTIVE" ? "User deactivated." : "User activated.");
      await load();
    } catch {
      setError("Could not update user status. Admin safety rules may have blocked this action.");
    } finally {
      setMutatingId("");
    }
  }

  async function confirmDelete() {
    if (!deleteUser) return;
    setError("");
    setSuccess("");
    setMutatingId(deleteUser.id);
    try {
      const response = await LeadService.deleteUser(deleteUser.id);
      setDeleteUser(null);
      setSuccess(response.message || "User deactivated.");
      await load();
    } catch {
      setError("Could not delete/deactivate user. Admin safety rules may have blocked this action.");
    } finally {
      setMutatingId("");
    }
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-red-500">Access denied</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Team management is admin only.</h1>
          <p className="mt-2 text-slate-500">Ask an admin to manage users and permissions.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            User Management
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Team</h1>
          <p className="mt-1 text-slate-500">Create users, assign roles, reset passwords, and control access.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={Boolean(mutatingId)}
          className="btn-primary"
        >
          <PlusIcon className="h-4 w-4" />
          Create user
        </button>
      </header>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {success && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p>}

      {showForm && (
        <UserModal
          title="Create user"
          onClose={() => {
            setShowForm(false);
            setForm(emptyForm);
          }}
        >
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input-field" placeholder="First name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required disabled={Boolean(mutatingId)} />
              <input className="input-field" placeholder="Last name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required disabled={Boolean(mutatingId)} />
            </div>
            <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required disabled={Boolean(mutatingId)} />
            <PasswordInput placeholder="Temporary password" value={form.password} onChange={(password) => setForm({ ...form, password })} required minLength={8} disabled={Boolean(mutatingId)} />
            <select className="input-field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} disabled={Boolean(mutatingId)}>
              {roleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
            <p className="text-sm text-slate-500">Use a temporary password with uppercase, lowercase, number, and symbol. The user can sign in immediately after creation.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                }}
                className="btn-secondary"
                disabled={Boolean(mutatingId)}
              >
                Cancel
              </button>
              <button className="btn-primary" disabled={Boolean(mutatingId)}>
                {mutatingId === "create" ? "Saving..." : "Save user"}
              </button>
            </div>
          </form>
        </UserModal>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.2fr_1.4fr_0.7fr_0.7fr_1.7fr] gap-4 bg-slate-50 px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading team...</p>
        ) : users.length ? (
          users.map((user) => (
            <article key={user.id} className="grid gap-3 border-t border-slate-100 px-6 py-4 md:grid-cols-[1.2fr_1.4fr_0.7fr_0.7fr_1.7fr] md:items-center">
              <div>
                <p className="font-semibold text-slate-900">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-slate-500">{user.lastLoginAt ? `Last login ${new Date(user.lastLoginAt).toLocaleString("en-IN")}` : "No login yet"}</p>
              </div>
              <p className="break-all text-sm text-slate-600">{user.email}</p>
              <span className="text-sm font-semibold text-slate-700">{roleLabel(user.role)}</span>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {user.status || "ACTIVE"}
              </span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openEdit(user)} disabled={Boolean(mutatingId)} className="btn-secondary h-9 px-3"><PencilIcon className="h-4 w-4" />Edit</button>
                <button type="button" onClick={() => { setResetPasswordUser(user); setPasswordForm({ password: "", confirmPassword: "" }); }} disabled={Boolean(mutatingId)} className="btn-secondary h-9 px-3">Reset Password</button>
                <button type="button" onClick={() => toggleStatus(user)} disabled={Boolean(mutatingId)} className="btn-secondary h-9 px-3"><CheckCircleIcon className="h-4 w-4" />{user.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                <button type="button" onClick={() => setDeleteUser(user)} disabled={Boolean(mutatingId)} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600 disabled:opacity-50"><TrashIcon className="h-4 w-4" />Delete</button>
              </div>
            </article>
          ))
        ) : (
          <p className="p-8 text-center text-slate-500">No team members found.</p>
        )}
      </section>

      {editingUser && (
        <UserModal title={`Edit ${editingUser.firstName}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={saveEdit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input-field" placeholder="First name" value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} required disabled={Boolean(mutatingId)} />
              <input className="input-field" placeholder="Last name" value={editForm.lastName} onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })} required disabled={Boolean(mutatingId)} />
            </div>
            <input className="input-field" type="email" placeholder="Email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required disabled={Boolean(mutatingId)} />
            <div className="grid gap-4 md:grid-cols-2">
              <select className="input-field" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })} disabled={Boolean(mutatingId)}>
                {roleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
              <select className="input-field" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })} disabled={Boolean(mutatingId)}>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary" disabled={Boolean(mutatingId)}>Cancel</button>
              <button className="btn-primary" disabled={Boolean(mutatingId)}>{mutatingId ? "Saving..." : "Save changes"}</button>
            </div>
          </form>
        </UserModal>
      )}

      {resetPasswordUser && (
        <UserModal title={`Reset password for ${resetPasswordUser.firstName}`} onClose={() => setResetPasswordUser(null)}>
          <form onSubmit={savePassword} className="grid gap-4">
            <PasswordInput placeholder="New password" value={passwordForm.password} onChange={(password) => setPasswordForm({ ...passwordForm, password })} required minLength={8} disabled={Boolean(mutatingId)} />
            <PasswordInput placeholder="Confirm password" value={passwordForm.confirmPassword} onChange={(confirmPassword) => setPasswordForm({ ...passwordForm, confirmPassword })} required minLength={8} disabled={Boolean(mutatingId)} />
            <p className="text-sm text-slate-500">Use at least 8 characters with uppercase, lowercase, number, and symbol.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetPasswordUser(null)} className="btn-secondary" disabled={Boolean(mutatingId)}>Cancel</button>
              <button className="btn-primary" disabled={Boolean(mutatingId)}>{mutatingId ? "Saving..." : "Reset password"}</button>
            </div>
          </form>
        </UserModal>
      )}

      {deleteUser && (
        <UserModal title="Delete user?" onClose={() => setDeleteUser(null)}>
          <p className="text-slate-600">
            This user will no longer be able to access LeadFlow. Historical records will remain.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteUser(null)} className="btn-secondary" disabled={Boolean(mutatingId)}>Cancel</button>
            <button type="button" onClick={confirmDelete} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={Boolean(mutatingId)}>
              <TrashIcon className="h-4 w-4" />
              {mutatingId ? "Deleting..." : "Delete / Deactivate"}
            </button>
          </div>
        </UserModal>
      )}
    </main>
  );
}
