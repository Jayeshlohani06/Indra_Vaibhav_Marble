-- Bills without GST (estimates). They carry tax type 'NONE', zero tax, and
-- their own number series (EST-0001) so GST invoice numbers stay unbroken.
ALTER TABLE sales_orders DROP CONSTRAINT chk_sales_order_tax_type;
ALTER TABLE sales_orders ADD CONSTRAINT chk_sales_order_tax_type
    CHECK (tax_type IN ('INTRA', 'INTER', 'NONE'));

CREATE SEQUENCE IF NOT EXISTS sales_estimate_number_seq START WITH 1;
