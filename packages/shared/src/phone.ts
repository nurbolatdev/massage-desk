import { type CountryCode, parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Country used for numbers typed without "+" (same default as the API). */
export const DEFAULT_PHONE_REGION = "UZ" satisfies CountryCode;

export type PhoneRegion = CountryCode;

const E164 = /^\+[0-9]{9,15}$/;

/**
 * Digits 0-9, Arabic-Indic (U+0660-0669), Extended Arabic-Indic (U+06F0-06F9) and fullwidth
 * (U+FF10-FF19), plain spaces and the separators + - ( ) . ; nothing else. The same set is used
 * in the API, because the two libraries map different digit scripts.
 */
const ALLOWED_CHARACTERS = /^[0-9\u0660-\u0669\u06F0-\u06F9\uFF10-\uFF19 +\-().]+$/;

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
