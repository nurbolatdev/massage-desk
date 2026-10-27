/**
 * Normalizes a phone number to E.164 ("+998901234567").
 * WhatsApp sends numbers without "+", people type them with spaces and dashes.
 * Returns null when the input cannot be a phone number.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Digits only, the format wa.me links and the WhatsApp API expect. */
export function toWhatsAppId(phoneE164: string): string {
  return phoneE164.replace(/\D/g, "");
}
