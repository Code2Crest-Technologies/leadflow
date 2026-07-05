"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>;
}

export function DownloadIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Icon>;
}

export function MessageCircleIcon(props: IconProps) {
  return <Icon {...props}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-4.2-1L3 20l1.2-4.5A8.5 8.5 0 1 1 21 11.5Z" /></Icon>;
}

export function PencilIcon(props: IconProps) {
  return <Icon {...props}><path d="m18 2 4 4-13 13-5 1 1-5Z" /><path d="m15 5 4 4" /></Icon>;
}

export function TrashIcon(props: IconProps) {
  return <Icon {...props}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6 18 20H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></Icon>;
}

export function CreditCardIcon(props: IconProps) {
  return <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M7 15h4" /></Icon>;
}

export function CheckCircleIcon(props: IconProps) {
  return <Icon {...props}><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m9 11 3 3L22 4" /></Icon>;
}

export function LayoutDashboardIcon(props: IconProps) {
  return <Icon {...props}><rect x="3" y="3" width="7" height="8" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /></Icon>;
}

export function UsersIcon(props: IconProps) {
  return <Icon {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></Icon>;
}

export function MessageSquareIcon(props: IconProps) {
  return <Icon {...props}><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></Icon>;
}

export function KanbanSquareIcon(props: IconProps) {
  return <Icon {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 7v10" /><path d="M12 7v6" /><path d="M16 7v8" /></Icon>;
}

export function CheckSquareIcon(props: IconProps) {
  return <Icon {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-5" /></Icon>;
}

export function FileTextIcon(props: IconProps) {
  return <Icon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></Icon>;
}

export function ReceiptIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></Icon>;
}

export function BarChart3Icon(props: IconProps) {
  return <Icon {...props}><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></Icon>;
}

export function UserCogIcon(props: IconProps) {
  return <Icon {...props}><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h3" /><circle cx="17" cy="17" r="3" /><path d="M17 13v1" /><path d="M17 20v1" /><path d="M13 17h1" /><path d="M20 17h1" /></Icon>;
}

export function Building2Icon(props: IconProps) {
  return <Icon {...props}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" /><path d="M6 12H4a2 2 0 0 0-2 2v8" /><path d="M18 9h2a2 2 0 0 1 2 2v11" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></Icon>;
}

export function LogOutIcon(props: IconProps) {
  return <Icon {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Icon>;
}

export function MailIcon(props: IconProps) {
  return <Icon {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Icon>;
}

export function LockIcon(props: IconProps) {
  return <Icon {...props}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icon>;
}

export function EyeIcon(props: IconProps) {
  return <Icon {...props}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Icon>;
}

export function EyeOffIcon(props: IconProps) {
  return <Icon {...props}><path d="m3 3 18 18" /><path d="M10.6 10.6A3 3 0 0 0 13.4 13.4" /><path d="M9.9 5.2A9.4 9.4 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.5 3.5" /><path d="M6.6 6.6C3.6 8.6 2 12 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4.2-.9" /></Icon>;
}

export function ArrowLeftIcon(props: IconProps) {
  return <Icon {...props}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></Icon>;
}
