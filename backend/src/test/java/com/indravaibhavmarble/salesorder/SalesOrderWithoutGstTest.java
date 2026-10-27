package com.indravaibhavmarble.salesorder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.indravaibhavmarble.category.entity.ProductCategory;
import com.indravaibhavmarble.category.repository.ProductCategoryRepository;
import com.indravaibhavmarble.customer.entity.Customer;
import com.indravaibhavmarble.customer.repository.CustomerRepository;
import com.indravaibhavmarble.product.entity.Product;
import com.indravaibhavmarble.product.repository.ProductRepository;
import com.indravaibhavmarble.salesorder.dto.SalesOrderItemRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderRequest;
import com.indravaibhavmarble.salesorder.dto.SalesOrderResponse;
import com.indravaibhavmarble.salesorder.entity.SalesOrder;
import com.indravaibhavmarble.salesorder.repository.SalesOrderChargeRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderPaymentRepository;
import com.indravaibhavmarble.salesorder.repository.SalesOrderRepository;
import com.indravaibhavmarble.salesorder.repository.SalesReturnItemRepository;
import com.indravaibhavmarble.salesorder.repository.SalesReturnRepository;
import com.indravaibhavmarble.salesorder.service.SalesOrderService;
import com.indravaibhavmarble.stockmovement.service.StockMovementService;
import com.indravaibhavmarble.unit.entity.MeasurementUnit;
import com.indravaibhavmarble.unit.repository.MeasurementUnitRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SalesOrderWithoutGstTest {

    private final SalesOrderRepository orderRepository = mock(SalesOrderRepository.class);
    private final SalesOrderItemRepository itemRepository = mock(SalesOrderItemRepository.class);
    private final SalesOrderChargeRepository chargeRepository = mock(SalesOrderChargeRepository.class);
    private final CustomerRepository customerRepository = mock(CustomerRepository.class);
    private final ProductRepository productRepository = mock(ProductRepository.class);
    private final MeasurementUnitRepository unitRepository = mock(MeasurementUnitRepository.class);
    private final ProductCategoryRepository categoryRepository = mock(ProductCategoryRepository.class);

    private final SalesOrderService service = new SalesOrderService(
            orderRepository, itemRepository, chargeRepository, customerRepository,
            productRepository, unitRepository, categoryRepository,
            mock(StockMovementService.class), mock(SalesOrderPaymentRepository.class),
            mock(SalesReturnRepository.class), mock(SalesReturnItemRepository.class));

    @BeforeEach
    void setUp() {
        Customer customer = Customer.createNew();
        customer.setName("Walk-in");
        when(customerRepository.findById(1L)).thenReturn(Optional.of(customer));

        // A product that normally carries 18% GST.
        Product product = mock(Product.class);
        when(product.isActive()).thenReturn(true);
        when(product.getProductCode()).thenReturn("MRB-1");
        when(product.getStockQuantity()).thenReturn(new BigDecimal("100.000"));
        when(product.getGstRate()).thenReturn(new BigDecimal("18.00"));
        when(product.getSellingPrice()).thenReturn(new BigDecimal("250.00"));
        when(product.getSecondaryUnitId()).thenReturn(null);
        when(product.getUnitId()).thenReturn(1L);
        when(product.getCategoryId()).thenReturn(1L);
        when(productRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(product));

        MeasurementUnit unit = mock(MeasurementUnit.class);
        when(unit.isActive()).thenReturn(true);
        when(unitRepository.findById(1L)).thenReturn(Optional.of(unit));
        ProductCategory category = mock(ProductCategory.class);
        when(category.isActive()).thenReturn(true);
        when(categoryRepository.findById(1L)).thenReturn(Optional.of(category));

        when(orderRepository.nextOrderNumber()).thenReturn(5L);
        when(orderRepository.nextEstimateNumber()).thenReturn(3L);
        when(orderRepository.save(any(SalesOrder.class))).thenAnswer(call -> call.getArgument(0));
        when(itemRepository.saveAll(anyList())).thenAnswer(call -> call.getArgument(0));
        when(chargeRepository.saveAll(anyList())).thenAnswer(call -> call.getArgument(0));
    }

    private SalesOrderRequest request(String taxType, BigDecimal gstRate) {
        return new SalesOrderRequest(1L, LocalDate.of(2026, 10, 27), taxType, null,
                List.of(new SalesOrderItemRequest(1L, new BigDecimal("4"), null,
                        null, null, gstRate)),
                null);
    }

    @Test
    void billWithoutGstChargesOnlyThePriceAndUsesEstimateNumbers() {
        // The rate sent by the screen is ignored for a bill without GST.
        SalesOrderResponse order = service.createOrder(request("NONE", new BigDecimal("18")));

        assertThat(order.orderNumber()).isEqualTo("EST-0003");
        assertThat(order.taxType()).isEqualTo("NONE");
        assertThat(order.subtotal()).isEqualByComparingTo("1000.00");
        assertThat(order.totalTax()).isEqualByComparingTo("0");
        assertThat(order.grandTotal()).isEqualByComparingTo("1000.00");
        assertThat(order.items().get(0).gstRate()).isEqualByComparingTo("0");
        verify(orderRepository, never()).nextOrderNumber();
    }

    @Test
    void gstBillStillAddsTaxAndUsesInvoiceNumbers() {
        SalesOrderResponse order = service.createOrder(request("INTRA", null));

        assertThat(order.orderNumber()).isEqualTo("INV-0005");
        assertThat(order.cgstAmount()).isEqualByComparingTo("90.00");
        assertThat(order.sgstAmount()).isEqualByComparingTo("90.00");
        assertThat(order.grandTotal()).isEqualByComparingTo("1180.00");
        verify(orderRepository, never()).nextEstimateNumber();
    }
}
