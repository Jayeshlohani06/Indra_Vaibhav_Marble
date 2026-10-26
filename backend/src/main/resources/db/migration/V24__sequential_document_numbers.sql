-- Short sequential numbers for new sales orders (INV-0001) and purchases
-- (PUR-0001). Existing documents keep their original numbers.
CREATE SEQUENCE IF NOT EXISTS sales_order_number_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS purchase_number_seq START WITH 1;
