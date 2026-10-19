
package com.indravaibhavmarble.salesorder.repository;

import java.time.LocalDate;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SalesOrderRepository
        extends JpaRepository<SalesOrder, Long> {

    Optional<SalesOrder> findByOrderNumber(String orderNumber);

    boolean existsByOrderNumber(String orderNumber);

    List<SalesOrder> findAllByOrderByCreatedAtDesc();

    List<SalesOrder> findByCustomerIdOrderByCreatedAtDesc(
            Long customerId);
    List<SalesOrder> findByOrderDateBetweenAndStatusNotIn(
        LocalDate startDate,
        LocalDate endDate,
        List<String> statuses
);        

}
