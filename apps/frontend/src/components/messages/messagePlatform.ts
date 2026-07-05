export const MESSAGE_PLATFORMS = [
  { value: "MANUAL", label: "Manual", className: "bg-slate-100 text-slate-600" },
  { value: "WHATSAPP", label: "WhatsApp", className: "bg-emerald-50 text-emerald-700" },
  { value: "FACEBOOK", label: "Facebook", className: "bg-blue-50 text-blue-700" },
  { value: "INSTAGRAM", label: "Instagram", className: "bg-pink-50 text-pink-700" },
  { value: "LINKEDIN", label: "LinkedIn", className: "bg-sky-50 text-sky-700" },
  { value: "GOOGLE_MESSAGES", label: "Google Messages", className: "bg-amber-50 text-amber-700" },
] as const;

export type MessagePlatform = (typeof MESSAGE_PLATFORMS)[number]["value"];

export function getMessagePlatform(value?: string | null) {
  return MESSAGE_PLATFORMS.find((platform) => platform.value === value) || MESSAGE_PLATFORMS[0];
}
