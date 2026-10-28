package com.indravaibhavmarble.cash.repository;

import com.indravaibhavmarble.cash.entity.CashDigitalCheck;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CashDigitalCheckRepository extends JpaRepository<CashDigitalCheck, CashDigitalCheck.Key> {

    List<CashDigitalCheck> findBySessionId(Long sessionId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM CashDigitalCheck c WHERE c.sessionId = :sessionId")
    void deleteBySessionId(@Param("sessionId") Long sessionId);
}
