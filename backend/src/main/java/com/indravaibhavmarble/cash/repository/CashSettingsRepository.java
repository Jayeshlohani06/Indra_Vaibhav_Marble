package com.indravaibhavmarble.cash.repository;

import com.indravaibhavmarble.cash.entity.CashSettings;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface CashSettingsRepository extends JpaRepository<CashSettings, Short> {

    /** Shared lock: many money entries at once, but never during a closing. */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("SELECT s FROM CashSettings s WHERE s.id = 1")
    CashSettings lockForEntry();

    /** Exclusive lock: one opening, closing or reopening at a time. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM CashSettings s WHERE s.id = 1")
    CashSettings lockForClosing();
}
