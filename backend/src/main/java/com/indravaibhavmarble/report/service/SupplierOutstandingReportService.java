
package com.indravaibhavmarble.report.service;

import com.indravaibhavmarble.purchase.entity.Purchase;
import com.indravaibhavmarble.purchase.repository.PurchasePaymentRepository;
import com.indravaibhavmarble.purchase.repository.PurchaseRepository;
import com.indravaibhavmarble.report.dto.SupplierOutstandingResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.indravaibhavmarble.supplier.entity.Supplier;
import com.indravaibhavmarble.supplier.repository.SupplierRepository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class SupplierOutstandingReportService {

    private final PurchaseRepository purchaseRepository;
    private final PurchasePaymentRepository paymentRepository;
    private final SupplierRepository supplierRepository;

    public SupplierOutstandingReportService(
            PurchaseRepository purchaseRepository,
            PurchasePaymentRepository paymentRepository,
            SupplierRepository supplierRepository) {
        this.purchaseRepository = purchaseRepository;
        this.paymentRepository = paymentRepository;
        this.supplierRepository = supplierRepository;
    }

    public List<SupplierOutstandingResponse> getSupplierOutstandingReport() {

        List<Purchase> purchases =
                purchaseRepository.findByStatusOrderByPurchaseDateDescIdDesc(
                        "RECEIVED");

        Map<Long, List<Purchase>> purchasesBySupplier = new LinkedHashMap<>();

        for (Purchase purchase : purchases) {
            purchasesBySupplier
                    .computeIfAbsent(purchase.getSupplierId(), key -> new ArrayList<>())
                    .add(purchase);
        }

        List<SupplierOutstandingResponse> report = new ArrayList<>();

        for (Map.Entry<Long, List<Purchase>> entry : purchasesBySupplier.entrySet()) {
            Long supplierId = entry.getKey();
            List<Purchase> supplierPurchases = entry.getValue();

            BigDecimal purchaseTotal = supplierPurchases.stream()
                    .map(Purchase::getTotalAmount)
                    .filter(amount -> amount != null)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            List<Long> purchaseIds = supplierPurchases.stream()
                    .map(Purchase::getId)
                    .toList();

            BigDecimal totalPaid =
                    paymentRepository.getTotalPaidForPurchases(purchaseIds);

            BigDecimal outstandingBalance = purchaseTotal.subtract(totalPaid);

            Supplier supplier = supplierRepository.findById(supplierId)
                    .orElseThrow(() ->
                            new IllegalStateException(
                                    "Supplier not found for ID: " + supplierId));

            report.add(new SupplierOutstandingResponse(
                    supplierId,
                    supplier.getName(),
                    supplierPurchases.size(),
                    purchaseTotal,
                    totalPaid,
                    outstandingBalance
            ));
        }

        return report;
    }
}
