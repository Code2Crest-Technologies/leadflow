type WhatsAppContact = {
  firstName?: string;
  phoneNumber?: string;
};

export function openWhatsApp(contact: WhatsAppContact, message: string) {
  const phone = (contact.phoneNumber || '').replace(/\D/g, '');
  if (!phone) return;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}
