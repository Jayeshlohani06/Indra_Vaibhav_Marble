package com.indravaibhavmarble.cash.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "financial_audit_log")
public class FinancialAuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(nullable = false, length = 40)
    private String action;

    private String actor;

    @Column(name = "occurred_at", insertable = false, updatable = false)
    private OffsetDateTime occurredAt;

    @Column(length = 1000)
    private String reason;

    @Column(name = "before_state", columnDefinition = "TEXT")
    private String beforeState;

    @Column(name = "after_state", columnDefinition = "TEXT")
    private String afterState;

    protected FinancialAuditEntry() {
    }

    public FinancialAuditEntry(String entityType, Long entityId, String action, String actor,
            String reason, String beforeState, String afterState) {
        this.entityType = entityType;
        this.entityId = entityId;
        this.action = action;
        this.actor = actor;
        this.reason = reason;
        this.beforeState = beforeState;
        this.afterState = afterState;
    }

    public Long getId() { return id; }
    public String getEntityType() { return entityType; }
    public Long getEntityId() { return entityId; }
    public String getAction() { return action; }
    public String getActor() { return actor; }
    public OffsetDateTime getOccurredAt() { return occurredAt; }
    public String getReason() { return reason; }
    public String getBeforeState() { return beforeState; }
    public String getAfterState() { return afterState; }
}
