package com.indravaibhavmarble.cash.repository;

import com.indravaibhavmarble.cash.entity.CashMovement;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {

    Optional<CashMovement> findByRequestId(UUID requestId);

    List<CashMovement> findByMovementDateBetweenOrderByMovementDateDescIdDesc(LocalDate from, LocalDate to);
}
