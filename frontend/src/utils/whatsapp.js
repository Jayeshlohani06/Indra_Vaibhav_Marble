// "Share on WhatsApp" links. They open WhatsApp with the message typed in;
// the person still presses Send. No WhatsApp account or API is needed.

// 10-digit Indian mobile numbers get the 91 country code.
export function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

// Without a number, WhatsApp asks which chat to send to.
export function whatsappLink(phone, text) {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function openWhatsapp(phone, text) {
  window.open(whatsappLink(phone, text), "_blank", "noopener,noreferrer");
}
