package com.indravaibhavmarble.cash.service;

import com.indravaibhavmarble.cash.dto.CashMovementDtos.MovementRequest;
import com.indravaibhavmarble.cash.dto.CashMovementDtos.MovementResponse;
import com.indravaibhavmarble.cash.dto.CashMovementDtos.VoidRequest;
import com.indravaibhavmarble.cash.entity.CashMovement;
import com.indravaibhavmarble.cash.repository.CashMovementRepository;
import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import com.indravaibhavmarble.common.security.CurrentUser;
import com.indravaibhavmarble.common.time.BusinessDate;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cash put into or taken out of the drawer for reasons other than trading.
 * Corrections (adjustments) need the owner and a reason; nothing here is
 * ever created automatically to make a count match.
 */
@Service
@Transactional
public class CashMovementService {

    private static final String ENTITY = "CASH_MOVEMENT";

    private final CashMovementRepository repository;
    private final CashPeriodGuard periodGuard;
    private final FinancialAuditService auditService;

    public CashMovementService(CashMovementRepository repository, CashPeriodGuard periodGuard,
            FinancialAuditService auditService) {
        this.repository = repository;
        this.periodGuard = periodGuard;
        this.auditService = auditService;
    }

    public MovementResponse create(MovementRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Movement details are required.");
        }
        if (request.requestId() != null) {
            var existing = repository.findByRequestId(request.requestId());
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }
        String type = request.movementType() == null ? ""
                : request.movementType().trim().toUpperCase(Locale.ROOT);
        if (!CashMovement.INFLOW_TYPES.contains(type) && !CashMovement.OUTFLOW_TYPES.contains(type)) {
            throw new IllegalArgumentException("Choose what kind of cash movement this is.");
        }
        LocalDate date = request.movementDate() == null ? BusinessDate.today() : request.movementDate();
        if (date.isAfter(BusinessDate.today())) {
            throw new IllegalArgumentException("Date cannot be in the future.");
        }
        String notes = CashSessionService.trim(request.notes(), 500, "Notes");
        boolean adjustment = CashMovement.ADJUSTMENT_TYPES.contains(type);
        if (adjustment) {
            if (!CurrentUser.has("CASH_APPROVE")) {
                throw new AccessDeniedException("Only the owner can record a cash correction.");
            }
            if (notes == null || notes.length() < 5) {
                throw new IllegalArgumentException("Explain what this correction is for.");
            }
        }

        periodGuard.assertOpen(date);

        CashMovement movement = new CashMovement();
        movement.setMovementDate(date);
        movement.setMovementType(type);
        movement.setAmount(CashSessionService.money(request.amount(), "Amount", false));
        movement.setReferenceNumber(CashSessionService.trim(request.referenceNumber(), 100, "Reference"));
        movement.setNotes(notes);
        movement.setRequestId(request.requestId());
        movement.setCreatedBy(CurrentUser.name());
        movement.setApprovedBy(adjustment ? CurrentUser.name() : null);
        movement = repository.saveAndFlush(movement);
        MovementResponse response = toResponse(movement);
        auditService.record(ENTITY, movement.getId(), "CREATE", notes, null, response);
        return response;
    }

    public MovementResponse voidMovement(Long id, VoidRequest request) {
        CashMovement movement = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cash movement not found: " + id));
        if ("VOIDED".equals(movement.getStatus())) {
            throw new IllegalArgumentException("This movement is already cancelled.");
        }
        String reason = request == null ? null : CashSessionService.trim(request.reason(), 500, "Reason");
        if (reason == null) {
            throw new IllegalArgumentException("Give a reason for cancelling this movement.");
        }
        if (CashMovement.ADJUSTMENT_TYPES.contains(movement.getMovementType())
                && !CurrentUser.has("CASH_APPROVE")) {
            throw new AccessDeniedException("Only the owner can cancel a cash correction.");
        }
        periodGuard.assertOpen(movement.getMovementDate());

        MovementResponse before = toResponse(movement);
        movement.setStatus("VOIDED");
        movement.setVoidedBy(CurrentUser.name());
        movement.setVoidedAt(OffsetDateTime.now());
        movement.setVoidReason(reason);
        movement = repository.saveAndFlush(movement);
        MovementResponse after = toResponse(movement);
        auditService.record(ENTITY, movement.getId(), "VOID", reason, before, after);
        return after;
    }

    @Transactional(readOnly = true)
    public List<MovementResponse> list(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? BusinessDate.today() : to;
        LocalDate start = from == null ? end.minusDays(30) : from;
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("Start date cannot be after end date.");
        }
        return repository.findByMovementDateBetweenOrderByMovementDateDescIdDesc(start, end)
                .stream().map(CashMovementService::toResponse).toList();
    }

    private static MovementResponse toResponse(CashMovement movement) {
        return new MovementResponse(movement.getId(), movement.getMovementDate(),
                movement.getMovementType(), movement.getAmount(), movement.getReferenceNumber(),
                movement.getNotes(), movement.getStatus(), movement.getCreatedBy(),
                movement.getCreatedAt(), movement.getApprovedBy(), movement.getVoidedBy(),
                movement.getVoidedAt(), movement.getVoidReason());
    }
}
