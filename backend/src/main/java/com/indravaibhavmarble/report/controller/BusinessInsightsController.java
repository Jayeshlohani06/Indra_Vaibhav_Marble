package com.indravaibhavmarble.report.controller;

import com.indravaibhavmarble.report.service.BusinessInsightsService;
import com.indravaibhavmarble.report.service.BusinessInsightsService.MonthlyProfitRow;
import com.indravaibhavmarble.report.service.BusinessInsightsService.PaymentReminderRow;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class BusinessInsightsController {

    private final BusinessInsightsService service;

    public BusinessInsightsController(BusinessInsightsService service) {
        this.service = service;
    }

    @GetMapping("/payment-reminders")
    public List<PaymentReminderRow> paymentReminders(@RequestParam(defaultValue = "30") int minDays) {
        return service.paymentReminders(minDays);
    }

    @GetMapping("/monthly-profit")
    public List<MonthlyProfitRow> monthlyProfit(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.monthlyProfit(from, to);
    }
}
