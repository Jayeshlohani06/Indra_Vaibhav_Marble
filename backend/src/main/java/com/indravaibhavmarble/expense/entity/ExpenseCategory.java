package com.indravaibhavmarble.expense.entity;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "expense_categories")
public class ExpenseCategory {
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 255)
    private String description;

    @Column(name = "category_type", nullable = false, length = 40)
    private String categoryType = "OPERATING";

    @Column(name = "group_name", nullable = false, length = 60)
    private String groupName = "Miscellaneous";

    /** SALARY or ADVANCE: expenses in this category need a staff member and month. */
    @Column(name = "staff_payment_type", length = 20)
    private String staffPaymentType;

    @Column(name = "requires_description", nullable = false)
    private boolean requiresDescription;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected ExpenseCategory() {}

    public static ExpenseCategory create() {
        return new ExpenseCategory();
    }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategoryType() { return categoryType; }
    public void setCategoryType(String categoryType) { this.categoryType = categoryType; }
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public String getStaffPaymentType() { return staffPaymentType; }
    public void setStaffPaymentType(String staffPaymentType) { this.staffPaymentType = staffPaymentType; }
    public boolean isRequiresDescription() { return requiresDescription; }
    public void setRequiresDescription(boolean requiresDescription) { this.requiresDescription = requiresDescription; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
