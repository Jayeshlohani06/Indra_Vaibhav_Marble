
package com.indravaibhavmarble.salesorder.repository;

import java.time.LocalDate;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SalesOrderRepository
        extends JpaRepository<SalesOrder, Long> {

    Optional<SalesOrder> findByOrderNumber(String orderNumber);

    boolean existsByOrderNumber(String orderNumber);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM SalesOrder o WHERE o.id = :id")
    Optional<SalesOrder> findByIdForUpdate(@Param("id") Long id);

    @Query(value = "SELECT nextval('sales_order_number_seq')", nativeQuery = true)
    Long nextOrderNumber();

    /** Rows of [customerId, orderCount, billedTotal] for billed (non-draft, non-cancelled) orders. */
    @Query("""
            SELECT o.customerId, COUNT(o), COALESCE(SUM(o.grandTotal), 0)
            FROM SalesOrder o
            WHERE o.status NOT IN ('DRAFT', 'CANCELLED')
            GROUP BY o.customerId
            """)
    List<Object[]> getBilledTotalsByCustomer();

    List<SalesOrder> findAllByOrderByCreatedAtDesc();

    List<SalesOrder> findByCustomerIdOrderByCreatedAtDesc(
            Long customerId);
    List<SalesOrder> findByOrderDateBetweenAndStatusNotIn(
        LocalDate startDate,
        LocalDate endDate,
        List<String> statuses
);        

}
