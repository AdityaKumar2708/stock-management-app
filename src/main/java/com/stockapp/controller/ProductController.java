package com.stockapp.controller;

import com.stockapp.model.Product;
import com.stockapp.repository.ProductRepository;
import com.stockapp.service.ReorderSyncService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;
    private final ReorderSyncService reorderSyncService;

    public ProductController(ProductRepository productRepository, ReorderSyncService reorderSyncService) {
        this.productRepository = productRepository;
        this.reorderSyncService = reorderSyncService;
    }

    @GetMapping
    public List<Product> list() {
        return productRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<Product> create(@Valid @RequestBody Product product) {
        Product saved = productRepository.save(product);
        reorderSyncService.syncFromProduct(saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody Product payload) {
        var existingOpt = productRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Product not found");
        }

        Product existing = existingOpt.get();
        existing.setName(payload.getName());
        existing.setQuantity(payload.getQuantity());
        existing.setMinimumQuantity(payload.getMinimumQuantity());
        existing.setCategory(payload.getCategory());
        existing.setImageUrl(payload.getImageUrl());
        existing.setCost(payload.getCost());
        existing.setPrice(payload.getPrice());
        Product saved = productRepository.save(existing);
        reorderSyncService.syncFromProduct(saved);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!productRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Product not found");
        }
        productRepository.deleteById(id);
        reorderSyncService.removeForProduct(id);
        return ResponseEntity.noContent().build();
    }
}
