
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

    @Transactional
    public ProductCategory createCategory(ProductCategory category) {
        if (category == null || category.getName() == null
                || category.getName().isBlank()) {
            throw new IllegalArgumentException("Category name is required");
        }

        String name = category.getName().trim();
        if (repository.findByNameIgnoreCase(name).isPresent()) {
            throw new IllegalArgumentException(
                    "A category with this name already exists");
        }

        category.setName(name);
        if (category.getDescription() != null) {
            category.setDescription(category.getDescription().trim());
        }
        category.setActive(true);
        return repository.save(category);
    }
}
