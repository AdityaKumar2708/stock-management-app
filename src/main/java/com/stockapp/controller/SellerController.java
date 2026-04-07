package com.stockapp.controller;

import com.stockapp.model.Seller;
import com.stockapp.repository.SellerRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sellers")
public class SellerController {

    private final SellerRepository sellerRepository;

    public SellerController(SellerRepository sellerRepository) {
        this.sellerRepository = sellerRepository;
    }

    @GetMapping
    public List<Seller> list() {
        return sellerRepository.findAll();
    }

    @GetMapping("/active")
    public List<Seller> listActive() {
        return sellerRepository.findByEnabledTrue();
    }

    @PostMapping
    public ResponseEntity<Seller> create(@Valid @RequestBody Seller payload) {
        return ResponseEntity.status(HttpStatus.CREATED).body(sellerRepository.save(payload));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody Seller payload) {
        var existingOpt = sellerRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Seller not found");
        }

        Seller existing = existingOpt.get();
        existing.setName(payload.getName());
        existing.setEnabled(payload.isEnabled());
        return ResponseEntity.ok(sellerRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!sellerRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Seller not found");
        }
        sellerRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
