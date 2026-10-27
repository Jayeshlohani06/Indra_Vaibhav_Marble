package com.indravaibhavmarble.cash.repository;

import com.indravaibhavmarble.cash.entity.CashCountLine;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CashCountLineRepository extends JpaRepository<CashCountLine, CashCountLine.Key> {

    List<CashCountLine> findBySessionIdOrderByDenominationDesc(Long sessionId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM CashCountLine c WHERE c.sessionId = :sessionId")
    void deleteBySessionId(@Param("sessionId") Long sessionId);
}
