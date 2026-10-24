ALTER TABLE products
    ADD COLUMN secondary_unit_id BIGINT REFERENCES measurement_units(id),
    ADD COLUMN secondary_per_primary NUMERIC(14, 6),
    ADD COLUMN secondary_stock_quantity NUMERIC(14, 3) NOT NULL DEFAULT 0;

ALTER TABLE products
    ADD CONSTRAINT chk_products_secondary_conversion
    CHECK (secondary_per_primary IS NULL OR secondary_per_primary > 0);

ALTER TABLE purchase_items
    ADD COLUMN secondary_quantity NUMERIC(14, 3),
    ADD COLUMN pricing_unit VARCHAR(10) NOT NULL DEFAULT 'PRIMARY';

ALTER TABLE stock_movements
    ADD COLUMN secondary_quantity_change NUMERIC(14, 3),
    ADD COLUMN secondary_stock_before NUMERIC(14, 3),
    ADD COLUMN secondary_stock_after NUMERIC(14, 3);

ALTER TABLE sales_order_items
    ADD COLUMN secondary_quantity NUMERIC(14, 3),
    ADD COLUMN pricing_unit VARCHAR(10) NOT NULL DEFAULT 'PRIMARY';
