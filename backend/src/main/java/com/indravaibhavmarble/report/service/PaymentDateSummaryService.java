
package com.indravaibhavmarble.report.service;

import com.indravaibhavmarble.purchase.repository.PurchasePaymentRepository;
import com.indravaibhavmarble.report.dto.PaymentDateSummaryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class PaymentDateSummaryService {

    private final PurchasePaymentRepository paymentRepository;

    public PaymentDateSummaryService(
            PurchasePaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public List<PaymentDateSummaryResponse> getPaymentDateSummaries() {
        return paymentRepository.getPaymentDateSummaries()
                .stream()
                .map(row -> new PaymentDateSummaryResponse(
                        (LocalDate) row[0],
                        ((Number) row[1]).longValue(),
                        (BigDecimal) row[2]
                ))
                .toList();
    }
}
