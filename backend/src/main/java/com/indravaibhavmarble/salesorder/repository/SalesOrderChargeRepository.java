package com.indravaibhavmarble.salesorder.repository;

import com.indravaibhavmarble.salesorder.entity.SalesOrderCharge;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalesOrderChargeRepository extends JpaRepository<SalesOrderCharge, Long> {
    List<SalesOrderCharge> findBySalesOrderId(Long salesOrderId);
}
