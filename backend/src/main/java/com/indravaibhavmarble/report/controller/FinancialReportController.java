
package com.indravaibhavmarble.report.controller;

import com.indravaibhavmarble.report.dto.FinancialSummaryResponse;
import com.indravaibhavmarble.report.service.FinancialReportService;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
public class FinancialReportController {

    private final FinancialReportService financialReportService;

    public FinancialReportController(
            FinancialReportService financialReportService) {
        this.financialReportService = financialReportService;
    }

    @GetMapping("/financial-summary")
    public FinancialSummaryResponse getFinancialSummary(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,

            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate) {

        return financialReportService.getFinancialSummary(
                startDate, endDate);
    }
}
