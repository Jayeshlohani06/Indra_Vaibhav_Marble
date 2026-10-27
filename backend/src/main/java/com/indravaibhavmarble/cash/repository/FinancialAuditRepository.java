package com.indravaibhavmarble.cash.repository;

import com.indravaibhavmarble.cash.entity.FinancialAuditEntry;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialAuditRepository extends JpaRepository<FinancialAuditEntry, Long> {

    List<FinancialAuditEntry> findByEntityTypeAndEntityIdOrderByIdDesc(String entityType, Long entityId);

    List<FinancialAuditEntry> findTop200ByOrderByIdDesc();
}
