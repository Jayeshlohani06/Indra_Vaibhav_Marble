
package com.indravaibhavmarble.category.service;

import com.indravaibhavmarble.category.entity.ProductCategory;
import com.indravaibhavmarble.category.repository.ProductCategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ProductCategoryService {

    private final ProductCategoryRepository repository;

    public ProductCategoryService(ProductCategoryRepository repository) {
        this.repository = repository;
    }

    public List<ProductCategory> getActiveCategories() {
        return repository.findByActiveTrueOrderByNameAsc();
    }
}
