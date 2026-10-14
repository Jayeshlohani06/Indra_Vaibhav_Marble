
package com.indravaibhavmarble.category.repository;

import com.indravaibhavmarble.category.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProductCategoryRepository
        extends JpaRepository<ProductCategory, Long> {

    Optional<ProductCategory> findByNameIgnoreCase(String name);

    List<ProductCategory> findByActiveTrueOrderByNameAsc();
}
