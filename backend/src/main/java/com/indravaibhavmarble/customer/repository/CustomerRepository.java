
package com.indravaibhavmarble.customer.repository;

import com.indravaibhavmarble.customer.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Optional<Customer> findByCustomerCode(String customerCode);

    boolean existsByCustomerCode(String customerCode);

    List<Customer> findByActiveTrueOrderByNameAsc();

    List<Customer> findByNameContainingIgnoreCaseOrderByNameAsc(String name);

    List<Customer> findByPhoneContaining(String phone);
}
