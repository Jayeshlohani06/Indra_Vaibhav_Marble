
package com.indravaibhavmarble.purchase.controller;

import com.indravaibhavmarble.purchase.dto.PurchaseBalanceResponse;
import com.indravaibhavmarble.purchase.dto.PurchasePaymentRequest;
import com.indravaibhavmarble.purchase.dto.PurchasePaymentResponse;
import com.indravaibhavmarble.purchase.service.PurchasePaymentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/purchases/{purchaseId}/payments")
public class PurchasePaymentController {

    private final PurchasePaymentService paymentService;

    public PurchasePaymentController(PurchasePaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PurchasePaymentResponse recordPayment(
            @PathVariable Long purchaseId,
            @Valid @RequestBody PurchasePaymentRequest request
    ) {
        return paymentService.recordPayment(purchaseId, request);
    }

    @GetMapping
    public List<PurchasePaymentResponse> getPayments(
            @PathVariable Long purchaseId
    ) {
        return paymentService.getPayments(purchaseId);
    }

    @GetMapping("/balance")
    public PurchaseBalanceResponse getPurchaseBalance(
            @PathVariable Long purchaseId
    ) {
        return paymentService.getPurchaseBalance(purchaseId);
    }
}
