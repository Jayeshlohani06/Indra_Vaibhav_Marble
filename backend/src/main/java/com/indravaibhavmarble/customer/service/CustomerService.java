
package com.indravaibhavmarble.customer.service;

import com.indravaibhavmarble.customer.dto.CustomerRequest;
import com.indravaibhavmarble.customer.dto.CustomerResponse;
import com.indravaibhavmarble.customer.entity.Customer;
import com.indravaibhavmarble.customer.mapper.CustomerMapper;
import com.indravaibhavmarble.customer.repository.CustomerRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> getAllCustomers() {
        return customerRepository.findByActiveTrueOrderByNameAsc()
                .stream()
                .map(CustomerMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CustomerResponse getCustomerById(Long id) {
        Customer customer = findCustomerById(id);
        return CustomerMapper.toResponse(customer);
    }

    public CustomerResponse createCustomer(CustomerRequest request) {
        validateCustomer(request);

        String customerCode = normalizeCode(request.customerCode());

        if (customerRepository.existsByCustomerCode(customerCode)) {
            throw new IllegalArgumentException(
                    "Customer code already exists: " + customerCode);
        }

        Customer customer = CustomerMapper.toEntity(request);
        customer.setCustomerCode(customerCode);

        Customer savedCustomer = customerRepository.save(customer);
        return CustomerMapper.toResponse(savedCustomer);
    }

    public CustomerResponse updateCustomer(
            Long id,
            CustomerRequest request
    ) {
        Customer existing = findCustomerById(id);
        validateCustomer(request);

        String customerCode = normalizeCode(request.customerCode());

        customerRepository.findByCustomerCode(customerCode)
                .ifPresent(customer -> {
                    if (!customer.getId().equals(id)) {
                        throw new IllegalArgumentException(
                                "Customer code already exists: "
                                        + customerCode);
                    }
                });

        CustomerMapper.updateEntity(existing, request);
        existing.setCustomerCode(customerCode);

        Customer savedCustomer = customerRepository.save(existing);
        return CustomerMapper.toResponse(savedCustomer);
    }

    public void deactivateCustomer(Long id) {
        Customer customer = findCustomerById(id);
        customer.setActive(false);
        customerRepository.save(customer);
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> searchCustomers(String name, String phone) {
        if (name != null && !name.isBlank()) {
            return customerRepository
                    .findByNameContainingIgnoreCaseOrderByNameAsc(name.trim())
                    .stream()
                    .filter(Customer::isActive)
                    .map(CustomerMapper::toResponse)
                    .toList();
        }

        if (phone != null && !phone.isBlank()) {
            return customerRepository.findByPhoneContaining(phone.trim())
                    .stream()
                    .filter(Customer::isActive)
                    .map(CustomerMapper::toResponse)
                    .toList();
        }

        return getAllCustomers();
    }

    private Customer findCustomerById(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException(
                    "Customer ID must be a positive number");
        }

        return customerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Customer not found with ID: " + id));
    }

    private void validateCustomer(CustomerRequest request) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Customer request is required");
        }

        if (request.customerCode() == null
                || request.customerCode().isBlank()) {
            throw new IllegalArgumentException(
                    "Customer code is required");
        }

        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException(
                    "Customer name is required");
        }

        if (request.phone() == null || request.phone().isBlank()) {
            throw new IllegalArgumentException(
                    "Customer phone is required");
        }

        if (request.customerCode().trim().length() > 30) {
            throw new IllegalArgumentException(
                    "Customer code cannot exceed 30 characters");
        }

        if (request.name().trim().length() > 150) {
            throw new IllegalArgumentException(
                    "Customer name cannot exceed 150 characters");
        }

        if (request.phone().trim().length() > 20) {
            throw new IllegalArgumentException(
                    "Customer phone cannot exceed 20 characters");
        }

        if (request.email() != null
                && request.email().length() > 150) {
            throw new IllegalArgumentException(
                    "Email cannot exceed 150 characters");
        }

        if (request.gstin() != null
                && !request.gstin().isBlank()
                && request.gstin().trim().length() != 15) {
            throw new IllegalArgumentException(
                    "GSTIN must contain exactly 15 characters");
        }

        BigDecimal creditLimit = request.creditLimit();

        if (creditLimit != null && creditLimit.signum() < 0) {
            throw new IllegalArgumentException(
                    "Credit limit cannot be negative");
        }
    }

    private String normalizeCode(String customerCode) {
        return customerCode.trim().toUpperCase(Locale.ROOT);
    }
}
