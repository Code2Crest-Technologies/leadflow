const COUNTRY_DIAL_CODES: Record<string, string> = {
  india: '91',
  in: '91',
  'united states': '1',
  us: '1',
  usa: '1',
  canada: '1',
  ca: '1',
  'united kingdom': '44',
  uk: '44',
  gb: '44',
};

function countryDialCode(country?: string | null) {
  if (!country) return undefined;
  return COUNTRY_DIAL_CODES[country.trim().toLowerCase()];
}

export function normalizePhoneToE164(phone: string, country?: string | null, phoneCountryCode?: string | null) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return `+${raw.replace(/\D/g, '')}`;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length > 10) return `+${digits}`;

  const explicitCode = phoneCountryCode?.replace(/\D/g, '');
  const countryCode = explicitCode || countryDialCode(country);
  return countryCode ? `+${countryCode}${digits}` : `+${digits}`;
}

export function whatsappRecipient(phone: string) {
  return normalizePhoneToE164(phone).replace(/\D/g, '');
}
