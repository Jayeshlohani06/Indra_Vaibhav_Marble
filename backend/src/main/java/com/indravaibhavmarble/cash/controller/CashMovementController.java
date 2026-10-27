package com.indravaibhavmarble.cash.controller;

import com.indravaibhavmarble.cash.dto.CashMovementDtos.MovementRequest;
import com.indravaibhavmarble.cash.dto.CashMovementDtos.MovementResponse;
import com.indravaibhavmarble.cash.dto.CashMovementDtos.VoidRequest;
import com.indravaibhavmarble.cash.service.CashMovementService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cash/movements")
public class CashMovementController {

    private final CashMovementService service;

    public CashMovementController(CashMovementService service) {
        this.service = service;
    }

    @GetMapping
    public List<MovementResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MovementResponse create(@RequestBody MovementRequest request) {
        return service.create(request);
    }

    @PostMapping("/{id}/void")
    public MovementResponse voidMovement(@PathVariable Long id, @RequestBody VoidRequest request) {
        return service.voidMovement(id, request);
    }
}
