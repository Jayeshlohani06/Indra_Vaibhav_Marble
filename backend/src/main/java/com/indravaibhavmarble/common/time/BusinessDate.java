package com.indravaibhavmarble.common.time;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Business dates follow Indian Standard Time regardless of the server's
 * time zone (Render containers run in UTC).
 */
public final class BusinessDate {

    public static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private BusinessDate() {
    }

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }
}
