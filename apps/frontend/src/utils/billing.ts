export const COUNTRIES = [
  { name: "India", phoneCode: "+91" },
  { name: "United States", phoneCode: "+1" },
  { name: "United Kingdom", phoneCode: "+44" },
  { name: "United Arab Emirates", phoneCode: "+971" },
  { name: "Australia", phoneCode: "+61" },
  { name: "Singapore", phoneCode: "+65" },
  { name: "Canada", phoneCode: "+1" },
  { name: "Germany", phoneCode: "+49" },
  { name: "France", phoneCode: "+33" },
  { name: "Malaysia", phoneCode: "+60" },
  { name: "Sri Lanka", phoneCode: "+94" },
  { name: "Saudi Arabia", phoneCode: "+966" },
  { name: "Qatar", phoneCode: "+974" },
  { name: "Oman", phoneCode: "+968" },
  { name: "Kuwait", phoneCode: "+965" },
] as const;

export const INDIAN_STATES = [
  "Tamil Nadu",
  "Kerala",
  "Karnataka",
  "Andhra Pradesh",
  "Telangana",
  "Maharashtra",
  "Delhi",
  "Gujarat",
  "Rajasthan",
  "Punjab",
  "Haryana",
  "Uttar Pradesh",
  "Madhya Pradesh",
  "West Bengal",
  "Odisha",
  "Bihar",
  "Jharkhand",
  "Assam",
  "Chhattisgarh",
  "Uttarakhand",
  "Goa",
  "Puducherry",
] as const;

export function defaultPhoneCode(country?: string) {
  return COUNTRIES.find((item) => item.name === country)?.phoneCode || "+91";
}

export function isIndia(country?: string | null) {
  return (country || "India").toLowerCase() === "india";
}

export function isTamilNadu(state?: string | null) {
  return (state || "").trim().toLowerCase().replace(/[\s.-]/g, "") === "tamilnadu";
}

export function calculateTaxBreakdown({
  subtotal,
  taxPercent,
  companyCountry,
  companyState,
  customerCountry,
  customerState,
}: {
  subtotal: number;
  taxPercent: number;
  companyCountry?: string | null;
  companyState?: string | null;
  customerCountry?: string | null;
  customerState?: string | null;
}) {
  const totalTax = subtotal * (taxPercent / 100);
  if (!totalTax) return { label: "NONE", cgst: 0, sgst: 0, igst: 0, taxVat: 0, totalTax: 0 };
  if (isIndia(companyCountry) && isIndia(customerCountry)) {
    if (isTamilNadu(companyState) && isTamilNadu(customerState)) {
      return { label: "CGST_SGST", cgst: totalTax / 2, sgst: totalTax / 2, igst: 0, taxVat: 0, totalTax };
    }
    return { label: "IGST", cgst: 0, sgst: 0, igst: totalTax, taxVat: 0, totalTax };
  }
  return { label: "TAX_VAT", cgst: 0, sgst: 0, igst: 0, taxVat: totalTax, totalTax };
}
