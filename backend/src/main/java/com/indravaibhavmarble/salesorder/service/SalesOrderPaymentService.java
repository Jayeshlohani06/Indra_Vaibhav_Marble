package com.indravaibhavmarble.salesorder.service;

import com.indravaibhavmarble.cash.service.CashPeriodGuard;
import com.indravaibhavmarble.cash.service.FinancialAuditService;
import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import com.indravaibhavmarble.common.payment.ChangePaymentMethodRequest;
import com.indravaibhavmarble.common.security.CurrentUser;
import com.indravaibhavmarble.common.time.BusinessDate;

import com.indravaibhavmarble.customer.repository.CustomerRepository;
import com.indravaibhavmarble.salesorder.dto.*;
import com.indravaibhavmarble.salesorder.entity.SalesOrderPayment;
import com.indravaibhavmarble.salesorder.repository.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service
public class SalesOrderPaymentService {
    private static final Set<String> METHODS =
            Set.of("CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER");
    private final SalesOrderRepository orderRepository;
    private final SalesOrderPaymentRepository paymentRepository;
    private final CustomerRepository customerRepository;
    private final CashPeriodGuard periodGuard;
    private final FinancialAuditService auditService;

    public SalesOrderPaymentService(SalesOrderRepository orderRepository,
            SalesOrderPaymentRepository paymentRepository,
            CustomerRepository customerRepository,
            CashPeriodGuard periodGuard,
            FinancialAuditService auditService) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
        this.customerRepository = customerRepository;
        this.periodGuard = periodGuard;
        this.auditService = auditService;
    }

    @Transactional
    public SalesOrderPaymentResponse recordPayment(Long orderId,
            SalesOrderPaymentRequest request) {
        // A double-tapped save returns the payment already recorded.
        if (request.requestId() != null) {
            var existing = paymentRepository.findByRequestId(request.requestId());
            if (existing.isPresent() && existing.get().getSalesOrderId().equals(orderId)) {
                return toResponse(existing.get());
            }
        }
        if (request.paymentDate().isAfter(BusinessDate.today())) {
            throw new IllegalArgumentException("Payment date cannot be in the future.");
        }
        if (request.amount().scale() > 2) {
            throw new IllegalArgumentException("Payment amount cannot have more than two decimal places.");
        }
        String method = request.paymentMethod().trim().toUpperCase();
        if (!METHODS.contains(method)) {
            throw new IllegalArgumentException("Payment method is not supported.");
        }
        // Lock the order so concurrent payments cannot exceed the balance.
        var order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Sales order not found: " + orderId));
        if ("CANCELLED".equals(order.getStatus())) {
            throw new IllegalArgumentException("Payments cannot be recorded for a cancelled order.");
        }
        BigDecimal amount = request.amount().setScale(2, RoundingMode.UNNECESSARY);
        BigDecimal paid = paymentRepository.getTotalPaid(orderId);
        BigDecimal balance = order.getNetTotal().subtract(paid);
        if (amount.compareTo(balance) > 0) {
            throw new IllegalArgumentException("Payment exceeds outstanding balance of " + balance);
        }
        periodGuard.assertOpen(request.paymentDate());
        SalesOrderPayment payment = new SalesOrderPayment();
        payment.setSalesOrderId(orderId);
        payment.setCreatedBy(CurrentUser.name());
        payment.setRequestId(request.requestId());
        payment.setPaymentDate(request.paymentDate());
        payment.setAmount(amount);
        payment.setPaymentMethod(method);
        payment.setReferenceNumber(request.referenceNumber());
        payment.setNotes(request.notes());
        return toResponse(paymentRepository.save(payment));
    }

    /** Owner fixes a payment entered with the wrong method; only while its day is not closed. */
    @Transactional
    public SalesOrderPaymentResponse changeMethod(Long orderId, Long paymentId,
            ChangePaymentMethodRequest request) {
        if (!CurrentUser.has("CASH_APPROVE")) {
            throw new AccessDeniedException("Only the owner can change how a payment was made.");
        }
        SalesOrderPayment payment = paymentRepository.findById(paymentId)
                .filter(found -> found.getSalesOrderId().equals(orderId))
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + paymentId));
        String method = request == null || request.paymentMethod() == null ? ""
                : request.paymentMethod().trim().toUpperCase();
        if (!METHODS.contains(method)) {
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
        SalesOrderPaymentResponse before = toResponse(payment);
        payment.setPaymentMethod(method);
        SalesOrderPaymentResponse after = toResponse(paymentRepository.saveAndFlush(payment));
        auditService.record("SALES_PAYMENT", paymentId, "CHANGE_METHOD", reason, before, after);
        return after;
    }

    @Transactional(readOnly = true)
    public List<SalesOrderPaymentResponse> getPayments(Long orderId) {
        if (!orderRepository.existsById(orderId)) {
            throw new IllegalArgumentException("Sales order not found: " + orderId);
        }
        return paymentRepository.findBySalesOrderIdOrderByPaymentDateDescIdDesc(orderId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public SalesOrderBalanceResponse getBalance(Long orderId) {
        var order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Sales order not found: " + orderId));
        BigDecimal paid = paymentRepository.getTotalPaid(orderId);
        BigDecimal balance = order.getNetTotal().subtract(paid);
        String status = paid.signum() == 0 ? "UNPAID"
                : balance.signum() == 0 ? "PAID" : "PARTIALLY_PAID";
        String name = customerRepository.findById(order.getCustomerId())
                .map(customer -> customer.getName()).orElse("Unavailable customer");
        return new SalesOrderBalanceResponse(order.getId(), order.getOrderNumber(),
                order.getCustomerId(), name, order.getNetTotal(), paid,
                balance, status);
    }

    private SalesOrderPaymentResponse toResponse(SalesOrderPayment payment) {
        return new SalesOrderPaymentResponse(payment.getId(),
                payment.getSalesOrderId(), payment.getPaymentDate(),
                payment.getAmount(), payment.getPaymentMethod(),
                payment.getReferenceNumber(), payment.getNotes(),
                payment.getCreatedAt());
    }
}
