package com.stockapp.repository;

import com.stockapp.model.ReorderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReorderItemRepository extends JpaRepository<ReorderItem, Long> {
    Optional<ReorderItem> findByProductId(Long productId);
    void deleteByProductId(Long productId);
}
