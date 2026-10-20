
package com.indravaibhavmarble.unit.controller;

import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import com.indravaibhavmarble.unit.service.MeasurementUnitService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/units")
public class MeasurementUnitController {

    private final MeasurementUnitService unitService;

    public MeasurementUnitController(MeasurementUnitService unitService) {
        this.unitService = unitService;
    }

    @GetMapping
    public List<MeasurementUnit> getUnits() {
        return unitService.getActiveUnits();
    }

    @PostMapping
    public MeasurementUnit createUnit(@RequestBody MeasurementUnit unit) {
        return unitService.createUnit(unit);
    }
}
