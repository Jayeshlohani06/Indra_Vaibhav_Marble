package com.indravaibhavmarble.stockmovement.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import com.indravaibhavmarble.stockmovement.dto.StockMovementResponse;
import com.indravaibhavmarble.stockmovement.entity.StockMovement;
import com.indravaibhavmarble.stockmovement.service.StockMovementService;

@RestController
@RequestMapping("/api/stock-movements")
public class StockMovementController {

    private final StockMovementService stockMovementService;

    public StockMovementController(StockMovementService stockMovementService) {
        this.stockMovementService = stockMovementService;
    }

    @GetMapping
    public List<StockMovementResponse> getAllMovements() {
        return stockMovementService.getAllMovements();
    }

    @GetMapping("/product/{productId}")
    public List<StockMovementResponse> getMovementsByProduct(
            @PathVariable Long productId) {
        return stockMovementService.getMovementsByProduct(productId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public StockMovementResponse recordMovement(
            @RequestBody StockMovement movement) {
        return stockMovementService.recordManualMovement(movement);
    }

    @PostMapping("/{movementId}/reverse")
    @ResponseStatus(HttpStatus.CREATED)
    public StockMovementResponse reverseMovement(
            @PathVariable Long movementId,
            @RequestBody(required = false) ReversalRequest request) {
        return stockMovementService.reverseMovement(
                movementId,
                request == null ? null : request.notes());
    }

    public record ReversalRequest(String notes) {
    }
}
