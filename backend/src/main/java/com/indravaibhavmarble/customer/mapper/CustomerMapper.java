
package com.indravaibhavmarble.customer.mapper;

import com.indravaibhavmarble.customer.dto.CustomerRequest;
import com.indravaibhavmarble.customer.dto.CustomerResponse;
import com.indravaibhavmarble.customer.entity.Customer;

public final class CustomerMapper {

    private CustomerMapper() {
        // Prevent instantiation of this utility class.
    }

    public static Customer toEntity(CustomerRequest request) {
        Customer customer = Customer.createNew();
        updateEntity(customer, request);
        return customer;
    }

    public static void updateEntity(
            Customer customer,
            CustomerRequest request
    ) {
        customer.setCustomerCode(request.customerCode());
        customer.setName(request.name());
        customer.setPhone(request.phone());
        customer.setEmail(request.email());
        customer.setGstin(request.gstin());
        customer.setBillingAddress(request.billingAddress());
        customer.setShippingAddress(request.shippingAddress());
        customer.setCreditLimit(request.creditLimit());
    }

    public static CustomerResponse toResponse(Customer customer) {
        return new CustomerResponse(
                customer.getId(),
                customer.getCustomerCode(),
                customer.getName(),
                customer.getPhone(),
                customer.getEmail(),
                customer.getGstin(),
                customer.getBillingAddress(),
                customer.getShippingAddress(),
                customer.getCreditLimit(),
                customer.isActive(),
                customer.getCreatedAt(),
                customer.getUpdatedAt()
        );
    }
}
