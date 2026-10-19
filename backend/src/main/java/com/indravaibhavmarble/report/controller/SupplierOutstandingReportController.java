
package com.indravaibhavmarble.report.controller;

import com.indravaibhavmarble.report.dto.SupplierOutstandingResponse;
import com.indravaibhavmarble.report.service.SupplierOutstandingReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class SupplierOutstandingReportController {

    private final SupplierOutstandingReportService reportService;

    public SupplierOutstandingReportController(
            SupplierOutstandingReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/supplier-outstanding")
    public List<SupplierOutstandingResponse> getSupplierOutstandingReport() {
        return reportService.getSupplierOutstandingReport();
    }
}
