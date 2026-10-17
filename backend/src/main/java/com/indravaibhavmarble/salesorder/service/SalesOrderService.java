
package com.indravaibhavmarble.salesorder.service;

import com.indravaibhavmarble.category.entity.ProductCategory;
import com.indravaibhavmarble.category.repository.ProductCategoryRepository;
import com.indravaibhavmarble.customer.entity.Customer;
import com.indravaibhavmarble.customer.repository.CustomerRepository;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemResponse;
import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import com.indravaibhavmarble.salesorder.entity.SalesOrderItem;
import com.indravaibhavmarble.salesorder.repository.SalesOrderItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderRepository;
import com.indravaibhavmarble.stockmovement.service.StockMovementService;
import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import com.indravaibhavmarble.unit.repository.MeasurementUnitRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class SalesOrderService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final SalesOrderRepository orderRepository;
    private final SalesOrderItemRepository itemRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final MeasurementUnitRepository unitRepository;
    private final ProductCategoryRepository categoryRepository;
    private final StockMovementService stockMovementService;

    public SalesOrderService(
            SalesOrderRepository orderRepository,
            SalesOrderItemRepository itemRepository,
            CustomerRepository customerRepository,
            ProductRepository productRepository,
            MeasurementUnitRepository unitRepository,
            ProductCategoryRepository categoryRepository,
            StockMovementService stockMovementService) {

        this.orderRepository = orderRepository;
        this.itemRepository = itemRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.unitRepository = unitRepository;
        this.categoryRepository = categoryRepository;
        this.stockMovementService = stockMovementService;
    }

    private record StockChange(
            Long productId,
            BigDecimal quantityChange,
            BigDecimal stockBefore,
            BigDecimal stockAfter) {
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
                ? LocalDate.now()
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

            if (itemRequest.quantity() == null
                    || itemRequest.quantity().signum() <= 0) {
                throw new IllegalArgumentException(
                        "Quantity must be greater than zero");
            }

            if (itemRequest.quantity().scale() > 3) {
                throw new IllegalArgumentException(
                        "Quantity cannot have more than 3 decimal places");
            }

            BigDecimal availableStock = product.getStockQuantity();

            if (availableStock == null
                    || availableStock.compareTo(itemRequest.quantity()) < 0) {
                throw new IllegalArgumentException(
                        "Insufficient stock for product "
                                + product.getProductCode()
                                + ". Available: " + availableStock
                                + ", requested: " + itemRequest.quantity());
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
                    .subtract(itemRequest.quantity());

            product.setStockQuantity(remainingStock);
            productRepository.save(product);

            stockChanges.add(new StockChange(
                    product.getId(),
                    itemRequest.quantity().negate(),
                    availableStock,
                    remainingStock));

           BigDecimal unitPrice = (
        itemRequest.unitPrice() != null
                ? itemRequest.unitPrice()
                : product.getSellingPrice()
).setScale(2, RoundingMode.HALF_UP);

            BigDecimal gstRate = product.getGstRate();

            BigDecimal taxableAmount = unitPrice
                    .multiply(itemRequest.quantity())
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
            item.setQuantity(itemRequest.quantity());
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
        BigDecimal grandTotal = subtotal.add(totalTax);

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
                            + savedOrder.getOrderNumber());
        }

        return toResponse(savedOrder, customer, savedItems);
    }

    @Transactional(readOnly = true)
    public List<SalesOrderResponse> getAllOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(order -> {
                    Customer customer = customerRepository.findById(
                            order.getCustomerId()).orElseThrow();

                    return toResponse(
                            order,
                            customer,
                            itemRepository.findBySalesOrderId(order.getId()));
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
                itemRepository.findBySalesOrderId(order.getId()));
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

    private String generateOrderNumber() {
        String date = LocalDate.now().format(
                DateTimeFormatter.ofPattern("yyyyMMdd"));

        return "SO-" + date + "-"
                + UUID.randomUUID().toString()
                        .substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private SalesOrderResponse toResponse(
            SalesOrder order,
            Customer customer,
            List<SalesOrderItem> items) {

        List<SalesOrderItemResponse> itemResponses = items.stream()
                .map(item -> new SalesOrderItemResponse(
                        item.getId(),
                        item.getProductId(),
                        item.getProductCodeSnapshot(),
                        item.getProductNameSnapshot(),
                        item.getUnitCodeSnapshot(),
                        item.getQuantity(),
                        item.getUnitPrice(),
                        item.getGstRate(),
                        item.getTaxableAmount(),
                        item.getCgstAmount(),
                        item.getSgstAmount(),
                        item.getIgstAmount(),
                        item.getLineTotal()))
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
                itemResponses);
    }
}
