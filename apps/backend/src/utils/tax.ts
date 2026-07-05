export type TaxBreakdown = {
  label: 'CGST_SGST' | 'IGST' | 'TAX_VAT' | 'NONE';
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxVatAmount: number;
  totalTax: number;
};

export function normalizeCountry(value?: string | null) {
  return (value || 'India').trim().toLowerCase();
}

export function normalizeState(value?: string | null) {
  return (value || '').trim().toLowerCase().replace(/[\s.-]/g, '');
}

export function isIndia(value?: string | null) {
  const country = normalizeCountry(value);
  return country === 'india' || country === 'in';
}

export function isTamilNadu(value?: string | null) {
  const state = normalizeState(value);
  return state === 'tn' || state === 'tamilnadu';
}

export function calculateTaxBreakdown({
  subtotal,
  taxPercent,
  companyCountry,
  companyState,
  customerCountry,
  customerState,
}: {
  subtotal: unknown;
  taxPercent: unknown;
  companyCountry?: string | null;
  companyState?: string | null;
  customerCountry?: string | null;
  customerState?: string | null;
}): TaxBreakdown {
  const totalTax = Number(subtotal || 0) * (Number(taxPercent || 0) / 100);
  if (!totalTax) {
    return { label: 'NONE', cgstAmount: 0, sgstAmount: 0, igstAmount: 0, taxVatAmount: 0, totalTax: 0 };
  }

  if (isIndia(companyCountry) && isIndia(customerCountry)) {
    if (isTamilNadu(companyState) && isTamilNadu(customerState)) {
      return {
        label: 'CGST_SGST',
        cgstAmount: totalTax / 2,
        sgstAmount: totalTax / 2,
        igstAmount: 0,
        taxVatAmount: 0,
        totalTax,
      };
    }
    return { label: 'IGST', cgstAmount: 0, sgstAmount: 0, igstAmount: totalTax, taxVatAmount: 0, totalTax };
  }

  return { label: 'TAX_VAT', cgstAmount: 0, sgstAmount: 0, igstAmount: 0, taxVatAmount: totalTax, totalTax };
}
