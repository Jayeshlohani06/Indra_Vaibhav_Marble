package com.indravaibhavmarble.salesorder.repository;

import com.indravaibhavmarble.salesorder.entity.SalesReturn;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SalesReturnRepository extends JpaRepository<SalesReturn, Long> {

    List<SalesReturn> findBySalesOrderIdOrderByIdAsc(Long salesOrderId);

    List<SalesReturn> findBySalesOrderIdInOrderByIdAsc(List<Long> salesOrderIds);

    @Query(value = "SELECT nextval('sales_return_number_seq')", nativeQuery = true)
    Long nextReturnNumber();
}
