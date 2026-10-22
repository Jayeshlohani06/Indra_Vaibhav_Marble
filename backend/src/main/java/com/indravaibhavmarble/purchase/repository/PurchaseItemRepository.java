
package com.indravaibhavmarble.purchase.repository;

import com.indravaibhavmarble.purchase.entity.PurchaseItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchaseItemRepository
        extends JpaRepository<PurchaseItem, Long> {

    List<PurchaseItem> findByPurchaseIdOrderByIdAsc(Long purchaseId);

    void deleteByPurchaseId(Long purchaseId);

    boolean existsByProductId(Long productId);
}
