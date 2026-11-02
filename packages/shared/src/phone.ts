import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Country used for numbers typed without "+" (same default as the API). */
export const DEFAULT_PHONE_REGION = "UZ" satisfies CountryCode;

export type PhoneRegion = CountryCode;

const E164 = /^\+[0-9]{9,15}$/;

/** Digits (any script), plain spaces and the separators + - ( ) . ; nothing else. */
const ALLOWED_CHARACTERS = /^[\p{Nd} +\-().]+$/u;

/**
 * Normalizes a typed phone number to E.164 ("+998901234567").
 * Input starting with "+" is international; otherwise it is read as a number
 * of `defaultRegion`. Only valid numbers are accepted; input with letters or other
 * characters, and numbers with an extension, give null.
 * Same rules as the API's `PhoneNumbers`; both are checked against
 * `fixtures/phones.json`.
 *
 * Not for WhatsApp ids (digits without "+", always international): convert
 * them with `"+" + waId` first.
 */
export function normalizePhone(
  input: string,
  defaultRegion: PhoneRegion = DEFAULT_PHONE_REGION,
): string | null {
  if (!ALLOWED_CHARACTERS.test(input)) return null;
  const parsed = parsePhoneNumberFromString(input, defaultRegion);
  if (!parsed?.isValid() || parsed.ext) return null;
  return E164.test(parsed.number) ? parsed.number : null;
}

/** Digits only, the format wa.me links and the WhatsApp API expect. */
export function toWhatsAppId(phoneE164: string): string {
  return phoneE164.replace(/\D/g, "");
}
