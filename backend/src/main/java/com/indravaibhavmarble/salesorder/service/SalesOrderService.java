
package com.indravaibhavmarble.salesorder.service;

import com.indravaibhavmarble.common.time.BusinessDate;

import com.indravaibhavmarble.category.entity.ProductCategory;
import com.indravaibhavmarble.category.repository.ProductCategoryRepository;
import com.indravaibhavmarble.customer.entity.Customer;
import com.indravaibhavmarble.customer.repository.CustomerRepository;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderChargeRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderChargeResponse;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemResponse;
import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import com.indravaibhavmarble.salesorder.entity.SalesOrderItem;
import com.indravaibhavmarble.salesorder.entity.SalesOrderCharge;
import com.indravaibhavmarble.salesorder.repository.SalesOrderItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderPaymentRepository;
import com.indravaibhavmarble.common.payment.PaymentStatus;
import com.indravaibhavmarble.salesorder.repository.SalesOrderChargeRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderRepository;
import com.indravaibhavmarble.stockmovement.service.StockMovementService;
import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import com.indravaibhavmarble.unit.repository.MeasurementUnitRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SalesOrderService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final SalesOrderRepository orderRepository;
    private final SalesOrderItemRepository itemRepository;
    private final SalesOrderChargeRepository chargeRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final MeasurementUnitRepository unitRepository;
    private final ProductCategoryRepository categoryRepository;
    private final StockMovementService stockMovementService;
    private final SalesOrderPaymentRepository paymentRepository;

    public SalesOrderService(
            SalesOrderRepository orderRepository,
            SalesOrderItemRepository itemRepository,
            SalesOrderChargeRepository chargeRepository,
            CustomerRepository customerRepository,
            ProductRepository productRepository,
            MeasurementUnitRepository unitRepository,
            ProductCategoryRepository categoryRepository,
            StockMovementService stockMovementService,
            SalesOrderPaymentRepository paymentRepository) {

        this.orderRepository = orderRepository;
        this.itemRepository = itemRepository;
        this.chargeRepository = chargeRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.unitRepository = unitRepository;
        this.categoryRepository = categoryRepository;
        this.stockMovementService = stockMovementService;
        this.paymentRepository = paymentRepository;
    }

    private record StockChange(
            Long productId,
            BigDecimal quantityChange,
            BigDecimal stockBefore,
            BigDecimal stockAfter,
            BigDecimal secondaryQuantityChange,
            BigDecimal secondaryStockBefore,
            BigDecimal secondaryStockAfter) {
    }

    @Transactional
    public SalesOrderResponse createOrder(SalesOrderRequest request) {

        validateRequest(request);

        Customer customer = customerRepository.findById(request.customerId())
                .filter(Customer::isActive)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Active customer not found: "
                                        + request.customerId()));

        String taxType = request.taxType() == null
                ? "INTRA"
                : request.taxType().trim().toUpperCase(Locale.ROOT);

        if (!taxType.equals("INTRA") && !taxType.equals("INTER")) {
            throw new IllegalArgumentException(
                    "Tax type must be INTRA or INTER");
        }

        SalesOrder order = SalesOrder.createNew();
        order.setOrderNumber(generateOrderNumber());
        order.setCustomerId(customer.getId());
        order.setOrderDate(request.orderDate() == null
                ? BusinessDate.today()
                : request.orderDate());
        order.setStatus("CONFIRMED");
        order.setTaxType(taxType);
        order.setNotes(request.notes());

        BigDecimal subtotal = ZERO;
        BigDecimal totalCgst = ZERO;
        BigDecimal totalSgst = ZERO;
        BigDecimal totalIgst = ZERO;

        List<SalesOrderItem> items = new ArrayList<>();
        List<StockChange> stockChanges = new ArrayList<>();

        for (SalesOrderItemRequest itemRequest : request.items()) {

            Product product = productRepository
                    .findByIdForUpdate(itemRequest.productId())
                    .filter(Product::isActive)
                    .orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Active product not found: "
                                            + itemRequest.productId()));

            BigDecimal primaryQuantity = itemRequest.quantity();
            BigDecimal secondaryQuantity = itemRequest.secondaryQuantity();
            if (primaryQuantity == null && secondaryQuantity != null
                    && product.getSecondaryPerPrimary() != null) {
                primaryQuantity = secondaryQuantity.divide(
                        product.getSecondaryPerPrimary(), 3, RoundingMode.HALF_UP);
            }
            if (secondaryQuantity == null && primaryQuantity != null
                    && product.getSecondaryPerPrimary() != null
                    && product.getSecondaryUnitId() != null) {
                secondaryQuantity = primaryQuantity.multiply(
                        product.getSecondaryPerPrimary()).setScale(3, RoundingMode.HALF_UP);
            }
            if (primaryQuantity == null || primaryQuantity.signum() <= 0
                    || (product.getSecondaryUnitId() != null
                    && (secondaryQuantity == null || secondaryQuantity.signum() <= 0))) {
                throw new IllegalArgumentException(
                        "Both quantities are required for dual-unit products");
            }

            if (primaryQuantity.scale() > 3) {
                throw new IllegalArgumentException(
                        "Quantity cannot have more than 3 decimal places");
            }

            BigDecimal availableStock = product.getStockQuantity();

            if (availableStock == null
                    || availableStock                    .compareTo(primaryQuantity) < 0
                    || (product.getSecondaryUnitId() != null
                    && product.getSecondaryStockQuantity().compareTo(secondaryQuantity) < 0)) {
                throw new IllegalArgumentException(
                        "Insufficient stock for product "
                                + product.getProductCode()
                                + ". Available: " + availableStock
                                + ", requested: " + primaryQuantity);
            }

            // Validate the submitted price before changing stock.
            // Validate the custom selling price before changing stock.
if (itemRequest.unitPrice() != null
        && itemRequest.unitPrice().signum() < 0) {
    throw new IllegalArgumentException(
            "Unit selling price cannot be negative for product "
                    + product.getProductCode());
}

            MeasurementUnit unit = unitRepository.findById(product.getUnitId())
                    .filter(MeasurementUnit::isActive)
                    .orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Active measurement unit not found"));

            ProductCategory category = categoryRepository
                    .findById(product.getCategoryId())
                    .filter(ProductCategory::isActive)
                    .orElseThrow(() ->
                            new IllegalArgumentException(
                                    "Active product category not found"));

            // Deduct stock once. The movement service will only record it.
            BigDecimal remainingStock = availableStock
                    .subtract(primaryQuantity);

            product.setStockQuantity(remainingStock);
            BigDecimal secondaryRemaining = product.getSecondaryStockQuantity();
            if (product.getSecondaryUnitId() != null) {
                secondaryRemaining = secondaryRemaining.subtract(secondaryQuantity);
                product.setSecondaryStockQuantity(secondaryRemaining);
            }
            productRepository.save(product);

            stockChanges.add(new StockChange(
                    product.getId(),
                    primaryQuantity.negate(),
                    availableStock,
                    remainingStock,
                    product.getSecondaryUnitId() == null ? null : secondaryQuantity.negate(),
                    product.getSecondaryUnitId() == null ? null : product.getSecondaryStockQuantity().add(secondaryQuantity),
                    secondaryRemaining));

           BigDecimal unitPrice = (
        itemRequest.unitPrice() != null
                ? itemRequest.unitPrice()
                : product.getSellingPrice()
).setScale(2, RoundingMode.HALF_UP);

            BigDecimal gstRate = itemRequest.gstRate() == null
                    ? product.getGstRate()
                    : itemRequest.gstRate();
            if (gstRate.signum() < 0 || gstRate.compareTo(new BigDecimal("100")) > 0) {
                throw new IllegalArgumentException("GST rate must be between 0 and 100");
            }

            BigDecimal billableQuantity = "SECONDARY".equalsIgnoreCase(itemRequest.pricingUnit())
                    ? secondaryQuantity : primaryQuantity;
            BigDecimal taxableAmount = unitPrice
                    .multiply(billableQuantity)
                    .setScale(2, RoundingMode.HALF_UP);

            BigDecimal taxAmount = taxableAmount
                    .multiply(gstRate)
                    .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);

            BigDecimal cgst = ZERO;
            BigDecimal sgst = ZERO;
            BigDecimal igst = ZERO;

            if (taxType.equals("INTRA")) {
                cgst = taxAmount.divide(
                        new BigDecimal("2"), 2, RoundingMode.HALF_UP);
                sgst = taxAmount.subtract(cgst);
            } else {
                igst = taxAmount;
            }

            BigDecimal lineTotal = taxableAmount
                    .add(cgst)
                    .add(sgst)
                    .add(igst);

            SalesOrderItem item = SalesOrderItem.createNew();
            item.setProductId(product.getId());
            item.setProductCodeSnapshot(product.getProductCode());
            item.setProductNameSnapshot(product.getName());
            item.setUnitCodeSnapshot(unit.getCode());
            item.setQuantity(primaryQuantity);
            item.setSecondaryQuantity(secondaryQuantity);
            item.setPricingUnit("SECONDARY".equalsIgnoreCase(itemRequest.pricingUnit())
                    ? "SECONDARY" : "PRIMARY");
            item.setUnitPrice(unitPrice);
            item.setGstRate(gstRate);
            item.setTaxableAmount(taxableAmount);
            item.setCgstAmount(cgst);
            item.setSgstAmount(sgst);
            item.setIgstAmount(igst);
            item.setLineTotal(lineTotal);

            items.add(item);

            subtotal = subtotal.add(taxableAmount);
            totalCgst = totalCgst.add(cgst);
            totalSgst = totalSgst.add(sgst);
            totalIgst = totalIgst.add(igst);
        }

        BigDecimal totalTax = totalCgst.add(totalSgst).add(totalIgst);
        BigDecimal chargesTotal = ZERO;
        List<SalesOrderCharge> charges = new ArrayList<>();
        if (request.charges() != null) {
            if (request.charges().size() > 30) {
                throw new IllegalArgumentException("An order cannot contain more than 30 additional charges");
            }
            for (SalesOrderChargeRequest chargeRequest : request.charges()) {
                if (chargeRequest == null || chargeRequest.description() == null
                        || chargeRequest.description().isBlank()
                        || chargeRequest.description().trim().length() > 120
                        || chargeRequest.amount() == null
                        || chargeRequest.amount().signum() <= 0) {
                    throw new IllegalArgumentException("Each additional charge needs a description and positive amount");
                }
                SalesOrderCharge charge = SalesOrderCharge.createNew();
                charge.setDescription(chargeRequest.description().trim());
                charge.setAmount(chargeRequest.amount().setScale(2, RoundingMode.HALF_UP));
                chargesTotal = chargesTotal.add(charge.getAmount());
                charges.add(charge);
            }
        }
        BigDecimal grandTotal = subtotal.add(totalTax).add(chargesTotal);

        order.setSubtotal(subtotal);
        order.setCgstAmount(totalCgst);
        order.setSgstAmount(totalSgst);
        order.setIgstAmount(totalIgst);
        order.setTotalTax(totalTax);
        order.setGrandTotal(grandTotal);

        SalesOrder savedOrder = orderRepository.save(order);

        for (SalesOrderItem item : items) {
            item.setSalesOrderId(savedOrder.getId());
        }

        List<SalesOrderItem> savedItems = itemRepository.saveAll(items);
        for (SalesOrderCharge charge : charges) {
            charge.setSalesOrderId(savedOrder.getId());
        }
        List<SalesOrderCharge> savedCharges = chargeRepository.saveAll(charges);

        // Record the already-applied stock changes against the saved order.
        for (StockChange change : stockChanges) {
            stockMovementService.recordMovementForExistingStockChange(
                    change.productId(),
                    change.quantityChange(),
                    change.stockBefore(),
                    change.stockAfter(),
                    "SALES_ORDER",
                    savedOrder.getId(),
                    savedOrder.getOrderNumber(),
                    "Stock deducted for sales order "
                            + savedOrder.getOrderNumber(),
                    change.secondaryQuantityChange(),
                    change.secondaryStockBefore(),
                    change.secondaryStockAfter());
        }

        return toResponse(savedOrder, customer, savedItems, savedCharges,
                BigDecimal.ZERO);
    }

    @Transactional(readOnly = true)
    public List<SalesOrderResponse> getAllOrders() {
        List<SalesOrder> orders = orderRepository.findAllByOrderByCreatedAtDesc();
        if (orders.isEmpty()) {
            return List.of();
        }

        // Load related rows in bulk instead of three queries per order.
        List<Long> orderIds = orders.stream().map(SalesOrder::getId).toList();

        Map<Long, Customer> customersById = customerRepository
                .findAllById(orders.stream()
                        .map(SalesOrder::getCustomerId)
                        .distinct()
                        .toList())
                .stream()
                .collect(Collectors.toMap(Customer::getId, Function.identity()));

        Map<Long, List<SalesOrderItem>> itemsByOrder = itemRepository
                .findBySalesOrderIdInOrderByIdAsc(orderIds)
                .stream()
                .collect(Collectors.groupingBy(SalesOrderItem::getSalesOrderId));

        Map<Long, List<SalesOrderCharge>> chargesByOrder = chargeRepository
                .findBySalesOrderIdInOrderByIdAsc(orderIds)
                .stream()
                .collect(Collectors.groupingBy(SalesOrderCharge::getSalesOrderId));

        Map<Long, BigDecimal> paidByOrder = paymentRepository
                .getTotalPaidByOrder(orderIds)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0], row -> (BigDecimal) row[1]));

        return orders.stream()
                .map(order -> {
                    Customer customer = customersById.get(order.getCustomerId());
                    if (customer == null) {
                        throw new NoSuchElementException(
                                "Customer not found: " + order.getCustomerId());
                    }

                    return toResponse(
                            order,
                            customer,
                            itemsByOrder.getOrDefault(order.getId(), List.of()),
                            chargesByOrder.getOrDefault(order.getId(), List.of()),
                            paidByOrder.getOrDefault(order.getId(), BigDecimal.ZERO));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public SalesOrderResponse getOrderById(Long id) {
        SalesOrder order = orderRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Sales order not found: " + id));

        Customer customer = customerRepository.findById(
                order.getCustomerId()).orElseThrow();

        return toResponse(
                order,
                customer,
                itemRepository.findBySalesOrderId(order.getId()),
                chargeRepository.findBySalesOrderId(order.getId()),
                paymentRepository.getTotalPaid(order.getId()));
    }

    private void validateRequest(SalesOrderRequest request) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Sales order request is required");
        }

        if (request.customerId() == null || request.customerId() <= 0) {
            throw new IllegalArgumentException(
                    "A valid customer is required");
        }

        if (request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one product is required");
        }

        if (request.items().size() > 100) {
            throw new IllegalArgumentException(
                    "An order cannot contain more than 100 line items");
        }

        for (SalesOrderItemRequest item : request.items()) {
            if (item == null || item.productId() == null
                    || item.productId() <= 0) {
                throw new IllegalArgumentException(
                        "Every order item must have a valid product ID");
            }
        }

        if (request.notes() != null && request.notes().length() > 5000) {
            throw new IllegalArgumentException(
                    "Notes cannot exceed 5000 characters");
        }
    }

    /** Returns the next invoice number, e.g. INV-0042. */
    private String generateOrderNumber() {
        return String.format("INV-%04d", orderRepository.nextOrderNumber());
    }

    private SalesOrderResponse toResponse(
            SalesOrder order,
            Customer customer,
            List<SalesOrderItem> items,
            List<SalesOrderCharge> charges,
            BigDecimal amountPaid) {

        List<SalesOrderItemResponse> itemResponses = items.stream()
                .map(item -> new SalesOrderItemResponse(
                        item.getId(),
                        item.getProductId(),
                        item.getProductCodeSnapshot(),
                        item.getProductNameSnapshot(),
                        item.getUnitCodeSnapshot(),
                        item.getQuantity(),
                        item.getSecondaryQuantity(),
                        item.getPricingUnit(),
                        item.getUnitPrice(),
                        item.getGstRate(),
                        item.getTaxableAmount(),
                        item.getCgstAmount(),
                        item.getSgstAmount(),
                        item.getIgstAmount(),
                        item.getLineTotal()))
                .toList();
        List<SalesOrderChargeResponse> chargeResponses = charges.stream()
                .map(charge -> new SalesOrderChargeResponse(
                        charge.getId(), charge.getDescription(), charge.getAmount()))
                .toList();

        return new SalesOrderResponse(
                order.getId(),
                order.getOrderNumber(),
                order.getCustomerId(),
                customer.getName(),
                order.getOrderDate(),
                order.getStatus(),
                order.getTaxType(),
                order.getSubtotal(),
                order.getCgstAmount(),
                order.getSgstAmount(),
                order.getIgstAmount(),
                order.getTotalTax(),
                order.getGrandTotal(),
                order.getNotes(),
                order.getCreatedAt(),
                itemResponses,
                chargeResponses,
                amountPaid,
                order.getGrandTotal().subtract(amountPaid),
                PaymentStatus.of(order.getGrandTotal(), amountPaid));
    }
}
