package com.massagedesk.api.clients;

import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Phone number rules. Same rules as {@code normalizePhone} in the shared TypeScript package;
 * keep both in sync.
 */
public final class PhoneNumbers {

    private static final Pattern E164 = Pattern.compile("^\\+[0-9]{9,15}$");

    private PhoneNumbers() {
    }

    /** Drops every non-digit, accepts 9..15 digits and returns them with a leading plus. */
    public static Optional<String> normalize(String input) {
        if (input == null) {
            return Optional.empty();
        }
        String digits = input.replaceAll("\\D", "");
        if (digits.length() < 9 || digits.length() > 15) {
            return Optional.empty();
        }
        return Optional.of("+" + digits);
    }

    public static boolean isE164(String phone) {
        return phone != null && E164.matcher(phone).matches();
    }
}
