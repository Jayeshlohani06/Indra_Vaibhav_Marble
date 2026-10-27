package com.indravaibhavmarble.cash.service;

import com.indravaibhavmarble.cash.entity.FinancialAuditEntry;
import com.indravaibhavmarble.cash.repository.FinancialAuditRepository;
import com.indravaibhavmarble.common.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Writes the audit trail for money records in the same transaction as the
 * change, so a change and its audit entry are saved or rolled back together.
 */
@Service
public class FinancialAuditService {

    private final FinancialAuditRepository repository;
    private final JsonMapper jsonMapper;

    public FinancialAuditService(FinancialAuditRepository repository, JsonMapper jsonMapper) {
        this.repository = repository;
        this.jsonMapper = jsonMapper;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String entityType, Long entityId, String action, String reason,
            Object before, Object after) {
        repository.save(new FinancialAuditEntry(entityType, entityId, action, CurrentUser.name(),
                reason, toJson(before), toJson(after)));
    }

    private String toJson(Object value) {
        return value == null ? null : jsonMapper.writeValueAsString(value);
    }
}
