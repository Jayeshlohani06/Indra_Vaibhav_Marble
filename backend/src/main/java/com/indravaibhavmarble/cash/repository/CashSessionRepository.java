package com.indravaibhavmarble.cash.repository;

import com.indravaibhavmarble.cash.entity.CashSession;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CashSessionRepository extends JpaRepository<CashSession, Long> {

    Optional<CashSession> findByBusinessDate(LocalDate businessDate);

    Optional<CashSession> findFirstByStatus(String status);

    Optional<CashSession> findFirstByOrderByBusinessDateDesc();

    Optional<CashSession> findFirstByBusinessDateLessThanOrderByBusinessDateDesc(LocalDate businessDate);

    /** Latest closed business date: money entries on or before it are locked. */
    @Query("SELECT MAX(s.businessDate) FROM CashSession s WHERE s.status = 'CLOSED'")
    LocalDate findLockedThrough();

    @Query("""
            SELECT s FROM CashSession s
            WHERE s.businessDate BETWEEN :from AND :to
            ORDER BY s.businessDate DESC
            """)
    List<CashSession> findInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
