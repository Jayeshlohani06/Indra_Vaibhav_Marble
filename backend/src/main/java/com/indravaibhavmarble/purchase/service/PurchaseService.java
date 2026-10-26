
package com.indravaibhavmarble.purchase.service;

import com.indravaibhavmarble.common.time.BusinessDate;

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
import com.indravaibhavmarble.purchase.entity.PurchaseExpense;
import com.indravaibhavmarble.purchase.repository.PurchaseItemRepository;
import com.indravaibhavmarble.purchase.repository.PurchaseExpenseRepository;
import com.indravaibhavmarble.purchase.repository.PurchasePaymentRepository;
import com.indravaibhavmarble.common.payment.PaymentStatus;
import com.indravaibhavmarble.purchase.repository.PurchaseRepository;
import com.indravaibhavmarble.expense.entity.ExpenseCategory;
import com.indravaibhavmarble.expense.repository.ExpenseCategoryRepository;
import com.indravaibhavmarble.supplier.entity.Supplier;
import com.indravaibhavmarble.supplier.repository.SupplierRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class PurchaseService {
    private record DualQuantities(BigDecimal primary, BigDecimal secondary) {}

    private static final BigDecimal ZERO = new BigDecimal("0.00");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final PurchaseRepository purchaseRepository;
    private final PurchaseItemRepository itemRepository;
    private final PurchaseExpenseRepository purchaseExpenseRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final ProductInventorySettingRepository settingRepository;
    private final PurchaseNumberGenerator numberGenerator;
    private final StockMovementService stockMovementService;
    private final PurchasePaymentRepository paymentRepository;

    public PurchaseService(
            PurchaseRepository purchaseRepository,
            PurchaseItemRepository itemRepository,
            PurchaseExpenseRepository purchaseExpenseRepository,
            ExpenseCategoryRepository expenseCategoryRepository,
            SupplierRepository supplierRepository,
            ProductRepository productRepository,
            ProductInventorySettingRepository settingRepository,
            PurchaseNumberGenerator numberGenerator,
            StockMovementService stockMovementService,
            PurchasePaymentRepository paymentRepository) {
        this.purchaseRepository = purchaseRepository;
        this.itemRepository = itemRepository;
        this.purchaseExpenseRepository = purchaseExpenseRepository;
        this.expenseCategoryRepository = expenseCategoryRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.settingRepository = settingRepository;
        this.numberGenerator = numberGenerator;
        this.stockMovementService = stockMovementService;
        this.paymentRepository = paymentRepository;
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
        String taxType = normalizeTaxType(request.taxType());
        BigDecimal invoiceGstRate = money(request.gstRate());
        validateGstRate(invoiceGstRate);
        purchase.setTaxType(taxType);
        purchase.setGstRate(invoiceGstRate);
        purchase.setNotes(normalize(request.notes()));

        BigDecimal subtotal = ZERO;
        BigDecimal itemDiscountTotal = ZERO;

        List<PurchaseItem> items = new ArrayList<>();
        List<BigDecimal> taxableAmounts = new ArrayList<>();

        for (PurchaseRequest.PurchaseItemRequest line : request.items()) {
            Product product = productRepository.findById(line.productId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Product not found: " + line.productId()));

            if (!product.isActive()) {
                throw new IllegalArgumentException(
                        "Inactive products cannot be purchased: "
                                + product.getName());
            }
            rejectSlabTrackedProduct(product);

            BigDecimal quantity = line.quantity();
            DualQuantities quantities = resolveQuantities(product, quantity,
                    line.secondaryQuantity());
            quantity = quantities.primary();
            BigDecimal rate = money(line.purchaseRate());
            BigDecimal discount = money(
                    line.discountAmount() == null
                            ? ZERO : line.discountAmount());
            BigDecimal gstRate = request.gstRate() == null
                    ? (line.gstRate() == null
                            ? product.getGstRate() : line.gstRate())
                    : invoiceGstRate;

            validateLine(quantity, rate, discount, gstRate);

            BigDecimal billableQuantity = "SECONDARY".equalsIgnoreCase(
                    line.pricingUnit()) ? quantities.secondary() : quantity;
            BigDecimal gross = billableQuantity.multiply(rate)
                    .setScale(2, RoundingMode.HALF_UP);

            if (discount.compareTo(gross) > 0) {
                throw new IllegalArgumentException(
                        "Line discount cannot exceed its gross amount");
            }

            BigDecimal taxable = gross.subtract(discount);

            PurchaseItem item = new PurchaseItem();
            item.setProductId(product.getId());
            item.setProductCode(product.getProductCode());
            item.setProductName(product.getName());
            item.setQuantity(quantity);
            item.setSecondaryQuantity(quantities.secondary());
            item.setPricingUnit(normalizePricingUnit(line.pricingUnit()));
            item.setPurchaseRate(rate);
            item.setDiscountAmount(discount);
            item.setGstRate(gstRate);

            items.add(item);
            taxableAmounts.add(taxable);
            subtotal = subtotal.add(gross);
            itemDiscountTotal = itemDiscountTotal.add(discount);
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

        BigDecimal gstTotal = applyGst(items, taxableAmounts, invoiceDiscount);

        BigDecimal expenseAmount = expenseTotal(request.expenses());
        BigDecimal expenseGst = expenseGstTotal(
                request.expenses(), invoiceGstRate);
        gstTotal = gstTotal.add(expenseGst);
        BigDecimal total = subtotal.subtract(totalDiscount)
                .add(gstTotal)
                .add(expenseAmount);

        purchase.setSubtotal(subtotal);
        purchase.setDiscountAmount(totalDiscount);
        purchase.setGstAmount(gstTotal);
        purchase.setGstRate(invoiceGstRate);
        purchase.setTotalAmount(total);

        Purchase savedPurchase = purchaseRepository.saveAndFlush(purchase);

        for (PurchaseItem item : items) {
            item.setPurchaseId(savedPurchase.getId());
        }

        itemRepository.saveAll(items);
        savePurchaseExpenses(savedPurchase.getId(), request.expenses());

        return toResponse(savedPurchase, supplier.getName(), items);
    }

    @Transactional(readOnly = true)
    public List<PurchaseResponse> getAllPurchases() {
        List<Purchase> purchases =
                purchaseRepository.findAllByOrderByCreatedAtDesc();
        if (purchases.isEmpty()) {
            return List.of();
        }

        // Load related rows in bulk instead of several queries per purchase.
        List<Long> purchaseIds = purchases.stream()
                .map(Purchase::getId)
                .toList();

        Map<Long, String> supplierNames = supplierRepository
                .findAllById(purchases.stream()
                        .map(Purchase::getSupplierId)
                        .distinct()
                        .toList())
                .stream()
                .collect(Collectors.toMap(Supplier::getId, Supplier::getName));

        Map<Long, List<PurchaseItem>> itemsByPurchase = itemRepository
                .findByPurchaseIdInOrderByIdAsc(purchaseIds)
                .stream()
                .collect(Collectors.groupingBy(PurchaseItem::getPurchaseId));

        Map<Long, List<PurchaseExpense>> expensesByPurchase =
                purchaseExpenseRepository
                        .findByPurchaseIdInOrderByIdAsc(purchaseIds)
                        .stream()
                        .collect(Collectors.groupingBy(
                                PurchaseExpense::getPurchaseId));

        Map<Long, BigDecimal> paidByPurchase = paymentRepository
                .getTotalPaidByPurchase(purchaseIds)
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0], row -> (BigDecimal) row[1]));

        return purchases.stream()
                .map(purchase -> toResponse(
                        purchase,
                        supplierNames.getOrDefault(
                                purchase.getSupplierId(),
                                "Unavailable supplier"),
                        itemsByPurchase.getOrDefault(
                                purchase.getId(), List.of()),
                        expensesByPurchase.getOrDefault(
                                purchase.getId(), List.of()),
                        paidByPurchase.getOrDefault(
                                purchase.getId(), BigDecimal.ZERO)))
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

    public PurchaseResponse updatePurchase(Long purchaseId, PurchaseRequest request) {
        validateRequest(request);

        // Lock the purchase so it cannot be received while being edited.
        Purchase purchase = purchaseRepository.findByIdForUpdate(purchaseId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Purchase not found: " + purchaseId));

        if (!"DRAFT".equals(purchase.getStatus())) {
            throw new IllegalArgumentException(
                    "Only DRAFT purchases can be edited");
        }

        Supplier supplier = supplierRepository
                .findByIdAndActiveTrue(request.supplierId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Active supplier not found"));

        String invoiceNumber = normalize(request.supplierInvoiceNumber());
        if (invoiceNumber != null
                && purchaseRepository
                .existsBySupplierIdAndSupplierInvoiceNumberIgnoreCase(
                        request.supplierId(), invoiceNumber)
                && !(request.supplierId().equals(purchase.getSupplierId())
                && invoiceNumber.equalsIgnoreCase(
                        String.valueOf(purchase.getSupplierInvoiceNumber())))) {
            throw new IllegalArgumentException(
                    "This supplier invoice number already exists");
        }

        BigDecimal subtotal = ZERO;
        BigDecimal itemDiscountTotal = ZERO;
        List<PurchaseItem> items = new ArrayList<>();
        List<BigDecimal> taxableAmounts = new ArrayList<>();
        String taxType = normalizeTaxType(request.taxType());
        BigDecimal invoiceGstRate = money(request.gstRate());
        validateGstRate(invoiceGstRate);

        for (PurchaseRequest.PurchaseItemRequest line : request.items()) {
            Product product = productRepository.findById(line.productId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Product not found: " + line.productId()));
            if (!product.isActive()) {
                throw new IllegalArgumentException(
                        "Inactive products cannot be purchased: "
                                + product.getName());
            }
            rejectSlabTrackedProduct(product);

            BigDecimal quantity = line.quantity();
            DualQuantities quantities = resolveQuantities(product, quantity,
                    line.secondaryQuantity());
            quantity = quantities.primary();
            BigDecimal rate = money(line.purchaseRate());
            BigDecimal discount = money(line.discountAmount());
            BigDecimal gstRate = request.gstRate() == null
                    ? (line.gstRate() == null
                            ? product.getGstRate() : line.gstRate())
                    : invoiceGstRate;
            validateLine(quantity, rate, discount, gstRate);

            BigDecimal billableQuantity = "SECONDARY".equalsIgnoreCase(
                    line.pricingUnit()) ? quantities.secondary() : quantity;
            BigDecimal gross = billableQuantity.multiply(rate)
                    .setScale(2, RoundingMode.HALF_UP);
            if (discount.compareTo(gross) > 0) {
                throw new IllegalArgumentException(
                        "Line discount cannot exceed its gross amount");
            }
            BigDecimal taxable = gross.subtract(discount);

            PurchaseItem item = new PurchaseItem();
            item.setPurchaseId(purchaseId);
            item.setProductId(product.getId());
            item.setProductCode(product.getProductCode());
            item.setProductName(product.getName());
            item.setQuantity(quantity);
            item.setSecondaryQuantity(quantities.secondary());
            item.setPricingUnit(normalizePricingUnit(line.pricingUnit()));
            item.setPurchaseRate(rate);
            item.setDiscountAmount(discount);
            item.setGstRate(gstRate);
            items.add(item);
            taxableAmounts.add(taxable);

            subtotal = subtotal.add(gross);
            itemDiscountTotal = itemDiscountTotal.add(discount);
        }

        BigDecimal invoiceDiscount = money(request.discountAmount());
        BigDecimal available = subtotal.subtract(itemDiscountTotal);
        if (invoiceDiscount.signum() < 0
                || invoiceDiscount.compareTo(available) > 0) {
            throw new IllegalArgumentException(
                    "Purchase discount exceeds the amount available");
        }

        BigDecimal gstTotal = applyGst(items, taxableAmounts, invoiceDiscount);

        purchase.setSupplierId(supplier.getId());
        purchase.setSupplierInvoiceNumber(invoiceNumber);
        purchase.setPurchaseDate(request.purchaseDate());
        purchase.setTaxType(taxType);
        purchase.setGstRate(invoiceGstRate);
        purchase.setNotes(normalize(request.notes()));
        purchase.setSubtotal(subtotal);
        purchase.setDiscountAmount(itemDiscountTotal.add(invoiceDiscount));
        BigDecimal expenseAmount = expenseTotal(request.expenses());
        BigDecimal expenseGst = expenseGstTotal(
                request.expenses(), invoiceGstRate);
        purchase.setGstAmount(gstTotal.add(expenseGst));
        purchase.setTotalAmount(
                subtotal.subtract(itemDiscountTotal.add(invoiceDiscount))
                        .add(gstTotal)
                        .add(expenseGst)
                        .add(expenseAmount));

        purchaseRepository.save(purchase);
        itemRepository.deleteByPurchaseId(purchaseId);
        itemRepository.saveAll(items);
        purchaseExpenseRepository.deleteByPurchaseId(purchaseId);
        savePurchaseExpenses(purchaseId, request.expenses());

        return toResponse(purchase, supplier.getName(), items);
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
            // Products without advanced inventory settings use the normal
            // quantity-based flow. Only products explicitly configured for
            // slab tracking need the separate slab receiving workflow.
            ProductInventorySetting setting = settingRepository
                    .findByProductId(item.getProductId())
                    .orElse(null);

            if (setting != null
                    && setting.getTrackingType() == InventoryTrackingType.SLAB) {
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
            movement.setSecondaryQuantityChange(item.getSecondaryQuantity());

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

        return toResponse(
                purchase,
                supplierName,
                items,
                purchaseExpenseRepository.findByPurchaseIdOrderByIdAsc(
                        purchase.getId()),
                purchase.getId() == null
                        ? BigDecimal.ZERO
                        : paymentRepository.getTotalPaidForPurchase(
                                purchase.getId()));
    }

    private PurchaseResponse toResponse(
            Purchase purchase,
            String supplierName,
            List<PurchaseItem> items,
            List<PurchaseExpense> purchaseExpenses,
            BigDecimal amountPaid) {

        List<PurchaseResponse.PurchaseItemResponse> itemResponses =
                items.stream()
                        .map(item ->
                                new PurchaseResponse.PurchaseItemResponse(
                                        item.getId(),
                                        item.getProductId(),
                                        item.getProductCode(),
                                        item.getProductName(),
                                        item.getQuantity(),
                                        item.getSecondaryQuantity(),
                                        item.getPricingUnit(),
                                        item.getPurchaseRate(),
                                        item.getDiscountAmount(),
                                        item.getGstRate(),
                                        item.getGstAmount(),
                                        item.getLineTotal()))
                        .toList();
        List<PurchaseResponse.PurchaseExpenseResponse> expenseResponses =
                purchaseExpenses.stream()
                        .map(expense -> new PurchaseResponse.PurchaseExpenseResponse(
                                expense.getId(),
                                expense.getCategoryId(),
                                expense.getDescription(),
                                expense.getAmount()))
                        .toList();
        BigDecimal purchaseExpenseAmount = purchaseExpenses.stream()
                .map(PurchaseExpense::getAmount)
                .reduce(ZERO, BigDecimal::add);
        BigDecimal normalizedTotal = purchase.getSubtotal()
                .subtract(purchase.getDiscountAmount())
                .add(purchase.getGstAmount())
                .add(purchaseExpenseAmount)
                .setScale(2, RoundingMode.HALF_UP);

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
                purchase.getTaxType(),
                purchase.getGstRate(),
                "INTRA".equals(purchase.getTaxType())
                        ? purchase.getGstAmount().divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP)
                        : ZERO,
                "INTRA".equals(purchase.getTaxType())
                        ? purchase.getGstAmount().subtract(purchase.getGstAmount()
                                .divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP))
                        : ZERO,
                "IGST".equals(purchase.getTaxType())
                        ? purchase.getGstAmount() : ZERO,
                expenseGstTotal(
                        purchaseExpenses.stream()
                                .map(expense -> new PurchaseRequest.PurchaseExpenseRequest(
                                        expense.getCategoryId(),
                                        expense.getDescription(),
                                        expense.getAmount()))
                                .toList(),
                        purchase.getGstRate()),
                normalizedTotal,
                purchase.getNotes(),
                purchase.getCreatedAt(),
                itemResponses,
                expenseResponses,
                amountPaid,
                normalizedTotal.subtract(amountPaid),
                PaymentStatus.of(normalizedTotal, amountPaid));
    }

    private void validateRequest(PurchaseRequest request) {
        if (request == null || request.supplierId() == null) {
            throw new IllegalArgumentException("Supplier is required");
        }

        if (request.purchaseDate() == null) {
            throw new IllegalArgumentException("Purchase date is required");
        }

        if (request.purchaseDate().isAfter(BusinessDate.today())) {
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

        validatePurchaseExpenses(request.expenses());
    }

    /**
     * SLAB-tracked products are received through the slab workflow, so a
     * purchase containing one could never be received. Reject it up front
     * instead of leaving the purchase stuck in DRAFT.
     */
    private void rejectSlabTrackedProduct(Product product) {
        settingRepository.findByProductId(product.getId())
                .filter(setting -> setting.getTrackingType()
                        == InventoryTrackingType.SLAB)
                .ifPresent(setting -> {
                    throw new IllegalArgumentException(
                            "Product " + product.getName()
                                    + " uses SLAB tracking. Register its slabs "
                                    + "through the slab inventory workflow instead.");
                });
    }

    private DualQuantities resolveQuantities(
            Product product,
            BigDecimal primary,
            BigDecimal secondary) {
        boolean hasSecondary = product.getSecondaryUnitId() != null;
        if (!hasSecondary) {
            if (primary == null || primary.signum() <= 0) {
                throw new IllegalArgumentException("Quantity must be greater than zero");
            }
            return new DualQuantities(primary, null);
        }
        BigDecimal resolvedPrimary = primary;
        BigDecimal resolvedSecondary = secondary;
        BigDecimal conversion = product.getSecondaryPerPrimary();
        if (resolvedPrimary == null && resolvedSecondary != null && conversion != null) {
            resolvedPrimary = resolvedSecondary.divide(conversion, 3, RoundingMode.HALF_UP);
        }
        if (resolvedSecondary == null && resolvedPrimary != null && conversion != null) {
            resolvedSecondary = resolvedPrimary.multiply(conversion)
                    .setScale(3, RoundingMode.HALF_UP);
        }
        if (resolvedPrimary == null || resolvedSecondary == null
                || resolvedPrimary.signum() <= 0 || resolvedSecondary.signum() <= 0) {
            throw new IllegalArgumentException(
                    "Both primary and secondary quantities are required for "
                            + product.getName());
        }
        return new DualQuantities(resolvedPrimary, resolvedSecondary);
    }

    private String normalizePricingUnit(String pricingUnit) {
        String normalized = normalize(pricingUnit);
        if (normalized == null) return "PRIMARY";
        normalized = normalized.toUpperCase(Locale.ROOT);
        if (!normalized.equals("PRIMARY") && !normalized.equals("SECONDARY")) {
            throw new IllegalArgumentException("Pricing unit must be PRIMARY or SECONDARY");
        }
        return normalized;
    }

    private BigDecimal expenseTotal(
            List<PurchaseRequest.PurchaseExpenseRequest> expenses) {
        if (expenses == null) {
            return ZERO;
        }
        return expenses.stream()
                .map(expense -> money(expense.amount()))
                .reduce(ZERO, BigDecimal::add);
    }

    private BigDecimal expenseGstTotal(
            List<PurchaseRequest.PurchaseExpenseRequest> expenses,
            BigDecimal gstRate) {
        return expenseTotal(expenses).multiply(money(gstRate))
                .divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }

    /**
     * Spreads the invoice-level discount across the lines in proportion to
     * their taxable value, then calculates each line's GST on the discounted
     * value. The line with the largest taxable value absorbs any rounding
     * remainder of the discount. Returns the total GST of all lines.
     */
    private BigDecimal applyGst(
            List<PurchaseItem> items,
            List<BigDecimal> taxableAmounts,
            BigDecimal invoiceDiscount) {

        BigDecimal taxableTotal = taxableAmounts.stream()
                .reduce(ZERO, BigDecimal::add);

        int largestLine = 0;
        for (int i = 1; i < taxableAmounts.size(); i++) {
            if (taxableAmounts.get(i).compareTo(
                    taxableAmounts.get(largestLine)) > 0) {
                largestLine = i;
            }
        }

        List<BigDecimal> lineDiscounts = new ArrayList<>();
        BigDecimal allocated = ZERO;
        for (BigDecimal taxable : taxableAmounts) {
            BigDecimal lineDiscount = taxableTotal.signum() == 0
                    ? ZERO
                    : invoiceDiscount.multiply(taxable)
                            .divide(taxableTotal, 2, RoundingMode.HALF_UP);
            lineDiscounts.add(lineDiscount);
            allocated = allocated.add(lineDiscount);
        }
        lineDiscounts.set(largestLine, lineDiscounts.get(largestLine)
                .add(invoiceDiscount.subtract(allocated)));

        BigDecimal gstTotal = ZERO;

        for (int i = 0; i < items.size(); i++) {
            PurchaseItem item = items.get(i);
            BigDecimal discountedTaxable =
                    taxableAmounts.get(i).subtract(lineDiscounts.get(i));
            BigDecimal gst = discountedTaxable.multiply(item.getGstRate())
                    .divide(HUNDRED, 2, RoundingMode.HALF_UP);

            item.setGstAmount(gst);
            item.setLineTotal(discountedTaxable.add(gst));
            gstTotal = gstTotal.add(gst);
        }

        return gstTotal;
    }

    private void validatePurchaseExpenses(
            List<PurchaseRequest.PurchaseExpenseRequest> expenses) {
        if (expenses == null) {
            return;
        }
        if (expenses.size() > 30) {
            throw new IllegalArgumentException(
                    "A purchase cannot contain more than 30 additional expenses");
        }
        for (PurchaseRequest.PurchaseExpenseRequest expense : expenses) {
            if (expense == null || expense.categoryId() == null) {
                throw new IllegalArgumentException(
                        "Every purchase expense needs a category");
            }
            if (expense.amount() == null
                    || expense.amount().signum() <= 0) {
                throw new IllegalArgumentException(
                        "Purchase expense amount must be greater than zero");
            }
            expenseCategoryRepository.findById(expense.categoryId())
                    .filter(ExpenseCategory::isActive)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Active expense category not found"));
        }
    }

    private void savePurchaseExpenses(
            Long purchaseId,
            List<PurchaseRequest.PurchaseExpenseRequest> expenses) {
        if (expenses == null) {
            return;
        }
        List<PurchaseExpense> entities = expenses.stream()
                .map(expense -> {
                    PurchaseExpense entity = new PurchaseExpense();
                    entity.setPurchaseId(purchaseId);
                    entity.setCategoryId(expense.categoryId());
                    entity.setDescription(
                            normalize(expense.description()) == null
                                    ? expenseCategoryRepository.findById(
                                            expense.categoryId())
                                    .map(ExpenseCategory::getName)
                                    .orElse("Purchase expense")
                                    : normalize(expense.description()));
                    entity.setAmount(money(expense.amount()));
                    return entity;
                })
                .toList();
        purchaseExpenseRepository.saveAll(entities);
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

    private void validateGstRate(BigDecimal gstRate) {
        if (gstRate.signum() < 0 || gstRate.compareTo(HUNDRED) > 0) {
            throw new IllegalArgumentException(
                    "GST rate must be between 0 and 100");
        }
    }

    private String normalizeTaxType(String taxType) {
        String normalized = taxType == null
                ? "INTRA" : taxType.trim().toUpperCase();
        if (!"INTRA".equals(normalized) && !"IGST".equals(normalized)) {
            throw new IllegalArgumentException(
                    "Tax type must be INTRA or IGST");
        }
        return normalized;
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
