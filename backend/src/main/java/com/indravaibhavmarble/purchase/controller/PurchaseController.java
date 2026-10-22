
package com.indravaibhavmarble.purchase.controller;

import com.indravaibhavmarble.purchase.dto.PurchaseRequest;
import com.indravaibhavmarble.purchase.dto.PurchaseResponse;
import com.indravaibhavmarble.purchase.service.PurchaseService;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/purchases")
public class PurchaseController {

    private final PurchaseService purchaseService;

    public PurchaseController(PurchaseService purchaseService) {
        this.purchaseService = purchaseService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseResponse createPurchase(
            @RequestBody PurchaseRequest request) {
        return purchaseService.createPurchase(request);
    }

    @GetMapping
    public List<PurchaseResponse> getAllPurchases() {
        return purchaseService.getAllPurchases();
    }

    @GetMapping("/{id}")
    public PurchaseResponse getPurchase(@PathVariable Long id) {
        return purchaseService.getPurchase(id);
    }

    @PutMapping("/{id}")
    public PurchaseResponse updatePurchase(
            @PathVariable Long id,
            @RequestBody PurchaseRequest request) {
        return purchaseService.updatePurchase(id, request);
    }

    @PostMapping("/{id}/receive")
    public PurchaseResponse receivePurchase(@PathVariable Long id) {
        return purchaseService.receivePurchase(id);
    }
}
