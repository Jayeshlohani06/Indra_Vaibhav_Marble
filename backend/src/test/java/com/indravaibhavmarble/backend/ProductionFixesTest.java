package com.indravaibhavmarble.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.purchase.entity.PurchaseItem;
import com.indravaibhavmarble.purchase.service.PurchaseService;
import com.indravaibhavmarble.stockmovement.entity.StockMovement;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
class ProductionFixesTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private PurchaseService purchaseService;

    @Test
    void requestBodyCannotSetEntityIds() {
        Product product = jsonMapper.readValue(
                "{\"id\":5,\"name\":\"Marble\"}", Product.class);
        StockMovement movement = jsonMapper.readValue(
                "{\"id\":7,\"movementType\":\"ADJUSTMENT\"}", StockMovement.class);

        assertThat(product.getId()).isNull();
        assertThat(product.getName()).isEqualTo("Marble");
        assertThat(movement.getId()).isNull();
    }

    @Test
    @WithMockUser(authorities = {"PURCHASE_READ", "PAYMENT_READ"})
    void viewerCannotEditPurchases() throws Exception {
        mockMvc.perform(put("/api/purchases/999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "PURCHASE_MANAGE")
    void purchaseManagerReachesPurchaseEdit() throws Exception {
        // Passes security and fails validation instead.
        mockMvc.perform(put("/api/purchases/999999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(authorities = {"SALES_MANAGE", "SALES_READ"})
    void salesManageAloneCannotRecordOrViewPayments() throws Exception {
        mockMvc.perform(post("/api/sales-orders/999999/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/sales-orders/999999/payments"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "PURCHASE_MANAGE")
    void purchaseManageAloneCannotRecordPayments() throws Exception {
        mockMvc.perform(post("/api/purchases/999999/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "PAYMENT_MANAGE")
    void paymentManagerReachesPaymentEndpoint() throws Exception {
        mockMvc.perform(post("/api/purchases/999999/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(authorities = "PURCHASE_MANAGE")
    void malformedJsonIsBadRequest() throws Exception {
        mockMvc.perform(post("/api/purchases")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(authorities = "USER_READ")
    void methodSecurityDenialIsForbidden() throws Exception {
        mockMvc.perform(post("/api/users/data-reset")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "INVENTORY_MANAGE")
    void manualReversalMovementIsRejected() throws Exception {
        mockMvc.perform(post("/api/stock-movements")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":1,\"movementType\":\"REVERSAL\","
                                + "\"quantityChange\":1,\"referenceType\":\"REVERSAL\","
                                + "\"referenceId\":1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void invoiceDiscountReducesGstAcrossLines() throws Exception {
        PurchaseItem first = item("18.00");
        PurchaseItem second = item("5.00");

        BigDecimal gst = applyGst(
                List.of(first, second),
                List.of(new BigDecimal("1000.00"), new BigDecimal("500.00")),
                new BigDecimal("150.00"));

        // Discount split 100 / 50: GST = 900 x 18% + 450 x 5%.
        assertThat(first.getGstAmount()).isEqualByComparingTo("162.00");
        assertThat(second.getGstAmount()).isEqualByComparingTo("22.50");
        assertThat(gst).isEqualByComparingTo("184.50");
        assertThat(first.getLineTotal()).isEqualByComparingTo("1062.00");
        assertThat(second.getLineTotal()).isEqualByComparingTo("472.50");
    }

    @Test
    void invoiceDiscountRoundingRemainderIsFullyAllocated() throws Exception {
        PurchaseItem a = item("0.00");
        PurchaseItem b = item("0.00");
        PurchaseItem c = item("0.00");

        applyGst(
                List.of(a, b, c),
                List.of(new BigDecimal("1.00"), new BigDecimal("1.00"),
                        new BigDecimal("1.00")),
                new BigDecimal("1.00"));

        // With 0% GST the line totals equal the discounted taxable values.
        BigDecimal total = a.getLineTotal().add(b.getLineTotal())
                .add(c.getLineTotal());
        assertThat(total).isEqualByComparingTo("2.00");
        assertThat(List.of(a, b, c))
                .allMatch(line -> line.getLineTotal().signum() >= 0);
    }

    @Test
    void noInvoiceDiscountKeepsOriginalGst() throws Exception {
        PurchaseItem line = item("18.00");

        BigDecimal gst = applyGst(
                List.of(line),
                List.of(new BigDecimal("1000.00")),
                new BigDecimal("0.00"));

        assertThat(gst).isEqualByComparingTo("180.00");
        assertThat(line.getLineTotal()).isEqualByComparingTo("1180.00");
    }

    private PurchaseItem item(String gstRate) {
        PurchaseItem item = new PurchaseItem();
        item.setGstRate(new BigDecimal(gstRate));
        return item;
    }

    private BigDecimal applyGst(
            List<PurchaseItem> items,
            List<BigDecimal> taxable,
            BigDecimal invoiceDiscount) throws Exception {
        Method method = PurchaseService.class.getDeclaredMethod(
                "applyGst", List.class, List.class, BigDecimal.class);
        method.setAccessible(true);
        return (BigDecimal) method.invoke(
                purchaseService, items, taxable, invoiceDiscount);
    }
}
