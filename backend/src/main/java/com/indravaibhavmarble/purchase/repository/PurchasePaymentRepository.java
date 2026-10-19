
package com.indravaibhavmarble.purchase.repository;

import com.indravaibhavmarble.purchase.entity.PurchasePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PurchasePaymentRepository
        extends JpaRepository<PurchasePayment, Long> {

    List<PurchasePayment>
    findByPurchaseIdOrderByPaymentDateDescIdDesc(Long purchaseId);

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM PurchasePayment p
            WHERE p.purchaseId = :purchaseId
            """)
    BigDecimal getTotalPaidForPurchase(
            @Param("purchaseId") Long purchaseId);

    @Query("""
            SELECT COALESCE(SUM(p.amount), 0)
            FROM PurchasePayment p
            WHERE p.purchaseId IN :purchaseIds
            """)
    BigDecimal getTotalPaidForPurchases(
            @Param("purchaseIds") List<Long> purchaseIds);

    @Query("""
            SELECT p.paymentDate, COUNT(p), COALESCE(SUM(p.amount), 0)
            FROM PurchasePayment p
            GROUP BY p.paymentDate
            ORDER BY p.paymentDate DESC
            """)
    List<Object[]> getPaymentDateSummaries();
}
