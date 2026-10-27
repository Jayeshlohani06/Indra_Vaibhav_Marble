-- Optional HSN code on products (4, 6 or 8 digits). Each bill line keeps the
-- code it was sold with, so later edits to the product don't change old bills.
ALTER TABLE products
    ADD COLUMN hsn_code VARCHAR(8),
    ADD CONSTRAINT chk_products_hsn_code CHECK (hsn_code ~ '^[0-9]{4}([0-9]{2}){0,2}$');

ALTER TABLE sales_order_items
    ADD COLUMN hsn_code_snapshot VARCHAR(8);
