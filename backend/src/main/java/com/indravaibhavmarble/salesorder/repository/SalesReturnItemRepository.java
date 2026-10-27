package com.indravaibhavmarble.salesorder.repository;

import com.indravaibhavmarble.salesorder.entity.SalesReturnItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalesReturnItemRepository extends JpaRepository<SalesReturnItem, Long> {

    List<SalesReturnItem> findBySalesReturnIdInOrderByIdAsc(List<Long> salesReturnIds);
}
