package com.stockapp.controller;

import com.stockapp.model.CreditCustomer;
import com.stockapp.repository.CreditCustomerRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/credit-customers")
public class CreditCustomerController {

    private final CreditCustomerRepository creditCustomerRepository;

    public CreditCustomerController(CreditCustomerRepository creditCustomerRepository) {
        this.creditCustomerRepository = creditCustomerRepository;
    }

    @GetMapping
    public List<CreditCustomer> list() {
        return creditCustomerRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<CreditCustomer> create(@Valid @RequestBody CreditCustomer payload) {
        return ResponseEntity.status(HttpStatus.CREATED).body(creditCustomerRepository.save(payload));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @Valid @RequestBody CreditCustomer payload) {
        var existingOpt = creditCustomerRepository.findById(id);
        if (existingOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Customer not found");
        }

        CreditCustomer existing = existingOpt.get();
        existing.setImageUrl(payload.getImageUrl());
        existing.setName(payload.getName());
        existing.setMobile(payload.getMobile());
        existing.setAddress(payload.getAddress());
        existing.setAmount(payload.getAmount());
        return ResponseEntity.ok(creditCustomerRepository.save(existing));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!creditCustomerRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Customer not found");
        }
        creditCustomerRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
