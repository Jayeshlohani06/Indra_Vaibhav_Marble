package com.indravaibhavmarble.salesorder.controller;

import com.indravaibhavmarble.salesorder.dto.*;
import com.indravaibhavmarble.salesorder.service.SalesOrderPaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/sales-orders/{orderId}/payments")
public class SalesOrderPaymentController {
    private final SalesOrderPaymentService service;

    public SalesOrderPaymentController(SalesOrderPaymentService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SalesOrderPaymentResponse record(@PathVariable Long orderId,
            @Valid @RequestBody SalesOrderPaymentRequest request) {
        return service.recordPayment(orderId, request);
    }

    @PostMapping("/{paymentId}/method")
    public SalesOrderPaymentResponse changeMethod(@PathVariable Long orderId, @PathVariable Long paymentId,
            @RequestBody com.indravaibhavmarble.common.payment.ChangePaymentMethodRequest request) {
        return service.changeMethod(orderId, paymentId, request);
    }

    @GetMapping
    public List<SalesOrderPaymentResponse> list(@PathVariable Long orderId) {
        return service.getPayments(orderId);
    }

    @GetMapping("/balance")
    public SalesOrderBalanceResponse balance(@PathVariable Long orderId) {
        return service.getBalance(orderId);
    }
}
