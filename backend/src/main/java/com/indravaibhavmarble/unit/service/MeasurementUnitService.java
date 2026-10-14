
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
}
