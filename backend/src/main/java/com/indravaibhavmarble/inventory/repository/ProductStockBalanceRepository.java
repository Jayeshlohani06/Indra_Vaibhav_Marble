
package com.indravaibhavmarble.inventory.repository;

import com.indravaibhavmarble.inventory.entity.ProductStockBalance;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProductStockBalanceRepository
        extends JpaRepository<ProductStockBalance, Long> {

    Optional<ProductStockBalance> findByProductId(Long productId);

    boolean existsByProductId(Long productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT balance
            FROM ProductStockBalance balance
            WHERE balance.productId = :productId
            """)
    Optional<ProductStockBalance> findByProductIdForUpdate(
            @Param("productId") Long productId);
}
