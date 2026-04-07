package com.stockapp.repository;

import com.stockapp.model.CreditCustomer;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditCustomerRepository extends JpaRepository<CreditCustomer, Long> {
}
