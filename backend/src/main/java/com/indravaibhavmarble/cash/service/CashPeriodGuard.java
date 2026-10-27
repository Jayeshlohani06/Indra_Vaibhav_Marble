package com.indravaibhavmarble.cash.service;

import com.indravaibhavmarble.cash.repository.CashSessionRepository;
import com.indravaibhavmarble.cash.repository.CashSettingsRepository;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refuses money entries dated on a closed day. Every payment, refund,
 * expense and drawer movement calls this before saving, inside its own
 * transaction, so the share lock holds until that entry is committed and a
 * closing cannot run in between.
 */
@Component
public class CashPeriodGuard {

    static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final CashSettingsRepository settingsRepository;
    private final CashSessionRepository sessionRepository;

    public CashPeriodGuard(CashSettingsRepository settingsRepository,
            CashSessionRepository sessionRepository) {
        this.settingsRepository = settingsRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void assertOpen(LocalDate date) {
        if (date == null) {
            return;
        }
        settingsRepository.lockForEntry();
        LocalDate lockedThrough = sessionRepository.findLockedThrough();
        if (lockedThrough != null && !date.isAfter(lockedThrough)) {
            throw new IllegalArgumentException("The cash book is closed up to "
                    + lockedThrough.format(DISPLAY_DATE) + ", so nothing can be recorded on "
                    + date.format(DISPLAY_DATE)
                    + ". Use a later date, or ask the owner to reopen that day.");
        }
    }
}
