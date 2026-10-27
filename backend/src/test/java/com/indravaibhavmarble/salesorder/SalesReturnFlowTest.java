package com.indravaibhavmarble.salesorder;

import static org.assertj.core.api.Assertions.assertThat;

import com.indravaibhavmarble.salesorder.dto.SalesOrderCancelRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.dto.SalesReturnItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderPaymentRequest;
import com.indravaibhavmarble.salesorder.service.CustomerBalanceService;
import com.indravaibhavmarble.salesorder.service.SalesOrderPaymentService;
import com.indravaibhavmarble.salesorder.service.SalesOrderService;
import com.indravaibhavmarble.salesorder.service.SalesReturnService;

import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sells, returns part, then cancels a bill against the real database.
 * Everything runs in one transaction that is rolled back afterwards.
 */
@SpringBootTest
@Transactional
@WithMockUser(username = "staff@example.com", authorities = {"SALES_MANAGE", "PAYMENT_MANAGE"})
class SalesReturnFlowTest {

    @Autowired private EntityManager entityManager;
    @Autowired private SalesOrderService orderService;
    @Autowired private SalesReturnService returnService;
    @Autowired private SalesOrderPaymentService paymentService;
    @Autowired private CustomerBalanceService balanceService;

    private Long insert(String sql) {
        return ((Number) entityManager.createNativeQuery(sql).getSingleResult()).longValue();
    }

    private BigDecimal stockOf(Long productId) {
        return (BigDecimal) entityManager.createNativeQuery(
                "SELECT stock_quantity FROM products WHERE id = " + productId).getSingleResult();
    }

    @Test
    void returnThenCancelPutsStockBackAndRefunds() {
        String tag = Long.toString(System.nanoTime(), 36);
        Long unitId = insert("INSERT INTO measurement_units (code, name, is_active, created_at) VALUES ('T" + tag
                + "', 'Test unit', true, now()) RETURNING id");
        Long categoryId = insert("INSERT INTO product_categories (name, is_active, created_at, updated_at) VALUES ('Test "
                + tag + "', true, now(), now()) RETURNING id");
        Long productId = insert("INSERT INTO products (product_code, name, category_id, unit_id, selling_price, purchase_price,"
                + " gst_rate, stock_quantity, secondary_stock_quantity, low_stock_threshold, is_active, created_at, updated_at)"
                + " VALUES ('P" + tag + "', 'Test marble', " + categoryId + ", " + unitId
                + ", 100, 60, 18, 20, 0, 0, true, now(), now()) RETURNING id");
        Long customerId = insert("INSERT INTO customers (customer_code, name, phone, credit_limit, is_active, created_at, updated_at)"
                + " VALUES ('C" + tag + "', 'Test customer', '9000000000', 0, true, now(), now()) RETURNING id");

        // 10 at 100 + 18% GST = 1180, paid in full.
        SalesOrderResponse order = orderService.createOrder(new SalesOrderRequest(customerId, null, "INTRA", null,
                List.of(new SalesOrderItemRequest(productId, new BigDecimal("10"), null, null, null, null)), null));
        assertThat(stockOf(productId)).isEqualByComparingTo("10");
        paymentService.recordPayment(order.id(), new SalesOrderPaymentRequest(
                order.orderDate(), new BigDecimal("1180.00"), "CASH", null, null));

        // Return 3: worth 354, all refunded because the bill was paid.
        var firstReturn = returnService.createReturn(order.id(), new SalesReturnRequest(null, "Broken", "UPI",
                List.of(new SalesReturnItemRequest(order.items().get(0).id(), new BigDecimal("3"), null))));
        entityManager.flush();
        assertThat(firstReturn.totalAmount()).isEqualByComparingTo("354.00");
        assertThat(firstReturn.refundAmount()).isEqualByComparingTo("354.00");
        assertThat(stockOf(productId)).isEqualByComparingTo("13");

        SalesOrderResponse afterReturn = orderService.getOrderById(order.id());
        assertThat(afterReturn.netTotal()).isEqualByComparingTo("826.00");
        assertThat(afterReturn.amountPaid()).isEqualByComparingTo("826.00");
        assertThat(afterReturn.paymentStatus()).isEqualTo("PAID");
        assertThat(afterReturn.items().get(0).returnedQuantity()).isEqualByComparingTo("3");
        assertThat(afterReturn.returns()).hasSize(1);
        assertThat(balanceService.balanceDue(customerId)).isEqualByComparingTo("0");

        // Cancel: the other 7 come back and the rest of the money is refunded.
        var cancellation = returnService.cancelOrder(order.id(),
                new SalesOrderCancelRequest(null, "Order called off", "CASH"));
        entityManager.flush();
        assertThat(cancellation.totalAmount()).isEqualByComparingTo("826.00");
        assertThat(cancellation.refundAmount()).isEqualByComparingTo("826.00");
        assertThat(stockOf(productId)).isEqualByComparingTo("20");

        SalesOrderResponse cancelled = orderService.getOrderById(order.id());
        assertThat(cancelled.status()).isEqualTo("CANCELLED");
        assertThat(cancelled.netTotal()).isEqualByComparingTo("0");
        assertThat(cancelled.amountPaid()).isEqualByComparingTo("0");
        assertThat(cancelled.returns()).hasSize(2);

        Number returnMovements = (Number) entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM stock_movements WHERE product_id = " + productId
                        + " AND movement_type = 'RETURN' AND reference_type = 'SALES_RETURN'").getSingleResult();
        assertThat(returnMovements.intValue()).isEqualTo(2);
    }
}
