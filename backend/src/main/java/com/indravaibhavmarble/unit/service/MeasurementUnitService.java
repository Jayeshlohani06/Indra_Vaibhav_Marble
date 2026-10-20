
package com.indravaibhavmarble.unit.service;

import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import com.indravaibhavmarble.unit.repository.MeasurementUnitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class MeasurementUnitService {

    private final MeasurementUnitRepository repository;

    public MeasurementUnitService(MeasurementUnitRepository repository) {
        this.repository = repository;
    }

    public List<MeasurementUnit> getActiveUnits() {
        return repository.findByActiveTrueOrderByNameAsc();
    }

    @Transactional
    public MeasurementUnit createUnit(MeasurementUnit unit) {
        if (unit == null || unit.getName() == null
                || unit.getName().isBlank()) {
            throw new IllegalArgumentException("Unit name is required");
        }
        if (unit.getCode() == null || unit.getCode().isBlank()) {
            throw new IllegalArgumentException("Unit code is required");
        }

        String name = unit.getName().trim();
        String code = unit.getCode().trim().toUpperCase();
        if (repository.findByCodeIgnoreCase(code).isPresent()) {
            throw new IllegalArgumentException(
                    "A measurement unit with this code already exists");
        }
        if (code.length() > 20) {
            throw new IllegalArgumentException(
                    "Unit code must not exceed 20 characters");
        }

        unit.setName(name);
        unit.setCode(code);
        unit.setActive(true);
        return repository.save(unit);
    }
}
