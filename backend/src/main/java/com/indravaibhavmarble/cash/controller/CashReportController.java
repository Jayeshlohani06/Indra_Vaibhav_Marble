package com.indravaibhavmarble.cash.controller;

import com.indravaibhavmarble.cash.service.CashReportService;
import com.indravaibhavmarble.cash.service.CashReportService.AuditRow;
import com.indravaibhavmarble.cash.service.CashReportService.Cashbook;
import com.indravaibhavmarble.cash.service.CashReportService.ExpenseGroupRow;
import com.indravaibhavmarble.cash.service.CashReportService.StaffPaymentRow;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cash/reports")
public class CashReportController {

    private final CashReportService service;

    public CashReportController(CashReportService service) {
        this.service = service;
    }

    @GetMapping("/cashbook")
    public Cashbook cashbook(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String kind) {
        return service.cashbook(from, to, paymentMethod, kind);
    }

    @GetMapping("/expenses")
    public List<ExpenseGroupRow> expenses(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.expensesByCategory(from, to);
    }

    @GetMapping("/staff-payments")
    public List<StaffPaymentRow> staffPayments(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.staffPayments(from, to);
    }

    @GetMapping("/audit")
    public List<AuditRow> audit() {
        return service.recentAudit();
    }
}
