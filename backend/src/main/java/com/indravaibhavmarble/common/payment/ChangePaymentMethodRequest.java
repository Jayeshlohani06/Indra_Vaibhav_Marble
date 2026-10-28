package com.indravaibhavmarble.common.payment;

/** Fix a payment entered with the wrong method, for example cash that was really UPI. */
public record ChangePaymentMethodRequest(String paymentMethod, String reason) {
}
