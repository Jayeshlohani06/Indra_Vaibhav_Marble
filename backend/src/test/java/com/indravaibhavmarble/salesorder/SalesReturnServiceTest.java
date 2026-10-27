package com.indravaibhavmarble.salesorder;

import com.indravaibhavmarble.cash.service.CashPeriodGuard;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.salesorder.dto.SalesOrderCancelRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnRequest;
import com.indravaibhavmarble.salesorder.dto.SalesReturnResponse;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import com.indravaibhavmarble.salesorder.entity.SalesOrderCharge;
import com.indravaibhavmarble.salesorder.entity.SalesOrderItem;
import com.indravaibhavmarble.salesorder.entity.SalesOrderPayment;
import com.indravaibhavmarble.salesorder.entity.SalesReturn;
import com.indravaibhavmarble.salesorder.entity.SalesReturnItem;
import com.indravaibhavmarble.salesorder.repository.SalesOrderChargeRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderPaymentRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderRepository;
import com.indravaibhavmarble.salesorder.repository.SalesReturnItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesReturnRepository;
import com.indravaibhavmarble.salesorder.service.SalesReturnService;
import com.indravaibhavmarble.stockmovement.service.StockMovementService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

class SalesReturnServiceTest {

    private final SalesOrderRepository orderRepository = mock(SalesOrderRepository.class);
    private final SalesOrderItemRepository itemRepository = mock(SalesOrderItemRepository.class);
    private final SalesOrderChargeRepository chargeRepository = mock(SalesOrderChargeRepository.class);
    private final SalesOrderPaymentRepository paymentRepository = mock(SalesOrderPaymentRepository.class);
    private final SalesReturnRepository returnRepository = mock(SalesReturnRepository.class);
    private final SalesReturnItemRepository returnItemRepository = mock(SalesReturnItemRepository.class);
    private final ProductRepository productRepository = mock(ProductRepository.class);
    private final StockMovementService stockMovementService = mock(StockMovementService.class);
    private final CashPeriodGuard periodGuard = mock(CashPeriodGuard.class);

    private final SalesReturnService service = new SalesReturnService(
            orderRepository, itemRepository, chargeRepository, paymentRepository,
            returnRepository, returnItemRepository, productRepository, stockMovementService,
            periodGuard);

    private SalesOrder order;
    private Product product;

    // A bill for 10 SQFT at 100 with 18% GST (9% + 9%) and a 50 loading charge:
    // 1000 + 90 + 90 + 50 = 1230.
    @BeforeEach
    void setUp() {
        order = SalesOrder.createNew();
        ReflectionTestUtils.setField(order, "id", 7L);
        order.setOrderNumber("INV-0007");
        order.setStatus("CONFIRMED");
        order.setOrderDate(LocalDate.of(2026, 10, 1));
        order.setGrandTotal(new BigDecimal("1230.00"));
        when(orderRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(order));

        SalesOrderItem item = SalesOrderItem.createNew();
        ReflectionTestUtils.setField(item, "id", 70L);
        item.setProductId(700L);
        item.setProductNameSnapshot("White Marble");
        item.setUnitCodeSnapshot("SQFT");
        item.setQuantity(new BigDecimal("10.000"));
        item.setPricingUnit("PRIMARY");
        item.setUnitPrice(new BigDecimal("100.00"));
        item.setGstRate(new BigDecimal("18.00"));
        item.setTaxableAmount(new BigDecimal("1000.00"));
        item.setCgstAmount(new BigDecimal("90.00"));
        item.setSgstAmount(new BigDecimal("90.00"));
        item.setIgstAmount(new BigDecimal("0.00"));
        item.setLineTotal(new BigDecimal("1180.00"));
        when(itemRepository.findBySalesOrderId(7L)).thenReturn(List.of(item));

        SalesOrderCharge charge = SalesOrderCharge.createNew();
        charge.setDescription("Loading");
        charge.setAmount(new BigDecimal("50.00"));
        when(chargeRepository.findBySalesOrderId(7L)).thenReturn(List.of(charge));

        product = mock(Product.class);
        when(product.getId()).thenReturn(700L);
        when(product.getStockQuantity()).thenReturn(new BigDecimal("2.000"));
        when(product.getSecondaryUnitId()).thenReturn(null);
        when(productRepository.findByIdForUpdate(700L)).thenReturn(Optional.of(product));

        when(returnRepository.findBySalesOrderIdOrderByIdAsc(7L)).thenReturn(List.of());
        when(returnRepository.nextReturnNumber()).thenReturn(1L);
        when(returnRepository.save(any(SalesReturn.class))).thenAnswer(call -> {
            SalesReturn saved = call.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 900L);
            return saved;
        });
        when(returnItemRepository.saveAll(anyList())).thenAnswer(call -> call.getArgument(0));
        when(paymentRepository.getTotalPaid(7L)).thenReturn(BigDecimal.ZERO);

        signInWith("SALES_MANAGE", "PAYMENT_MANAGE");
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    private static void signInWith(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("staff@example.com", null,
                        java.util.Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()));
    }

    private SalesReturnRequest returnOf(String quantity, String refundMethod) {
        return new SalesReturnRequest(LocalDate.of(2026, 10, 5), "Wrong shade", refundMethod,
                List.of(new SalesReturnItemRequest(70L, new BigDecimal(quantity), null)));
    }

    @Test
    void partialReturnOfAPaidBillAddsStockBackAndRefunds() {
        when(paymentRepository.getTotalPaid(7L)).thenReturn(new BigDecimal("1230.00"));

        SalesReturnResponse result = service.createReturn(7L, returnOf("4", "cash"));

        // 4 of 10 is 40% of the line: 400 + 36 + 36. Charges stay on the bill.
        assertThat(result.returnNumber()).isEqualTo("RET-0001");
        assertThat(result.subtotal()).isEqualByComparingTo("400.00");
        assertThat(result.totalTax()).isEqualByComparingTo("72.00");
        assertThat(result.chargesAmount()).isEqualByComparingTo("0");
        assertThat(result.totalAmount()).isEqualByComparingTo("472.00");
        assertThat(result.refundAmount()).isEqualByComparingTo("472.00");
        assertThat(result.createdBy()).isEqualTo("staff@example.com");
        assertThat(order.getReturnedTotal()).isEqualByComparingTo("472.00");
        assertThat(order.getNetTotal()).isEqualByComparingTo("758.00");
        assertThat(order.getStatus()).isEqualTo("CONFIRMED");

        verify(product).setStockQuantity(new BigDecimal("6.000"));
        verify(stockMovementService).recordMovementForExistingStockChange(
                eq(700L), eq(new BigDecimal("4.000")), eq(new BigDecimal("2.000")),
                eq(new BigDecimal("6.000")), eq("SALES_RETURN"), eq(900L), eq("RET-0001"),
                anyString(), eq(null), eq(null), eq(null));

        ArgumentCaptor<SalesOrderPayment> refund = ArgumentCaptor.forClass(SalesOrderPayment.class);
        verify(paymentRepository).save(refund.capture());
        assertThat(refund.getValue().getAmount()).isEqualByComparingTo("-472.00");
        assertThat(refund.getValue().getPaymentMethod()).isEqualTo("CASH");
        assertThat(refund.getValue().getSalesReturnId()).isEqualTo(900L);
    }

    @Test
    void unpaidBillReturnLowersWhatIsOwedWithoutARefund() {
        SalesReturnResponse result = service.createReturn(7L, returnOf("4", null));

        assertThat(result.refundAmount()).isEqualByComparingTo("0");
        assertThat(order.getNetTotal()).isEqualByComparingTo("758.00");
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void partPaidBillRefundsOnlyWhatWasPaidAboveTheNewTotal() {
        // Paid 1000; after the return the bill is worth 758, so 242 goes back.
        when(paymentRepository.getTotalPaid(7L)).thenReturn(new BigDecimal("1000.00"));

        SalesReturnResponse result = service.createReturn(7L, returnOf("4", "UPI"));

        assertThat(result.refundAmount()).isEqualByComparingTo("242.00");
    }

    @Test
    void cannotReturnMoreThanIsLeftOnTheBill() {
        assertThatThrownBy(() -> service.createReturn(7L, returnOf("11", null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only 10 SQFT of White Marble is left");
        verify(returnRepository, never()).save(any());
    }

    @Test
    void refundNeedsAMethodAndPaymentPermission() {
        when(paymentRepository.getTotalPaid(7L)).thenReturn(new BigDecimal("1230.00"));

        assertThatThrownBy(() -> service.createReturn(7L, returnOf("4", null)))
                .hasMessageContaining("Choose how 472.00 was given back");

        signInWith("SALES_MANAGE");
        assertThatThrownBy(() -> service.createReturn(7L, returnOf("4", "CASH")))
                .hasMessageContaining("Ask someone who can record payments");
        verify(returnRepository, never()).save(any());
    }

    @Test
    void cancellingAfterAPartialReturnTakesBackTheRestAndTheCharges() {
        // RET-0001 already took back 4 SQFT worth 472.
        SalesReturn earlier = SalesReturn.createNew();
        ReflectionTestUtils.setField(earlier, "id", 800L);
        SalesReturnItem earlierLine = SalesReturnItem.createNew();
        earlierLine.setSalesReturnId(800L);
        earlierLine.setSalesOrderItemId(70L);
        earlierLine.setQuantity(new BigDecimal("4.000"));
        earlierLine.setTaxableAmount(new BigDecimal("400.00"));
        earlierLine.setCgstAmount(new BigDecimal("36.00"));
        earlierLine.setSgstAmount(new BigDecimal("36.00"));
        earlierLine.setIgstAmount(new BigDecimal("0.00"));
        earlierLine.setLineTotal(new BigDecimal("472.00"));
        when(returnRepository.findBySalesOrderIdOrderByIdAsc(7L)).thenReturn(List.of(earlier));
        when(returnItemRepository.findBySalesReturnIdInOrderByIdAsc(List.of(800L)))
                .thenReturn(List.of(earlierLine));
        order.setReturnedTotal(new BigDecimal("472.00"));
        when(paymentRepository.getTotalPaid(7L)).thenReturn(new BigDecimal("500.00"));

        SalesReturnResponse result = service.cancelOrder(7L,
                new SalesOrderCancelRequest(LocalDate.of(2026, 10, 6), "Customer changed mind", "BANK_TRANSFER"));

        // The other 6 SQFT (600 + 54 + 54) plus the 50 charge.
        assertThat(result.cancelsOrder()).isTrue();
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).quantity()).isEqualByComparingTo("6");
        assertThat(result.totalAmount()).isEqualByComparingTo("758.00");
        assertThat(result.refundAmount()).isEqualByComparingTo("500.00");
        assertThat(order.getStatus()).isEqualTo("CANCELLED");
        assertThat(order.getCancelReason()).isEqualTo("Customer changed mind");
        assertThat(order.getNetTotal()).isEqualByComparingTo("0");
        verify(product).setStockQuantity(new BigDecimal("8.000"));
    }

    @Test
    void cancelledBillCannotBeCancelledOrReturnedAgain() {
        order.setStatus("CANCELLED");

        assertThatThrownBy(() -> service.cancelOrder(7L,
                new SalesOrderCancelRequest(null, "Again", null)))
                .hasMessageContaining("already cancelled");
        assertThatThrownBy(() -> service.createReturn(7L, returnOf("1", null)))
                .hasMessageContaining("already cancelled");
    }

    @Test
    void reasonIsRequired() {
        assertThatThrownBy(() -> service.cancelOrder(7L,
                new SalesOrderCancelRequest(null, "  ", null)))
                .hasMessageContaining("reason is required");
    }
}
