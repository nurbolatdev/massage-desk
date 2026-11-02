package com.massagedesk.api.clients;

import com.google.i18n.phonenumbers.NumberParseException;
import com.google.i18n.phonenumbers.PhoneNumberUtil;
import com.google.i18n.phonenumbers.Phonenumber.PhoneNumber;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Phone number rules. Same rules as {@code normalizePhone} in the shared TypeScript package,
 * checked against the shared fixture {@code packages/shared/fixtures/phones.json}; keep both in sync.
 *
 * <p>Not for WhatsApp ids: they are digits without a plus and always international, so convert
 * them with {@code "+" + waId} first.
 */
public final class PhoneNumbers {

    private static final Pattern E164 = Pattern.compile("^\\+[0-9]{9,15}$");

    /**
     * Digits 0-9, Arabic-Indic (U+0660-0669), Extended Arabic-Indic (U+06F0-06F9) and fullwidth
     * (U+FF10-FF19), plain spaces and the separators {@code + - ( ) .}; nothing else. The same set
     * is used in the shared TypeScript package, because the two libraries map different digit scripts.
     */
    private static final Pattern ALLOWED_CHARACTERS =
            Pattern.compile("^[0-9\\u0660-\\u0669\\u06F0-\\u06F9\\uFF10-\\uFF19 +\\-().]+$");

    private PhoneNumbers() {
    }

    /**
     * Parses the input (read in {@code defaultRegion} when it has no plus sign), accepts only valid
     * numbers and returns them in E.164 form. Input with letters or other characters, and numbers
     * with an extension, are refused.
     */
    public static Optional<String> normalize(String input, String defaultRegion) {
        if (input == null || input.isBlank()) {
            return Optional.empty();
        }
        if (!ALLOWED_CHARACTERS.matcher(input).matches()) {
            return Optional.empty();
        }
        PhoneNumberUtil util = PhoneNumberUtil.getInstance();
        try {
            PhoneNumber number = util.parse(input, defaultRegion);
            if (number.hasExtension() || !util.isValidNumber(number)) {
                return Optional.empty();
            }
            String e164 = util.format(number, PhoneNumberUtil.PhoneNumberFormat.E164);
            return isE164(e164) ? Optional.of(e164) : Optional.empty();
        } catch (NumberParseException e) {
            return Optional.empty();
        }
    }

    public static boolean isE164(String phone) {
        return phone != null && E164.matcher(phone).matches();
    }
}
