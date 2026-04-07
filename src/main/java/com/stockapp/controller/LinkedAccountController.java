package com.stockapp.controller;

import com.stockapp.model.LinkedAccount;
import com.stockapp.repository.LinkedAccountRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/linked-accounts")
public class LinkedAccountController {

    private final LinkedAccountRepository linkedAccountRepository;

    public LinkedAccountController(LinkedAccountRepository linkedAccountRepository) {
        this.linkedAccountRepository = linkedAccountRepository;
    }

    @GetMapping
    public List<LinkedAccount> list() {
        return linkedAccountRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<LinkedAccount> create(@Valid @RequestBody LinkedAccount payload) {
        return ResponseEntity.status(HttpStatus.CREATED).body(linkedAccountRepository.save(payload));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody LinkedAccount payload) {
        var existingOpt = linkedAccountRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Account not found");
        }

        LinkedAccount existing = existingOpt.get();
        existing.setEmail(payload.getEmail());
        existing.setEnabled(payload.isEnabled());
        return ResponseEntity.ok(linkedAccountRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!linkedAccountRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Account not found");
        }
        linkedAccountRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
