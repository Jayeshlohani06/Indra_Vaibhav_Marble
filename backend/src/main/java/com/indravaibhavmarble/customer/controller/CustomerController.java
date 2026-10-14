
package com.indravaibhavmarble.customer.controller;

import com.indravaibhavmarble.customer.dto.CustomerRequest;
import com.indravaibhavmarble.customer.dto.CustomerResponse;
import com.indravaibhavmarble.customer.service.CustomerService;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public List<CustomerResponse> getAllCustomers(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String phone
    ) {
        if ((name != null && !name.isBlank())
                || (phone != null && !phone.isBlank())) {
            return customerService.searchCustomers(name, phone);
        }

        return customerService.getAllCustomers();
    }

    @GetMapping("/{id}")
    public CustomerResponse getCustomerById(@PathVariable Long id) {
        return customerService.getCustomerById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerResponse createCustomer(
            @RequestBody CustomerRequest request
    ) {
        return customerService.createCustomer(request);
    }

    @PutMapping("/{id}")
    public CustomerResponse updateCustomer(
            @PathVariable Long id,
            @RequestBody CustomerRequest request
    ) {
        return customerService.updateCustomer(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateCustomer(@PathVariable Long id) {
        customerService.deactivateCustomer(id);
    }
}
