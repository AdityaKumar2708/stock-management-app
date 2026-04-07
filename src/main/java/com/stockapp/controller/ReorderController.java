package com.stockapp.controller;

import com.stockapp.model.ReorderItem;
import com.stockapp.repository.ReorderItemRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reorders")
public class ReorderController {

    private final ReorderItemRepository reorderItemRepository;

    public ReorderController(ReorderItemRepository reorderItemRepository) {
        this.reorderItemRepository = reorderItemRepository;
    }

    @GetMapping
    public List<ReorderItem> list() {
        return reorderItemRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<ReorderItem> create(@Valid @RequestBody ReorderItem payload) {
        payload.setProductId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(reorderItemRepository.save(payload));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody ReorderItem payload) {
        var existingOpt = reorderItemRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Reorder item not found");
        }

        ReorderItem existing = existingOpt.get();
        existing.setItemName(payload.getItemName());
        existing.setImageUrl(payload.getImageUrl());
        existing.setCost(payload.getCost());
        existing.setQuantity(payload.getQuantity());
        return ResponseEntity.ok(reorderItemRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!reorderItemRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Reorder item not found");
        }
        reorderItemRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
