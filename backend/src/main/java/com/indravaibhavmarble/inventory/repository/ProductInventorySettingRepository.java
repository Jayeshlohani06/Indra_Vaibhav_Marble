package com.indravaibhavmarble.inventory.repository;
import com.indravaibhavmarble.inventory.entity.ProductInventorySetting;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface ProductInventorySettingRepository
        extends JpaRepository<ProductInventorySetting, Long> {
    Optional<ProductInventorySetting> findByProductId(Long productId);
    boolean existsByProductId(Long productId);
}
