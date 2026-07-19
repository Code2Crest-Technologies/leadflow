'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { AuthService } from '@/services';
import { useAuthStore } from '@/store';
import type { User } from '@/types';
import {
  BarChart3Icon,
  Building2Icon,
  CheckSquareIcon,
  FileTextIcon,
  CreditCardIcon,
  KanbanSquareIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessageSquareIcon,
  ReceiptIcon,
  UserCogIcon,
  UsersIcon,
} from '@/components/ui/Icons';

const nav = [
  { label: 'Overview', icon: LayoutDashboardIcon, href: '/dashboard', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Contacts', icon: UsersIcon, href: '/dashboard/contacts', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Messages', icon: MessageSquareIcon, href: '/dashboard/messages', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Pipeline', icon: KanbanSquareIcon, href: '/dashboard/pipeline', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Tasks', icon: CheckSquareIcon, href: '/dashboard/tasks', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Quotations', icon: FileTextIcon, href: '/dashboard/quotations', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Invoices', icon: ReceiptIcon, href: '/dashboard/invoices', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Forms', icon: FileTextIcon, href: '/dashboard/forms', roles: ['ADMIN', 'MANAGER', 'AGENT', 'SALES'] },
  { label: 'Analytics', icon: BarChart3Icon, href: '/dashboard/analytics', roles: ['ADMIN', 'MANAGER'] },
  { label: 'Team', icon: UserCogIcon, href: '/dashboard/team', roles: ['ADMIN'] },
  { label: 'Company', icon: Building2Icon, href: '/dashboard/company', roles: ['ADMIN'] },
  { label: 'Integrations', icon: CreditCardIcon, href: '/dashboard/integrations', roles: ['ADMIN'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const hydrateAuth = useAuthStore((state) => state.hydrate);
  const storeUser = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) {
      router.replace('/login');
      return;
    }
    hydrateAuth();
  }, [hydrateAuth, router]);

  useEffect(() => {
    setUser(storeUser || AuthService.getUser());
  }, [storeUser]);

  useEffect(() => {
    setProfileOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function navigateTo(path: string) {
    setProfileOpen(false);
    router.push(path);
  }

  function logout() {
    setProfileOpen(false);
    AuthService.logout();
    router.replace('/login');
  }

  const role = (user?.role || storeUser?.role || 'AGENT') as 'ADMIN' | 'MANAGER' | 'AGENT' | 'SALES';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Loading...';
  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U' : 'U';
  const visibleNav = nav.filter((item) => item.roles.includes(role));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-bg)] lg:flex">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[var(--color-primary)] px-4 text-white lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-3 font-bold">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white">
            <Image src="/icon.png" alt="LeadFlow" width={36} height={36} className="h-8 w-8 object-contain" priority />
          </span>
          LeadFlow
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl font-bold"
          aria-label="Open navigation"
        >
          =
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative flex h-full w-[82vw] max-w-xs flex-col bg-[var(--color-primary)] p-4 text-white shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <Link href="/dashboard" className="flex items-center gap-3 font-bold">
                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white">
                  <Image src="/icon.png" alt="LeadFlow" width={40} height={40} className="h-9 w-9 object-contain" priority />
                </span>
                LeadFlow
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
                aria-label="Close navigation"
              >
                X
              </button>
            </div>
            <nav className="no-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
              {visibleNav.map(({ label, icon: NavIcon, href }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
                      active ? 'bg-white text-[var(--color-primary)]' : 'text-white/90 hover:bg-white/15'
                    }`}
                  >
                    <NavIcon className="h-5 w-5 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-white/20 pt-4">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-white/70">{user?.email}</p>
              <div className="mt-3 grid gap-2">
                <button type="button" onClick={() => navigateTo('/dashboard/profile')} className="rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white">
                  Profile
                </button>
                {role === 'ADMIN' && (
                  <button type="button" onClick={() => navigateTo('/dashboard/company')} className="rounded-xl bg-white/10 px-3 py-2 text-left text-sm font-semibold text-white">
                    Company Settings
                  </button>
                )}
              </div>
              <button type="button" onClick={logout} className="mt-3 flex items-center gap-2 text-sm font-semibold text-white">
                <LogOutIcon className="h-4 w-4" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="group/sidebar z-40 hidden bg-[var(--color-primary)] text-white lg:fixed lg:inset-y-0 lg:flex lg:w-[84px] lg:flex-col lg:overflow-hidden lg:transition-all lg:duration-300 lg:hover:w-[260px]">
        <div className="flex h-16 items-center justify-between px-4 lg:h-20 lg:justify-start lg:gap-3">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 text-lg font-bold text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <Image src="/icon.png" alt="LeadFlow" width={40} height={40} className="h-9 w-9 object-contain" priority />
            </span>
            <span className="hidden whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 lg:block">Lead <span className="text-white/80">Flow</span></span>
            <span className="lg:hidden">Lead <span className="text-white/80">Flow</span></span>
          </Link>
          <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold text-white lg:ml-auto lg:opacity-0 lg:transition-opacity lg:duration-200 lg:group-hover/sidebar:opacity-100">LIVE</span>
        </div>

        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-2 lg:overflow-y-auto lg:overflow-x-hidden lg:px-0 lg:pb-24">
          {visibleNav.map(({ label, icon: NavIcon, href }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`group/item relative mx-auto flex h-12 w-auto items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold transition lg:w-12 lg:gap-0 lg:px-0 lg:group-hover/sidebar:w-[220px] lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-3 ${
                    active ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'text-white/90 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  <NavIcon className="h-5 w-5 shrink-0" />
                  <span className="whitespace-nowrap lg:hidden">{label}</span>
                  <span className="hidden whitespace-nowrap lg:group-hover/sidebar:inline">{label}</span>
                </Link>
              );
            })}
        </nav>

        <div className="hidden lg:absolute lg:bottom-0 lg:left-0 lg:right-0 lg:block lg:border-t lg:border-white/20 lg:bg-[var(--color-primary)] lg:p-3">
          <div ref={profileRef} className="relative">
            {profileOpen && (
              <div className="absolute bottom-14 left-0 w-56 rounded-2xl border border-[var(--color-border)] bg-white p-2 text-[var(--color-text)] shadow-lg">
              <button type="button" onClick={() => navigateTo('/dashboard/profile')} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50">Profile</button>
                <button type="button" onClick={() => navigateTo('/dashboard/company')} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50">Company Settings</button>
                <button type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                  <LogOutIcon className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="mx-auto flex h-12 w-12 items-center justify-center gap-0 rounded-2xl bg-white/10 px-0 text-left transition hover:bg-white/15 lg:group-hover/sidebar:w-full lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-2"
              aria-expanded={profileOpen}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[var(--color-primary)]">{initials}</span>
              <span className="hidden min-w-0 lg:group-hover/sidebar:block">
                <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
                <span className="block truncate text-xs text-white/75">{user?.email}</span>
              </span>
            </button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:ml-[84px]">{children}</div>
    </div>
  );
}
