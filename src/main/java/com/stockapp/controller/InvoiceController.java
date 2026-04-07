package com.stockapp.controller;

import com.stockapp.dto.InvoiceRequest;
import com.stockapp.model.Invoice;
import com.stockapp.model.InvoiceItem;
import com.stockapp.model.Product;
import com.stockapp.repository.CreditCustomerRepository;
import com.stockapp.repository.InvoiceRepository;
import com.stockapp.repository.ProductRepository;
import com.stockapp.service.ReorderSyncService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final InvoiceRepository invoiceRepository;
    private final CreditCustomerRepository creditCustomerRepository;
    private final ProductRepository productRepository;
    private final ReorderSyncService reorderSyncService;

    public InvoiceController(InvoiceRepository invoiceRepository,
                             CreditCustomerRepository creditCustomerRepository,
                             ProductRepository productRepository,
                             ReorderSyncService reorderSyncService) {
        this.invoiceRepository = invoiceRepository;
        this.creditCustomerRepository = creditCustomerRepository;
        this.productRepository = productRepository;
        this.reorderSyncService = reorderSyncService;
    }

    @GetMapping
    public List<Invoice> list() {
        return invoiceRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        return invoiceRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@Valid @RequestBody InvoiceRequest request) {
        List<Product> touchedProducts = new ArrayList<>();
        List<InvoiceItem> invoiceItems = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (var line : request.getItems()) {
            var productOpt = productRepository.findById(line.getProductId());
            if (productOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Product not found: " + line.getProductId());
            }

            Product product = productOpt.get();
            if (product.getQuantity() < line.getQuantity()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Insufficient stock for item: " + product.getName());
            }

            BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(line.getQuantity()));

            InvoiceItem invoiceItem = new InvoiceItem();
            invoiceItem.setProduct(product);
            invoiceItem.setItemName(product.getName());
            invoiceItem.setQuantity(line.getQuantity());
            invoiceItem.setUnitPrice(product.getPrice());
            invoiceItem.setLineTotal(lineTotal);
            invoiceItems.add(invoiceItem);

            totalAmount = totalAmount.add(lineTotal);
            product.setQuantity(product.getQuantity() - line.getQuantity());
            touchedProducts.add(product);
        }

        Invoice invoice = new Invoice();
        invoice.setSellerName(request.getSellerName());
        invoice.setCustomerName(normalizeOptional(request.getCustomerName()));
        invoice.setCustomerContact(normalizeOptional(request.getCustomerContact()));
        invoice.setTotalAmount(totalAmount);
        invoice.setCreatedAt(LocalDateTime.now());

        invoiceItems.forEach(item -> item.setInvoice(invoice));
        invoice.setItems(invoiceItems);

        touchedProducts.forEach(product -> {
            Product saved = productRepository.save(product);
            reorderSyncService.syncFromProduct(saved);
        });
        Invoice savedInvoice = invoiceRepository.save(invoice);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedInvoice);
    }

    private String normalizeOptional(String value) {
        if (Objects.isNull(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        Map<String, Object> data = new HashMap<>();
        data.put("totalProducts", productRepository.count());
        data.put("totalCustomers", creditCustomerRepository.count());
        data.put("totalInvoices", invoiceRepository.count());

        BigDecimal revenue = invoiceRepository.findAll().stream()
                .map(Invoice::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        data.put("totalRevenue", revenue);
        return data;
    }
}