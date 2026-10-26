package com.indravaibhavmarble.report.controller;

import com.indravaibhavmarble.report.dto.CustomerOutstandingResponse;
import com.indravaibhavmarble.report.service.CustomerOutstandingReportService;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
public class CustomerOutstandingReportController {

    private final CustomerOutstandingReportService reportService;

    public CustomerOutstandingReportController(
            CustomerOutstandingReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/customer-outstanding")
    public List<CustomerOutstandingResponse> getCustomerOutstandingReport() {
        return reportService.getCustomerOutstandingReport();
    }
}
