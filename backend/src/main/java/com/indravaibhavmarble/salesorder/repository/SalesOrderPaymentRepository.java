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

    /** Rows of [salesOrderId, totalPaid] for the given orders. */
    @Query("""
            SELECT p.salesOrderId, COALESCE(SUM(p.amount), 0)
            FROM SalesOrderPayment p
            WHERE p.salesOrderId IN :ids
            GROUP BY p.salesOrderId
            """)
    List<Object[]> getTotalPaidByOrder(@Param("ids") List<Long> ids);

    /** Rows of [customerId, totalPaid] across billed (non-draft, non-cancelled) orders. */
    @Query("""
            SELECT o.customerId, COALESCE(SUM(p.amount), 0)
            FROM SalesOrderPayment p, SalesOrder o
            WHERE p.salesOrderId = o.id
              AND o.status NOT IN ('DRAFT', 'CANCELLED')
            GROUP BY o.customerId
            """)
    List<Object[]> getTotalPaidByCustomer();
}
