
package com.indravaibhavmarble.salesorder.controller;

import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderCancelRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.dto.SalesReturnRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnResponse;
import com.indravaibhavmarble.salesorder.service.SalesOrderService;
import com.indravaibhavmarble.salesorder.service.SalesReturnService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales-orders")
public class SalesOrderController {

    private final SalesOrderService salesOrderService;
    private final SalesReturnService salesReturnService;

    public SalesOrderController(SalesOrderService salesOrderService,
            SalesReturnService salesReturnService) {
        this.salesOrderService = salesOrderService;
        this.salesReturnService = salesReturnService;
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

    @PostMapping("/{id}/returns")
    @ResponseStatus(HttpStatus.CREATED)
    public SalesReturnResponse createReturn(@PathVariable Long id,
            @RequestBody SalesReturnRequest request) {
        return salesReturnService.createReturn(id, request);
    }

    @PostMapping("/{id}/cancel")
    public SalesReturnResponse cancelOrder(@PathVariable Long id,
            @RequestBody SalesOrderCancelRequest request) {
        return salesReturnService.cancelOrder(id, request);
    }
}
