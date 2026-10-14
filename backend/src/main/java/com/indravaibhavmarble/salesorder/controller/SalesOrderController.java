
package com.indravaibhavmarble.salesorder.controller;

import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.service.SalesOrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales-orders")
public class SalesOrderController {

    private final SalesOrderService salesOrderService;

    public SalesOrderController(SalesOrderService salesOrderService) {
        this.salesOrderService = salesOrderService;
    }

    @GetMapping
    public List<SalesOrderResponse> getAllOrders() {
        return salesOrderService.getAllOrders();
    }

    @GetMapping("/{id}")
    public SalesOrderResponse getOrderById(@PathVariable Long id) {
        return salesOrderService.getOrderById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SalesOrderResponse createOrder(
            @Valid @RequestBody SalesOrderRequest request) {
        return salesOrderService.createOrder(request);
    }
}
