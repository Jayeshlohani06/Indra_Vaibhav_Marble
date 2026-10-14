
package com.indravaibhavmarble.unit.repository;

import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MeasurementUnitRepository
        extends JpaRepository<MeasurementUnit, Long> {

    Optional<MeasurementUnit> findByCodeIgnoreCase(String code);

    List<MeasurementUnit> findByActiveTrueOrderByNameAsc();
}
