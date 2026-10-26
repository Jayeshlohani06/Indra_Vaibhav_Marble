-- Lists of bills and purchases are sorted newest first by created_at.
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases (created_at DESC);

-- Foreign keys that had no index of their own.
CREATE INDEX IF NOT EXISTS idx_expenses_supplier_id ON expenses (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_expenses_category_id ON purchase_expenses (category_id);
