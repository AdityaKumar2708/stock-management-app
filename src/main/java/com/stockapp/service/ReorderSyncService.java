package com.stockapp.service;

import com.stockapp.model.Product;
import com.stockapp.model.ReorderItem;
import com.stockapp.repository.ReorderItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReorderSyncService {

    private final ReorderItemRepository reorderItemRepository;

    public ReorderSyncService(ReorderItemRepository reorderItemRepository) {
        this.reorderItemRepository = reorderItemRepository;
    }

    @Transactional
    public void syncFromProduct(Product product) {
        if (product.getQuantity() <= product.getMinimumQuantity()) {
            ReorderItem item = reorderItemRepository.findByProductId(product.getId()).orElseGet(ReorderItem::new);
            item.setProductId(product.getId());
            item.setItemName(product.getName());
            item.setImageUrl(product.getImageUrl());
            item.setCost(product.getCost());
            item.setQuantity(product.getQuantity());
            reorderItemRepository.save(item);
            return;
        }

        reorderItemRepository.findByProductId(product.getId())
                .ifPresent(existing -> reorderItemRepository.deleteById(existing.getId()));
    }

    @Transactional
    public void removeForProduct(Long productId) {
        reorderItemRepository.deleteByProductId(productId);
    }
}
