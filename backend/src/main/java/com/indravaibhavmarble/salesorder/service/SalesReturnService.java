package com.indravaibhavmarble.salesorder.service;

import com.indravaibhavmarble.cash.service.CashPeriodGuard;
import com.indravaibhavmarble.common.time.BusinessDate;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.salesorder.dto.SalesOrderCancelRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnItemResponse;
import com.indravaibhavmarble.salesorder.dto.SalesReturnRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnResponse;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import com.indravaibhavmarble.salesorder.entity.SalesOrderCharge;
import com.indravaibhavmarble.salesorder.entity.SalesOrderItem;
import com.indravaibhavmarble.salesorder.entity.SalesOrderPayment;
import com.indravaibhavmarble.salesorder.entity.SalesReturn;
import com.indravaibhavmarble.salesorder.entity.SalesReturnItem;
import com.indravaibhavmarble.salesorder.repository.SalesOrderChargeRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderPaymentRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderRepository;
import com.indravaibhavmarble.salesorder.repository.SalesReturnItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesReturnRepository;
import com.indravaibhavmarble.stockmovement.service.StockMovementService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Takes goods back on a bill (part or all of it) and cancels bills.
 * The bill itself is never edited: each return is its own record, stock is
 * added back, and any money the customer overpaid is refunded as a negative
 * payment. Cancelling is the final return of everything still on the bill,
 * extra charges included, so a cancelled bill is worth nothing.
 */
@Service
public class SalesReturnService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final Set<String> REFUND_METHODS =
            Set.of("CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "OTHER");

    private final SalesOrderRepository orderRepository;
    private final SalesOrderItemRepository itemRepository;
    private final SalesOrderChargeRepository chargeRepository;
    private final SalesOrderPaymentRepository paymentRepository;
    private final SalesReturnRepository returnRepository;
    private final SalesReturnItemRepository returnItemRepository;
    private final ProductRepository productRepository;
    private final StockMovementService stockMovementService;
    private final CashPeriodGuard periodGuard;

    public SalesReturnService(
            SalesOrderRepository orderRepository,
            SalesOrderItemRepository itemRepository,
            SalesOrderChargeRepository chargeRepository,
            SalesOrderPaymentRepository paymentRepository,
            SalesReturnRepository returnRepository,
            SalesReturnItemRepository returnItemRepository,
            ProductRepository productRepository,
            StockMovementService stockMovementService,
            CashPeriodGuard periodGuard) {
        this.orderRepository = orderRepository;
        this.itemRepository = itemRepository;
        this.chargeRepository = chargeRepository;
        this.paymentRepository = paymentRepository;
        this.returnRepository = returnRepository;
        this.returnItemRepository = returnItemRepository;
        this.productRepository = productRepository;
        this.stockMovementService = stockMovementService;
        this.periodGuard = periodGuard;
    }

    /** What has already come back on one bill line. */
    record Returned(BigDecimal quantity, BigDecimal secondaryQuantity,
            BigDecimal taxable, BigDecimal cgst, BigDecimal sgst,
            BigDecimal igst, BigDecimal lineTotal) {

        static final Returned NONE = new Returned(BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO);

        Returned plus(SalesReturnItem item) {
            return new Returned(
                    quantity.add(item.getQuantity()),
                    secondaryQuantity.add(item.getSecondaryQuantity() == null
                            ? BigDecimal.ZERO : item.getSecondaryQuantity()),
                    taxable.add(item.getTaxableAmount()),
                    cgst.add(item.getCgstAmount()),
                    sgst.add(item.getSgstAmount()),
                    igst.add(item.getIgstAmount()),
                    lineTotal.add(item.getLineTotal()));
        }
    }

    /** Sums of everything returned so far, by bill line id. */
    static Map<Long, Returned> returnedByItem(List<SalesReturnItem> returnItems) {
        Map<Long, Returned> returned = new HashMap<>();
        for (SalesReturnItem item : returnItems) {
            returned.merge(item.getSalesOrderItemId(), Returned.NONE.plus(item),
                    (sum, ignored) -> sum.plus(item));
        }
        return returned;
    }

    @Transactional
    public SalesReturnResponse createReturn(Long orderId, SalesReturnRequest request) {
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Choose at least one item to return.");
        }
        return process(orderId, request.returnDate(), request.reason(),
                request.refundMethod(), request.items(), false);
    }

    @Transactional
    public SalesReturnResponse cancelOrder(Long orderId, SalesOrderCancelRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("A reason is required to cancel a bill.");
        }
        return process(orderId, request.cancelDate(), request.reason(),
                request.refundMethod(), null, true);
    }

    private SalesReturnResponse process(Long orderId, LocalDate requestedDate,
            String requestedReason, String requestedRefundMethod,
            List<SalesReturnItemRequest> requestedItems, boolean cancel) {

        String reason = requestedReason == null ? "" : requestedReason.trim();
        if (reason.isEmpty()) {
            throw new IllegalArgumentException(cancel
                    ? "A reason is required to cancel a bill."
                    : "A reason is required for a return.");
        }
        if (reason.length() > 1000) {
            throw new IllegalArgumentException("The reason cannot exceed 1000 characters.");
        }

        // Lock the bill so two returns cannot take back the same goods.
        SalesOrder order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Sales order not found: " + orderId));
        if ("CANCELLED".equals(order.getStatus())) {
            throw new IllegalArgumentException("This bill is already cancelled.");
        }
        if (!"CONFIRMED".equals(order.getStatus())) {
            throw new IllegalArgumentException("Only saved bills can have returns.");
        }

        LocalDate date = requestedDate == null ? BusinessDate.today() : requestedDate;
        if (date.isAfter(BusinessDate.today())) {
            throw new IllegalArgumentException("The return date cannot be in the future.");
        }
        if (date.isBefore(order.getOrderDate())) {
            throw new IllegalArgumentException("The return date cannot be before the bill date.");
        }

        Map<Long, SalesOrderItem> itemsById = itemRepository.findBySalesOrderId(orderId)
                .stream()
                .collect(Collectors.toMap(SalesOrderItem::getId, Function.identity()));
        List<Long> previousReturnIds = returnRepository.findBySalesOrderIdOrderByIdAsc(orderId)
                .stream().map(SalesReturn::getId).toList();
        Map<Long, Returned> alreadyReturned = previousReturnIds.isEmpty()
                ? Map.of()
                : returnedByItem(returnItemRepository.findBySalesReturnIdInOrderByIdAsc(previousReturnIds));

        List<SalesReturnItem> lines = cancel
                ? everythingLeft(itemsById, alreadyReturned)
                : requestedLines(requestedItems, itemsById, alreadyReturned);
        if (!cancel && lines.isEmpty()) {
            throw new IllegalArgumentException("Choose at least one item to return.");
        }

        BigDecimal subtotal = ZERO;
        BigDecimal cgst = ZERO;
        BigDecimal sgst = ZERO;
        BigDecimal igst = ZERO;
        for (SalesReturnItem line : lines) {
            subtotal = subtotal.add(line.getTaxableAmount());
            cgst = cgst.add(line.getCgstAmount());
            sgst = sgst.add(line.getSgstAmount());
            igst = igst.add(line.getIgstAmount());
        }
        // Extra charges (loading, transport) go back only when the whole bill is cancelled.
        BigDecimal charges = cancel
                ? chargeRepository.findBySalesOrderId(orderId).stream()
                        .map(SalesOrderCharge::getAmount)
                        .reduce(ZERO, BigDecimal::add)
                : ZERO;
        BigDecimal total = subtotal.add(cgst).add(sgst).add(igst).add(charges);

        BigDecimal returnedTotal = order.getReturnedTotal().add(total);
        if (cancel) {
            // Absorb any rounding so a cancelled bill is worth exactly nothing.
            total = total.add(order.getGrandTotal().subtract(returnedTotal));
            returnedTotal = order.getGrandTotal();
        }
        if (returnedTotal.compareTo(order.getGrandTotal()) > 0) {
            throw new IllegalArgumentException("The return is worth more than what is left on the bill.");
        }

        // Refund whatever the customer has paid above what the bill is now worth.
        BigDecimal paid = paymentRepository.getTotalPaid(orderId);
        BigDecimal refund = paid.subtract(order.getGrandTotal().subtract(returnedTotal)).max(ZERO);
        String refundMethod = null;
        if (refund.signum() > 0) {
            refundMethod = requestedRefundMethod == null ? ""
                    : requestedRefundMethod.trim().toUpperCase(Locale.ROOT);
            if (!REFUND_METHODS.contains(refundMethod)) {
                throw new IllegalArgumentException(
                        "Choose how " + refund + " was given back to the customer.");
            }
            if (!currentUserHas("PAYMENT_MANAGE")) {
                throw new IllegalArgumentException(
                        "A refund of " + refund + " is due. Ask someone who can record payments to do this return.");
            }
            periodGuard.assertOpen(date);
        }

        SalesReturn salesReturn = SalesReturn.createNew();
        salesReturn.setSalesOrderId(orderId);
        salesReturn.setReturnNumber(String.format("RET-%04d", returnRepository.nextReturnNumber()));
        salesReturn.setReturnDate(date);
        salesReturn.setReason(reason);
        salesReturn.setCancelsOrder(cancel);
        salesReturn.setSubtotal(subtotal);
        salesReturn.setCgstAmount(cgst);
        salesReturn.setSgstAmount(sgst);
        salesReturn.setIgstAmount(igst);
        salesReturn.setChargesAmount(charges);
        salesReturn.setTotalAmount(total);
        salesReturn.setRefundAmount(refund);
        salesReturn.setCreatedBy(currentUserName());
        SalesReturn saved = returnRepository.save(salesReturn);

        for (SalesReturnItem line : lines) {
            line.setSalesReturnId(saved.getId());
        }
        List<SalesReturnItem> savedLines = returnItemRepository.saveAll(lines);

        for (SalesReturnItem line : savedLines) {
            addBackToStock(itemsById.get(line.getSalesOrderItemId()), line, saved, order);
        }

        if (refund.signum() > 0) {
            SalesOrderPayment payment = new SalesOrderPayment();
            payment.setSalesOrderId(orderId);
            payment.setPaymentDate(date);
            payment.setAmount(refund.negate());
            payment.setPaymentMethod(refundMethod);
            payment.setSalesReturnId(saved.getId());
            payment.setCreatedBy(currentUserName());
            payment.setNotes("Refund for " + saved.getReturnNumber());
            paymentRepository.save(payment);
        }

        order.setReturnedTotal(returnedTotal);
        if (cancel) {
            order.setStatus("CANCELLED");
            order.setCancelReason(reason);
            order.setCancelledAt(OffsetDateTime.now());
        }
        orderRepository.save(order);

        return toResponse(saved, savedLines, itemsById);
    }

    private List<SalesReturnItem> everythingLeft(Map<Long, SalesOrderItem> itemsById,
            Map<Long, Returned> alreadyReturned) {
        List<SalesReturnItem> lines = new ArrayList<>();
        for (SalesOrderItem item : itemsById.values()) {
            Returned returned = alreadyReturned.getOrDefault(item.getId(), Returned.NONE);
            BigDecimal left = item.getQuantity().subtract(returned.quantity());
            if (left.signum() > 0) {
                lines.add(line(item, left, null, returned));
            }
        }
        lines.sort((a, b) -> a.getSalesOrderItemId().compareTo(b.getSalesOrderItemId()));
        return lines;
    }

    private List<SalesReturnItem> requestedLines(List<SalesReturnItemRequest> requests,
            Map<Long, SalesOrderItem> itemsById, Map<Long, Returned> alreadyReturned) {
        Set<Long> seen = new HashSet<>();
        List<SalesReturnItem> lines = new ArrayList<>();
        for (SalesReturnItemRequest request : requests) {
            if (request == null || request.salesOrderItemId() == null) {
                throw new IllegalArgumentException("Each returned item must name a line on the bill.");
            }
            SalesOrderItem item = itemsById.get(request.salesOrderItemId());
            if (item == null) {
                throw new IllegalArgumentException("That item is not on this bill.");
            }
            if (!seen.add(item.getId())) {
                throw new IllegalArgumentException(
                        item.getProductNameSnapshot() + " is listed twice in the return.");
            }
            boolean noQuantity = (request.quantity() == null || request.quantity().signum() == 0)
                    && (request.secondaryQuantity() == null || request.secondaryQuantity().signum() == 0);
            if (noQuantity) {
                continue;
            }
            lines.add(line(item, request.quantity(), request.secondaryQuantity(),
                    alreadyReturned.getOrDefault(item.getId(), Returned.NONE)));
        }
        return lines;
    }

    /** One returned line, priced as the same share of the original line. */
    private SalesReturnItem line(SalesOrderItem item, BigDecimal requestedQuantity,
            BigDecimal requestedSecondary, Returned returned) {
        BigDecimal leftQuantity = item.getQuantity().subtract(returned.quantity());
        boolean dualUnit = item.getSecondaryQuantity() != null
                && item.getSecondaryQuantity().signum() > 0;
        BigDecimal leftSecondary = dualUnit
                ? item.getSecondaryQuantity().subtract(returned.secondaryQuantity())
                : null;

        BigDecimal quantity = requestedQuantity;
        BigDecimal secondary = dualUnit ? requestedSecondary : null;
        if (dualUnit && quantity == null && secondary != null) {
            quantity = secondary.compareTo(leftSecondary) == 0
                    ? leftQuantity
                    : item.getQuantity().multiply(secondary)
                            .divide(item.getSecondaryQuantity(), 3, RoundingMode.HALF_UP);
        }
        if (dualUnit && secondary == null && quantity != null) {
            secondary = quantity.compareTo(leftQuantity) == 0
                    ? leftSecondary
                    : item.getSecondaryQuantity().multiply(quantity)
                            .divide(item.getQuantity(), 3, RoundingMode.HALF_UP);
        }

        String name = item.getProductNameSnapshot();
        if (quantity == null || quantity.signum() <= 0
                || (dualUnit && (secondary == null || secondary.signum() <= 0))) {
            throw new IllegalArgumentException("Enter how much of " + name + " is coming back.");
        }
        if (quantity.stripTrailingZeros().scale() > 3
                || (secondary != null && secondary.stripTrailingZeros().scale() > 3)) {
            throw new IllegalArgumentException("Quantity cannot have more than 3 decimal places.");
        }
        if (quantity.compareTo(leftQuantity) > 0
                || (dualUnit && secondary.compareTo(leftSecondary) > 0)) {
            throw new IllegalArgumentException("Only " + leftQuantity.stripTrailingZeros().toPlainString()
                    + " " + item.getUnitCodeSnapshot() + " of " + name + " is left on this bill.");
        }

        SalesReturnItem line = SalesReturnItem.createNew();
        line.setSalesOrderItemId(item.getId());
        line.setQuantity(quantity.setScale(3, RoundingMode.UNNECESSARY));
        line.setSecondaryQuantity(secondary == null ? null : secondary.setScale(3, RoundingMode.UNNECESSARY));

        boolean everythingLeft = quantity.compareTo(leftQuantity) == 0
                && (!dualUnit || secondary.compareTo(leftSecondary) == 0);
        if (everythingLeft) {
            // The last of a line takes exactly what is left, so rounding never drifts.
            line.setTaxableAmount(item.getTaxableAmount().subtract(returned.taxable()));
            line.setCgstAmount(item.getCgstAmount().subtract(returned.cgst()));
            line.setSgstAmount(item.getSgstAmount().subtract(returned.sgst()));
            line.setIgstAmount(item.getIgstAmount().subtract(returned.igst()));
        } else {
            boolean bySecondary = "SECONDARY".equals(item.getPricingUnit()) && dualUnit;
            BigDecimal share = bySecondary
                    ? secondary.divide(item.getSecondaryQuantity(), 10, RoundingMode.HALF_UP)
                    : quantity.divide(item.getQuantity(), 10, RoundingMode.HALF_UP);
            line.setTaxableAmount(portion(item.getTaxableAmount(), share, returned.taxable()));
            line.setCgstAmount(portion(item.getCgstAmount(), share, returned.cgst()));
            line.setSgstAmount(portion(item.getSgstAmount(), share, returned.sgst()));
            line.setIgstAmount(portion(item.getIgstAmount(), share, returned.igst()));
        }
        line.setLineTotal(line.getTaxableAmount().add(line.getCgstAmount())
                .add(line.getSgstAmount()).add(line.getIgstAmount()));
        return line;
    }

    private static BigDecimal portion(BigDecimal amount, BigDecimal share, BigDecimal alreadyReturned) {
        BigDecimal value = amount.multiply(share).setScale(2, RoundingMode.HALF_UP);
        return value.min(amount.subtract(alreadyReturned)).max(ZERO);
    }

    private void addBackToStock(SalesOrderItem item, SalesReturnItem line,
            SalesReturn salesReturn, SalesOrder order) {
        // Returned goods go back even if the product has since been switched off.
        Product product = productRepository.findByIdForUpdate(item.getProductId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Product not found: " + item.getProductCodeSnapshot()));

        BigDecimal before = product.getStockQuantity();
        BigDecimal after = before.add(line.getQuantity());
        product.setStockQuantity(after);

        BigDecimal secondaryChange = null;
        BigDecimal secondaryBefore = null;
        BigDecimal secondaryAfter = null;
        if (product.getSecondaryUnitId() != null && line.getSecondaryQuantity() != null) {
            secondaryChange = line.getSecondaryQuantity();
            secondaryBefore = product.getSecondaryStockQuantity();
            secondaryAfter = secondaryBefore.add(secondaryChange);
            product.setSecondaryStockQuantity(secondaryAfter);
        }
        productRepository.save(product);

        stockMovementService.recordMovementForExistingStockChange(
                product.getId(),
                line.getQuantity(),
                before,
                after,
                "SALES_RETURN",
                salesReturn.getId(),
                salesReturn.getReturnNumber(),
                (salesReturn.isCancelsOrder() ? "Bill " + order.getOrderNumber() + " cancelled: "
                        : "Returned on bill " + order.getOrderNumber() + ": ")
                        + salesReturn.getReason(),
                secondaryChange,
                secondaryBefore,
                secondaryAfter);
    }

    private static boolean currentUserHas(String authority) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }

    private static String currentUserName() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null ? null : authentication.getName();
    }

    static SalesReturnResponse toResponse(SalesReturn salesReturn, List<SalesReturnItem> lines,
            Map<Long, SalesOrderItem> itemsById) {
        List<SalesReturnItemResponse> items = lines.stream()
                .map(line -> {
                    SalesOrderItem item = itemsById.get(line.getSalesOrderItemId());
                    return new SalesReturnItemResponse(
                            line.getSalesOrderItemId(),
                            item == null ? null : item.getProductNameSnapshot(),
                            item == null ? null : item.getUnitCodeSnapshot(),
                            line.getQuantity(),
                            line.getSecondaryQuantity(),
                            line.getLineTotal());
                })
                .toList();
        return new SalesReturnResponse(
                salesReturn.getId(),
                salesReturn.getReturnNumber(),
                salesReturn.getReturnDate(),
                salesReturn.getReason(),
                salesReturn.isCancelsOrder(),
                salesReturn.getSubtotal(),
                salesReturn.getTotalTax(),
                salesReturn.getChargesAmount(),
                salesReturn.getTotalAmount(),
                salesReturn.getRefundAmount(),
                salesReturn.getCreatedBy(),
                salesReturn.getCreatedAt(),
                items);
    }
}
