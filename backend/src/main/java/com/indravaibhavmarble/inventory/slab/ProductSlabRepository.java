
package com.indravaibhavmarble.inventory.slab;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductSlabRepository
        extends JpaRepository<ProductSlab, Long> {

    List<ProductSlab> findByProductIdOrderByCreatedAtDesc(Long productId);

    Optional<ProductSlab> findBySlabCodeIgnoreCase(String slabCode);

    boolean existsBySlabCodeIgnoreCase(String slabCode);

    List<ProductSlab> findByProductIdAndStatusOrderByCreatedAtDesc(
            Long productId,
            String status
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT slab
            FROM ProductSlab slab
            WHERE slab.id = :slabId
            """)
    Optional<ProductSlab> findByIdForUpdate(
            @Param("slabId") Long slabId
    );
}
