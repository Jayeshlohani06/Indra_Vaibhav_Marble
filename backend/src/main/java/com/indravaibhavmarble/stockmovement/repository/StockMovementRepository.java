
package com.indravaibhavmarble.stockmovement.repository;

import com.indravaibhavmarble.stockmovement.entity.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockMovementRepository
        extends JpaRepository<StockMovement, Long> {

    List<StockMovement> findAllByOrderByCreatedAtDesc();

    List<StockMovement> findByProductIdOrderByCreatedAtDesc(Long productId);

    java.util.Optional<StockMovement> findByReferenceTypeAndReferenceId(
            String referenceType, Long referenceId);
}
