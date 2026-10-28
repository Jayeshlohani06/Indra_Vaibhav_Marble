package com.indravaibhavmarble.cash.controller;

import com.indravaibhavmarble.cash.dto.CashSessionDtos.CloseRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.OpenRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.ReopenRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SessionDetail;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SessionResponse;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SettingsRequest;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.SettingsResponse;
import com.indravaibhavmarble.cash.dto.CashSessionDtos.TodayResponse;
import com.indravaibhavmarble.cash.service.CashSessionService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cash")
public class CashSessionController {

    private final CashSessionService service;

    public CashSessionController(CashSessionService service) {
        this.service = service;
    }

    @GetMapping("/today")
    public TodayResponse today() {
        return service.today();
    }

    @PostMapping("/sessions/open")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDetail open(@RequestBody OpenRequest request) {
        return service.open(request);
    }

    @PostMapping("/sessions/{id}/close")
    public SessionDetail close(@PathVariable Long id, @RequestBody CloseRequest request) {
        return service.close(id, request);
    }

    @PostMapping("/sessions/{id}/reopen")
    public SessionDetail reopen(@PathVariable Long id, @RequestBody ReopenRequest request) {
        return service.reopen(id, request);
    }

    @GetMapping("/sessions")
    public List<SessionResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean withDifference) {
        return service.list(from, to, withDifference);
    }

    @GetMapping("/sessions/{id}")
    public SessionDetail get(@PathVariable Long id) {
        return service.get(id);
    }

    @PutMapping("/settings")
    public SettingsResponse updateSettings(@RequestBody SettingsRequest request) {
        return service.updateSettings(request);
    }
}
