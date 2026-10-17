
package com.indravaibhavmarble.purchase.repository;

import com.indravaibhavmarble.purchase.entity.Purchase;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PurchaseRepository extends JpaRepository<Purchase, Long> {

    List<Purchase> findAllByOrderByCreatedAtDesc();

    Optional<Purchase> findByPurchaseNumber(String purchaseNumber);

    boolean existsBySupplierIdAndSupplierInvoiceNumberIgnoreCase(
            Long supplierId,
            String supplierInvoiceNumber
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Purchase p WHERE p.id = :id")
    Optional<Purchase> findByIdForUpdate(@Param("id") Long id);
}
