
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
        return getCustomers("ACTIVE");
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> getCustomers(String status) {
        List<Customer> customers = switch (status == null
                ? "ACTIVE" : status.trim().toUpperCase(Locale.ROOT)) {
            case "ALL" -> customerRepository.findAllByOrderByNameAsc();
            case "INACTIVE" -> customerRepository.findByActiveFalseOrderByNameAsc();
            default -> customerRepository.findByActiveTrueOrderByNameAsc();
        };
        return customers
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

        String customerCode = generateCustomerCode();

        if (customerRepository.findByCustomerCodeIgnoreCase(customerCode)
                .isPresent()) {
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

        String customerCode = request.customerCode() == null
                || request.customerCode().isBlank()
                ? existing.getCustomerCode()
                : normalizeCode(request.customerCode());

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

    public CustomerResponse reactivateCustomer(Long id) {
        Customer customer = findCustomerById(id);
        customer.setActive(true);
        return CustomerMapper.toResponse(customerRepository.save(customer));
    }

    @Transactional(readOnly = true)
    public List<CustomerResponse> searchCustomers(
            String name, String phone, String status) {
        String term = name != null && !name.isBlank()
                ? name.trim().toLowerCase(Locale.ROOT)
                : phone == null ? "" : phone.trim().toLowerCase(Locale.ROOT);
        return getCustomers(status).stream()
                .filter(customer -> term.isBlank()
                        || customer.name().toLowerCase(Locale.ROOT).contains(term)
                        || customer.customerCode().toLowerCase(Locale.ROOT).contains(term)
                        || customer.phone().toLowerCase(Locale.ROOT).contains(term)
                        || (customer.email() != null
                        && customer.email().toLowerCase(Locale.ROOT).contains(term))
                        || (customer.gstin() != null
                        && customer.gstin().toLowerCase(Locale.ROOT).contains(term)))
                .toList();
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

        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException(
                    "Customer name is required");
        }

        if (request.phone() == null || request.phone().isBlank()) {
            throw new IllegalArgumentException(
                    "Customer phone is required");
        }

        if (request.customerCode() != null
                && request.customerCode().trim().length() > 30) {
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

        if (!request.phone().trim().matches("^[0-9+()\\- ]{7,20}$")) {
            throw new IllegalArgumentException(
                    "Enter a valid phone number");
        }

        if (request.email() != null
                && request.email().length() > 150) {
            throw new IllegalArgumentException(
                    "Email cannot exceed 150 characters");
        }
        if (request.email() != null && !request.email().isBlank()
                && !request.email().trim().matches(
                "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            throw new IllegalArgumentException("Enter a valid email address");
        }

        if (request.gstin() != null
                && !request.gstin().isBlank()
                && request.gstin().trim().length() != 15) {
            throw new IllegalArgumentException(
                    "GSTIN must contain exactly 15 characters");
        }
        if (request.gstin() != null && !request.gstin().isBlank()
                && !request.gstin().trim().toUpperCase(Locale.ROOT).matches(
                "^[0-9]{2}[A-Z0-9]{13}$")) {
            throw new IllegalArgumentException("Enter a valid GSTIN");
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

    private String generateCustomerCode() {
        int sequence = customerRepository.count() > Integer.MAX_VALUE
                ? Integer.MAX_VALUE
                : (int) customerRepository.count() + 1;
        String code;
        do {
            code = String.format(Locale.ROOT, "CUST-%05d", sequence++);
        } while (customerRepository.findByCustomerCodeIgnoreCase(code)
                .isPresent());
        return code;
    }
}
