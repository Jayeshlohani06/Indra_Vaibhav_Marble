package com.indravaibhavmarble.common.util;

/**
 * Indian mobile numbers, stored as 10 digits. Spaces, dashes, a leading 0 or
 * a +91 / 91 country code are accepted on input and removed.
 */
public final class MobileNumbers {

    private MobileNumbers() {
    }

    /** The 10-digit number, or null when the text is not a valid Indian mobile number. */
    public static String normalize(String text) {
        if (text == null) return null;
        String digits = text.replaceAll("[\\s()+.-]", "");
        if (!digits.matches("\\d+")) return null;
        if (digits.length() == 12 && digits.startsWith("91")) digits = digits.substring(2);
        else if (digits.length() == 11 && digits.startsWith("0")) digits = digits.substring(1);
        return digits.matches("[6-9]\\d{9}") ? digits : null;
    }
}
