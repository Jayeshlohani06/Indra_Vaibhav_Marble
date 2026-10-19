
package com.indravaibhavmarble.report.controller;

import com.indravaibhavmarble.report.dto.PaymentDateSummaryResponse;
import com.indravaibhavmarble.report.service.PaymentDateSummaryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class PaymentDateSummaryController {

    private final PaymentDateSummaryService summaryService;

    public PaymentDateSummaryController(
            PaymentDateSummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping("/payment-date-summary")
    public List<PaymentDateSummaryResponse> getPaymentDateSummaries() {
        return summaryService.getPaymentDateSummaries();
    }
}
