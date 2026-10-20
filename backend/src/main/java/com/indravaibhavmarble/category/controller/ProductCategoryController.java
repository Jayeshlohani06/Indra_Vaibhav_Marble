
package com.indravaibhavmarble.category.controller;

import com.indravaibhavmarble.category.entity.ProductCategory;
import com.indravaibhavmarble.category.service.ProductCategoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class ProductCategoryController {

    private final ProductCategoryService categoryService;

    public ProductCategoryController(
            ProductCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public List<ProductCategory> getCategories() {
        return categoryService.getActiveCategories();
    }

    @PostMapping
    public ProductCategory createCategory(@RequestBody ProductCategory category) {
        return categoryService.createCategory(category);
    }
}
