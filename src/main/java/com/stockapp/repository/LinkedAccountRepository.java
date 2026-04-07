package com.stockapp.repository;

import com.stockapp.model.LinkedAccount;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LinkedAccountRepository extends JpaRepository<LinkedAccount, Long> {
}
