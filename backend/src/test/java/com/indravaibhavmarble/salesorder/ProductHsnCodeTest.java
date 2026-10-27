package com.indravaibhavmarble.salesorder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.service.ProductService;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.service.SalesOrderService;

import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.json.JsonMapper;

/** Runs against the real database in a transaction that is rolled back. */
@SpringBootTest
@Transactional
class ProductHsnCodeTest {

    @Autowired private EntityManager entityManager;
    @Autowired private ProductService productService;
    @Autowired private SalesOrderService orderService;
    @Autowired private JsonMapper jsonMapper;

    private Long insert(String sql) {
        return ((Number) entityManager.createNativeQuery(sql).getSingleResult()).longValue();
    }

    @Test
    void productHsnCodeIsCheckedAndTidied() {
        String tag = Long.toString(System.nanoTime(), 36);
        Long unitId = insert("INSERT INTO measurement_units (code, name, is_active, created_at) VALUES ('H" + tag
                + "', 'Test unit', true, now()) RETURNING id");
        Long categoryId = insert("INSERT INTO product_categories (name, is_active, created_at, updated_at) VALUES ('Hsn "
                + tag + "', true, now(), now()) RETURNING id");
        String json = "{\"name\":\"Hsn marble " + tag + "\",\"categoryId\":" + categoryId + ",\"unitId\":" + unitId
                + ",\"sellingPrice\":100,\"purchasePrice\":60,\"gstRate\":18,\"lowStockThreshold\":0,\"hsnCode\":\"%s\"}";

        assertThatThrownBy(() -> productService.createProduct(
                jsonMapper.readValue(json.formatted("12345"), Product.class)))
                .hasMessageContaining("HSN code must be 4, 6 or 8 digits");

        Product withSpaces = productService.createProduct(
                jsonMapper.readValue(json.formatted("6802 10"), Product.class));
        assertThat(withSpaces.getHsnCode()).isEqualTo("680210");

        Product blank = productService.createProduct(jsonMapper.readValue(
                json.replace("Hsn marble", "Plain marble").formatted(" "), Product.class));
        assertThat(blank.getHsnCode()).isNull();
    }

    @Test
    void billsShowTheProductsHsnCode() {
        String tag = Long.toString(System.nanoTime(), 36);
        Long unitId = insert("INSERT INTO measurement_units (code, name, is_active, created_at) VALUES ('B" + tag
                + "', 'Test unit', true, now()) RETURNING id");
        Long categoryId = insert("INSERT INTO product_categories (name, is_active, created_at, updated_at) VALUES ('Bill "
                + tag + "', true, now(), now()) RETURNING id");
        Long productId = insert("INSERT INTO products (product_code, name, hsn_code, category_id, unit_id, selling_price,"
                + " purchase_price, gst_rate, stock_quantity, secondary_stock_quantity, low_stock_threshold, is_active,"
                + " created_at, updated_at) VALUES ('B" + tag + "', 'Bill marble', '6802', " + categoryId + ", " + unitId
                + ", 100, 60, 18, 20, 0, 0, true, now(), now()) RETURNING id");
        Long customerId = insert("INSERT INTO customers (customer_code, name, phone, credit_limit, is_active, created_at, updated_at)"
                + " VALUES ('B" + tag + "', 'Test customer', '9000000000', 0, true, now(), now()) RETURNING id");

        SalesOrderResponse order = orderService.createOrder(new SalesOrderRequest(customerId, null, "INTRA", null,
                List.of(new SalesOrderItemRequest(productId, BigDecimal.ONE, null, null, null, null)), null));
        assertThat(order.items().get(0).hsnCode()).isEqualTo("6802");

        // The bill keeps the code it was sold with when the product changes later.
        entityManager.flush();
        entityManager.createNativeQuery("UPDATE products SET hsn_code = '68021000' WHERE id = " + productId)
                .executeUpdate();
        entityManager.clear();
        assertThat(orderService.getOrderById(order.id()).items().get(0).hsnCode()).isEqualTo("6802");

        // A bill saved before HSN codes existed shows the product's current code.
        entityManager.createNativeQuery("UPDATE sales_order_items SET hsn_code_snapshot = NULL WHERE sales_order_id = "
                + order.id()).executeUpdate();
        entityManager.clear();
        assertThat(orderService.getOrderById(order.id()).items().get(0).hsnCode()).isEqualTo("68021000");
    }
}
