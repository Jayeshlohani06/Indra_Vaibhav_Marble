package com.indravaibhavmarble.salesorder.service;

import com.indravaibhavmarble.salesorder.repository.SalesOrderPaymentRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderRepository;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What each customer has been billed, has paid and still owes, across
 * billed (non-draft, non-cancelled) sales orders.
 */
@Service
@Transactional(readOnly = true)
public class CustomerBalanceService {

    private final SalesOrderRepository orderRepository;
    private final SalesOrderPaymentRepository paymentRepository;

    public CustomerBalanceService(
            SalesOrderRepository orderRepository,
            SalesOrderPaymentRepository paymentRepository) {
        this.orderRepository = orderRepository;
        this.paymentRepository = paymentRepository;
    }

    public record CustomerBalance(
            long orderCount,
            BigDecimal billedTotal,
            BigDecimal totalPaid) {

        public BigDecimal balanceDue() {
            return billedTotal.subtract(totalPaid);
        }
    }

    public Map<Long, CustomerBalance> balancesByCustomer() {
        Map<Long, BigDecimal> paidByCustomer = new HashMap<>();
        for (Object[] row : paymentRepository.getTotalPaidByCustomer()) {
            paidByCustomer.put((Long) row[0], (BigDecimal) row[1]);
        }

        Map<Long, CustomerBalance> balances = new HashMap<>();
        for (Object[] row : orderRepository.getBilledTotalsByCustomer()) {
            Long customerId = (Long) row[0];
            balances.put(customerId, new CustomerBalance(
                    (Long) row[1],
                    (BigDecimal) row[2],
                    paidByCustomer.getOrDefault(customerId, BigDecimal.ZERO)));
        }
        return balances;
    }

    public BigDecimal balanceDue(Long customerId) {
        CustomerBalance balance = balancesByCustomer().get(customerId);
        return balance == null ? BigDecimal.ZERO : balance.balanceDue();
    }
}
