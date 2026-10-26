package com.indravaibhavmarble.report.service;

import com.indravaibhavmarble.customer.entity.Customer;
import com.indravaibhavmarble.customer.repository.CustomerRepository;
import com.indravaibhavmarble.report.dto.CustomerOutstandingResponse;
import com.indravaibhavmarble.salesorder.service.CustomerBalanceService;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CustomerOutstandingReportService {

    private final CustomerBalanceService customerBalanceService;
    private final CustomerRepository customerRepository;

    public CustomerOutstandingReportService(
            CustomerBalanceService customerBalanceService,
            CustomerRepository customerRepository) {
        this.customerBalanceService = customerBalanceService;
        this.customerRepository = customerRepository;
    }

    /**
     * Customers who still owe money, largest balance first.
     */
    public List<CustomerOutstandingResponse> getCustomerOutstandingReport() {
        Map<Long, CustomerBalanceService.CustomerBalance> balances =
                customerBalanceService.balancesByCustomer();

        Map<Long, Customer> customers = customerRepository
                .findAllById(balances.keySet())
                .stream()
                .collect(Collectors.toMap(Customer::getId, Function.identity()));

        return balances.entrySet().stream()
                .filter(entry -> entry.getValue().balanceDue().signum() > 0)
                .map(entry -> {
                    Customer customer = customers.get(entry.getKey());
                    CustomerBalanceService.CustomerBalance balance = entry.getValue();
                    return new CustomerOutstandingResponse(
                            entry.getKey(),
                            customer == null ? "Unavailable customer" : customer.getName(),
                            customer == null ? null : customer.getPhone(),
                            balance.orderCount(),
                            balance.billedTotal(),
                            balance.totalPaid(),
                            balance.balanceDue());
                })
                .sorted(Comparator.comparing(
                        CustomerOutstandingResponse::outstandingBalance).reversed())
                .toList();
    }
}
