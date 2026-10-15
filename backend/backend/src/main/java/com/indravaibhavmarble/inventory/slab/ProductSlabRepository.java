
package com.indravaibhavmarble.inventory.slab;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductSlabRepository
        extends JpaRepository<ProductSlab, Long> {

    List<ProductSlab> findByProductIdOrderByCreatedAtDesc(Long productId);

    Optional<ProductSlab> findBySlabCodeIgnoreCase(String slabCode);

    boolean existsBySlabCodeIgnoreCase(String slabCode);

    List<ProductSlab> findByProductIdAndStatusOrderByCreatedAtDesc(
            Long productId,
            String status);
}
