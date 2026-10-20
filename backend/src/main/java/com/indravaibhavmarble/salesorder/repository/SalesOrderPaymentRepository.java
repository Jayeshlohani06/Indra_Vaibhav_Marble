package com.indravaibhavmarble.salesorder.repository;

import com.indravaibhavmarble.salesorder.entity.SalesOrderPayment;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;

public interface SalesOrderPaymentRepository
        extends JpaRepository<SalesOrderPayment, Long> {
    List<SalesOrderPayment> findBySalesOrderIdOrderByPaymentDateDescIdDesc(Long id);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM SalesOrderPayment p WHERE p.salesOrderId = :id")
    BigDecimal getTotalPaid(@Param("id") Long id);
}
