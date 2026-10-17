
package com.indravaibhavmarble.purchase.service;

import com.indravaibhavmarble.inventory.entity.InventoryTrackingType;
import com.indravaibhavmarble.inventory.entity.ProductInventorySetting;
import com.indravaibhavmarble.stockmovement.entity.StockMovement;
import com.indravaibhavmarble.stockmovement.service.StockMovementService;

import com.indravaibhavmarble.inventory.repository.ProductInventorySettingRepository;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.purchase.dto.PurchaseRequest;
import com.indravaibhavmarble.purchase.dto.PurchaseResponse;
import com.indravaibhavmarble.purchase.entity.Purchase;
import com.indravaibhavmarble.purchase.entity.PurchaseItem;
import com.indravaibhavmarble.purchase.repository.PurchaseItemRepository;
import com.indravaibhavmarble.purchase.repository.PurchaseRepository;
import com.indravaibhavmarble.supplier.entity.Supplier;
import com.indravaibhavmarble.supplier.repository.SupplierRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class PurchaseService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository itemRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final ProductInventorySettingRepository settingRepository;
    private final PurchaseNumberGenerator numberGenerator;
    private final StockMovementService stockMovementService;

    public PurchaseService(
            PurchaseRepository purchaseRepository,
            PurchaseItemRepository itemRepository,
            SupplierRepository supplierRepository,
            ProductRepository productRepository,
            ProductInventorySettingRepository settingRepository,
            PurchaseNumberGenerator numberGenerator,
            StockMovementService stockMovementService) {
        this.purchaseRepository = purchaseRepository;
        this.itemRepository = itemRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.settingRepository = settingRepository;
        this.numberGenerator = numberGenerator;
        this.stockMovementService = stockMovementService;
    }

    public PurchaseResponse createPurchase(PurchaseRequest request) {
        validateRequest(request);

        Supplier supplier = supplierRepository
                .findByIdAndActiveTrue(request.supplierId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Active supplier not found"));

        String invoiceNumber = normalize(request.supplierInvoiceNumber());

        if (invoiceNumber != null
                && purchaseRepository
                .existsBySupplierIdAndSupplierInvoiceNumberIgnoreCase(
                        request.supplierId(), invoiceNumber)) {
            throw new IllegalArgumentException(
                    "This supplier invoice number already exists");
        }

        Purchase purchase = new Purchase();
        purchase.setPurchaseNumber(numberGenerator.generate());
        purchase.setSupplierId(supplier.getId());
        purchase.setSupplierInvoiceNumber(invoiceNumber);
        purchase.setPurchaseDate(request.purchaseDate());
        purchase.setStatus("DRAFT");
        purchase.setNotes(normalize(request.notes()));

        BigDecimal subtotal = ZERO;
        BigDecimal itemDiscountTotal = ZERO;
        BigDecimal gstTotal = ZERO;

        List<PurchaseItem> items = new ArrayList<>();

        for (PurchaseRequest.PurchaseItemRequest line : request.items()) {
            Product product = productRepository.findById(line.productId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Product not found: " + line.productId()));

            if (!product.isActive()) {
                throw new IllegalArgumentException(
                        "Inactive products cannot be purchased: "
                                + product.getName());
            }

            BigDecimal quantity = line.quantity();
            BigDecimal rate = money(line.purchaseRate());
            BigDecimal discount = money(
                    line.discountAmount() == null
                            ? ZERO : line.discountAmount());
            BigDecimal gstRate = line.gstRate() == null
                    ? product.getGstRate() : line.gstRate();

            validateLine(quantity, rate, discount, gstRate);

            BigDecimal gross = quantity.multiply(rate)
                    .setScale(2, RoundingMode.HALF_UP);

            if (discount.compareTo(gross) > 0) {
                throw new IllegalArgumentException(
                        "Line discount cannot exceed its gross amount");
            }

            BigDecimal taxable = gross.subtract(discount);

            BigDecimal gst = taxable.multiply(gstRate)
                    .divide(HUNDRED, 2, RoundingMode.HALF_UP);

            BigDecimal lineTotal = taxable.add(gst);

            PurchaseItem item = new PurchaseItem();
            item.setProductId(product.getId());
            item.setProductCode(product.getProductCode());
            item.setProductName(product.getName());
            item.setQuantity(quantity);
            item.setPurchaseRate(rate);
            item.setDiscountAmount(discount);
            item.setGstRate(gstRate);
            item.setGstAmount(gst);
            item.setLineTotal(lineTotal);

            items.add(item);
            subtotal = subtotal.add(gross);
            itemDiscountTotal = itemDiscountTotal.add(discount);
            gstTotal = gstTotal.add(gst);
        }

        BigDecimal invoiceDiscount = money(
                request.discountAmount() == null
                        ? ZERO : request.discountAmount());

        BigDecimal availableForInvoiceDiscount =
                subtotal.subtract(itemDiscountTotal);

        if (invoiceDiscount.signum() < 0
                || invoiceDiscount.compareTo(
                        availableForInvoiceDiscount) > 0) {
            throw new IllegalArgumentException(
                    "Purchase discount exceeds the amount available");
        }

        BigDecimal totalDiscount =
                itemDiscountTotal.add(invoiceDiscount);

        BigDecimal total = subtotal.subtract(totalDiscount).add(gstTotal);

        purchase.setSubtotal(subtotal);
        purchase.setDiscountAmount(totalDiscount);
        purchase.setGstAmount(gstTotal);
        purchase.setTotalAmount(total);

        Purchase savedPurchase = purchaseRepository.saveAndFlush(purchase);

        for (PurchaseItem item : items) {
            item.setPurchaseId(savedPurchase.getId());
        }

        itemRepository.saveAll(items);

        return toResponse(savedPurchase, supplier.getName(), items);
    }

    @Transactional(readOnly = true)
    public List<PurchaseResponse> getAllPurchases() {
        return purchaseRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(purchase -> {
                    String supplierName = supplierRepository
                            .findById(purchase.getSupplierId())
                            .map(Supplier::getName)
                            .orElse("Unavailable supplier");

                    List<PurchaseItem> items =
                            itemRepository.findByPurchaseIdOrderByIdAsc(
                                    purchase.getId());

                    return toResponse(purchase, supplierName, items);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public PurchaseResponse getPurchase(Long id) {
        Purchase purchase = purchaseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Purchase not found: " + id));

        String supplierName = supplierRepository
                .findById(purchase.getSupplierId())
                .map(Supplier::getName)
                .orElse("Unavailable supplier");

        List<PurchaseItem> items =
                itemRepository.findByPurchaseIdOrderByIdAsc(id);

        return toResponse(purchase, supplierName, items);
    }

    public PurchaseResponse receivePurchase(Long purchaseId) {
        if (purchaseId == null) {
            throw new IllegalArgumentException("Purchase ID is required");
        }

        // Lock the purchase to prevent duplicate or concurrent receiving.
        Purchase purchase = purchaseRepository.findByIdForUpdate(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Purchase not found: " + purchaseId));

        if (!"DRAFT".equals(purchase.getStatus())) {
            throw new IllegalArgumentException(
                    "Only DRAFT purchases can be received. Current status: "
                            + purchase.getStatus());
        }

        List<PurchaseItem> items =
                itemRepository.findByPurchaseIdOrderByIdAsc(purchaseId);

        if (items.isEmpty()) {
            throw new IllegalArgumentException(
                    "Cannot receive a purchase without items");
        }

        // Validate every item before applying any stock changes.
        for (PurchaseItem item : items) {
            ProductInventorySetting setting = settingRepository
                    .findByProductId(item.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Configure inventory tracking for product "
                                    + item.getProductName()
                                    + " before receiving this purchase"));

            if (setting.getTrackingType() == InventoryTrackingType.SLAB) {
                throw new IllegalArgumentException(
                        "Product " + item.getProductName()
                                + " uses SLAB tracking. Receive individual slabs "
                                + "through the slab inventory workflow instead.");
            }

            if (item.getQuantity() == null
                    || item.getQuantity().signum() <= 0) {
                throw new IllegalArgumentException(
                        "Invalid received quantity for "
                                + item.getProductName());
            }
        }

        // Stock movements and status change share this transaction.
        for (PurchaseItem item : items) {
            StockMovement movement = StockMovement.createNew(
                    item.getProductId(),
                    "PURCHASE",
                    item.getQuantity(),
                    null,
                    null,
                    "PURCHASE",
                    purchase.getId(),
                    purchase.getPurchaseNumber(),
                    "Received from supplier invoice "
                            + (purchase.getSupplierInvoiceNumber() == null
                                    ? purchase.getPurchaseNumber()
                                    : purchase.getSupplierInvoiceNumber())
            );

            stockMovementService.recordMovement(movement);
        }

        purchase.setStatus("RECEIVED");
        purchaseRepository.save(purchase);

        String supplierName = supplierRepository
                .findById(purchase.getSupplierId())
                .map(Supplier::getName)
                .orElse("Unavailable supplier");

        return toResponse(purchase, supplierName, items);
    }

    private PurchaseResponse toResponse(
            Purchase purchase,
            String supplierName,
            List<PurchaseItem> items) {

        List<PurchaseResponse.PurchaseItemResponse> itemResponses =
                items.stream()
                        .map(item ->
                                new PurchaseResponse.PurchaseItemResponse(
                                        item.getId(),
                                        item.getProductId(),
                                        item.getProductCode(),
                                        item.getProductName(),
                                        item.getQuantity(),
                                        item.getPurchaseRate(),
                                        item.getDiscountAmount(),
                                        item.getGstRate(),
                                        item.getGstAmount(),
                                        item.getLineTotal()))
                        .toList();

        return new PurchaseResponse(
                purchase.getId(),
                purchase.getPurchaseNumber(),
                purchase.getSupplierId(),
                supplierName,
                purchase.getSupplierInvoiceNumber(),
                purchase.getPurchaseDate(),
                purchase.getStatus(),
                purchase.getSubtotal(),
                purchase.getDiscountAmount(),
                purchase.getGstAmount(),
                purchase.getTotalAmount(),
                purchase.getNotes(),
                purchase.getCreatedAt(),
                itemResponses);
    }

    private void validateRequest(PurchaseRequest request) {
        if (request == null || request.supplierId() == null) {
            throw new IllegalArgumentException("Supplier is required");
        }

        if (request.purchaseDate() == null) {
            throw new IllegalArgumentException("Purchase date is required");
        }

        if (request.purchaseDate().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException(
                    "Purchase date cannot be in the future");
        }

        if (request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one purchase item is required");
        }

        if (request.items().stream().anyMatch(
                item -> item == null || item.productId() == null)) {
            throw new IllegalArgumentException(
                    "Every item must have a product");
        }
    }

    private void validateLine(
            BigDecimal quantity,
            BigDecimal rate,
            BigDecimal discount,
            BigDecimal gstRate) {

        if (quantity == null || quantity.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Quantity must be greater than zero");
        }

        if (rate.signum() < 0) {
            throw new IllegalArgumentException(
                    "Purchase rate cannot be negative");
        }

        if (discount.signum() < 0) {
            throw new IllegalArgumentException(
                    "Discount cannot be negative");
        }

        if (gstRate == null || gstRate.signum() < 0
                || gstRate.compareTo(HUNDRED) > 0) {
            throw new IllegalArgumentException(
                    "GST rate must be between 0 and 100");
        }
    }

    private BigDecimal money(BigDecimal value) {
        if (value == null) {
            return ZERO;
        }

        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }
}
