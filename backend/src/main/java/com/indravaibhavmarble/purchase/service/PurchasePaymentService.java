
package com.indravaibhavmarble.purchase.service;

import com.indravaibhavmarble.cash.service.CashPeriodGuard;
import com.indravaibhavmarble.cash.service.FinancialAuditService;
import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import com.indravaibhavmarble.common.payment.ChangePaymentMethodRequest;
import com.indravaibhavmarble.common.security.CurrentUser;
import com.indravaibhavmarble.common.time.BusinessDate;
import com.indravaibhavmarble.purchase.dto.PurchaseBalanceResponse;
import com.indravaibhavmarble.purchase.dto.PurchasePaymentRequest;
import com.indravaibhavmarble.purchase.dto.PurchasePaymentResponse;
import com.indravaibhavmarble.purchase.entity.Purchase;
import com.indravaibhavmarble.purchase.entity.PurchasePayment;
import com.indravaibhavmarble.purchase.repository.PurchasePaymentRepository;
import com.indravaibhavmarble.purchase.repository.PurchaseRepository;
import com.indravaibhavmarble.supplier.repository.SupplierRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
public class PurchasePaymentService {

    private static final Set<String> PAYMENT_METHODS = Set.of(
            "CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER"
    );

    private final PurchaseRepository purchaseRepository;
    private final PurchasePaymentRepository paymentRepository;
    private final SupplierRepository supplierRepository;
    private final CashPeriodGuard periodGuard;
    private final FinancialAuditService auditService;

    public PurchasePaymentService(
            PurchaseRepository purchaseRepository,
            PurchasePaymentRepository paymentRepository,
            SupplierRepository supplierRepository,
            CashPeriodGuard periodGuard,
            FinancialAuditService auditService
    ) {
        this.purchaseRepository = purchaseRepository;
        this.paymentRepository = paymentRepository;
        this.supplierRepository = supplierRepository;
        this.periodGuard = periodGuard;
        this.auditService = auditService;
    }

    @Transactional
    public PurchasePaymentResponse recordPayment(
            Long purchaseId,
            PurchasePaymentRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("Payment details are required.");
        }

        // A double-tapped save returns the payment already recorded.
        if (request.requestId() != null) {
            var existing = paymentRepository.findByRequestId(request.requestId());
            if (existing.isPresent() && existing.get().getPurchaseId().equals(purchaseId)) {
                return toResponse(existing.get());
            }
        }

        if (request.paymentDate() == null) {
            throw new IllegalArgumentException("Payment date is required.");
        }

        if (request.paymentDate().isAfter(BusinessDate.today())) {
            throw new IllegalArgumentException("Payment date cannot be in the future.");
        }

        if (request.amount() == null || request.amount().signum() <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero.");
        }

        if (request.amount().scale() > 2) {
            throw new IllegalArgumentException("Payment amount cannot have more than two decimal places.");
        }

        BigDecimal amount = request.amount().setScale(2, RoundingMode.UNNECESSARY);

        if (amount.precision() > 14) {
            throw new IllegalArgumentException("Payment amount is too large.");
        }

        String paymentMethod = request.paymentMethod() == null
                ? ""
                : request.paymentMethod().trim().toUpperCase();

        if (!PAYMENT_METHODS.contains(paymentMethod)) {
            throw new IllegalArgumentException(
                    "Payment method must be CASH, UPI, BANK_TRANSFER, CHEQUE, CARD, or OTHER."
            );
        }

        if (request.referenceNumber() != null
                && request.referenceNumber().length() > 100) {
            throw new IllegalArgumentException("Reference number cannot exceed 100 characters.");
        }

        Purchase purchase = purchaseRepository.findByIdForUpdate(purchaseId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Purchase not found: " + purchaseId));

        if (!"RECEIVED".equalsIgnoreCase(purchase.getStatus())) {
            throw new IllegalArgumentException(
                    "Payments can only be recorded for received purchases."
            );
        }

        BigDecimal purchaseTotal = purchase.getTotalAmount();

        if (purchaseTotal == null || purchaseTotal.signum() < 0) {
            throw new IllegalStateException("Purchase total is invalid.");
        }

        BigDecimal totalPaid = paymentRepository.getTotalPaidForPurchase(purchaseId);
        BigDecimal outstanding = purchaseTotal.subtract(totalPaid);

        if (amount.compareTo(outstanding) > 0) {
            throw new IllegalArgumentException(
                    "Payment exceeds the outstanding balance of " + outstanding
            );
        }

        periodGuard.assertOpen(request.paymentDate());

        PurchasePayment payment = new PurchasePayment();
        payment.setPurchaseId(purchaseId);
        payment.setCreatedBy(CurrentUser.name());
        payment.setRequestId(request.requestId());
        payment.setPaymentDate(request.paymentDate());
        payment.setAmount(amount);
        payment.setPaymentMethod(paymentMethod);
        payment.setReferenceNumber(request.referenceNumber());
        payment.setNotes(request.notes());

        PurchasePayment saved = paymentRepository.save(payment);

        return toResponse(saved);
    }

    /** Owner fixes a payment entered with the wrong method; only while its day is not closed. */
    @Transactional
    public PurchasePaymentResponse changeMethod(Long purchaseId, Long paymentId,
            ChangePaymentMethodRequest request) {
        if (!CurrentUser.has("CASH_APPROVE")) {
            throw new AccessDeniedException("Only the owner can change how a payment was made.");
        }
        PurchasePayment payment = paymentRepository.findById(paymentId)
                .filter(found -> found.getPurchaseId().equals(purchaseId))
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + paymentId));
        String method = request == null || request.paymentMethod() == null ? ""
                : request.paymentMethod().trim().toUpperCase();
        if (!PAYMENT_METHODS.contains(method)) {
            throw new IllegalArgumentException("Payment method is not supported.");
        }
        if (method.equals(payment.getPaymentMethod())) {
            throw new IllegalArgumentException("The payment is already recorded as " + method + ".");
        }
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > 500) {
            throw new IllegalArgumentException("Give a reason (up to 500 characters) for changing the method.");
        }
        periodGuard.assertOpen(payment.getPaymentDate());
        PurchasePaymentResponse before = toResponse(payment);
        payment.setPaymentMethod(method);
        PurchasePaymentResponse after = toResponse(paymentRepository.saveAndFlush(payment));
        auditService.record("PURCHASE_PAYMENT", paymentId, "CHANGE_METHOD", reason, before, after);
        return after;
    }

    @Transactional(readOnly = true)
    public List<PurchasePaymentResponse> getPayments(Long purchaseId) {
        if (!purchaseRepository.existsById(purchaseId)) {
            throw new IllegalArgumentException("Purchase not found: " + purchaseId);
        }

        return paymentRepository
                .findByPurchaseIdOrderByPaymentDateDescIdDesc(purchaseId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PurchaseBalanceResponse getPurchaseBalance(Long purchaseId) {
        Purchase purchase = purchaseRepository.findById(purchaseId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Purchase not found: " + purchaseId));

        BigDecimal purchaseTotal = purchase.getTotalAmount();
        if (purchaseTotal == null) {
            purchaseTotal = BigDecimal.ZERO;
        }

        BigDecimal totalPaid = paymentRepository.getTotalPaidForPurchase(purchaseId);
        BigDecimal outstanding = purchaseTotal.subtract(totalPaid);
        String supplierName = supplierRepository.findById(purchase.getSupplierId())
                .map(supplier -> supplier.getName())
                .orElse("Unavailable supplier");

        return new PurchaseBalanceResponse(
                purchase.getId(),
                purchase.getPurchaseNumber(),
                purchase.getSupplierId(),
                supplierName,
                purchaseTotal,
                totalPaid,
                outstanding
        );
    }

    private PurchasePaymentResponse toResponse(PurchasePayment payment) {
        return new PurchasePaymentResponse(
                payment.getId(),
                payment.getPurchaseId(),
                payment.getPaymentDate(),
                payment.getAmount(),
                payment.getPaymentMethod(),
                payment.getReferenceNumber(),
                payment.getNotes(),
                payment.getCreatedAt()
        );
    }
}
