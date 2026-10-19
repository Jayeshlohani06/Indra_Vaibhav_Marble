
package com.indravaibhavmarble.purchase.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PurchasePaymentRequestTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void rejectsZeroPaymentAmount() {
        PurchasePaymentRequest request = new PurchasePaymentRequest(
                LocalDate.now(),
                BigDecimal.ZERO,
                "UPI",
                null,
                null
        );

        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void acceptsValidPaymentRequest() {
        PurchasePaymentRequest request = new PurchasePaymentRequest(
                LocalDate.now(),
                new BigDecimal("100.00"),
                "UPI",
                "TEST-REF",
                "Validation test only"
        );

        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void rejectsAmountWithMoreThanTwoDecimalPlaces() {
        PurchasePaymentRequest request = new PurchasePaymentRequest(
                LocalDate.now(),
                new BigDecimal("100.123"),
                "UPI",
                null,
                null
        );

        assertFalse(validator.validate(request).isEmpty());
    }
}
