
package com.indravaibhavmarble.inventory.controller;

import com.indravaibhavmarble.inventory.dto.InventorySettingRequest;
import com.indravaibhavmarble.inventory.dto.InventorySettingResponse;
import com.indravaibhavmarble.inventory.service.InventorySettingService;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory/settings")
public class InventorySettingController {

    private final InventorySettingService inventorySettingService;

    public InventorySettingController(
            InventorySettingService inventorySettingService) {
        this.inventorySettingService = inventorySettingService;
    }

    @PutMapping("/{productId}")
    public InventorySettingResponse createOrUpdateSetting(
            @PathVariable Long productId,
            @RequestBody InventorySettingRequest request) {

        return InventorySettingResponse.from(
                inventorySettingService.createOrUpdateSetting(
                        productId,
                        request.trackingType(),
                        request.tileLengthFt(),
                        request.tileWidthFt(),
                        request.piecesPerBox()
                )
        );
    }

    @GetMapping("/{productId}")
    public InventorySettingResponse getSetting(
            @PathVariable Long productId) {

        return InventorySettingResponse.from(
                inventorySettingService.getSetting(productId)
        );
    }
}
