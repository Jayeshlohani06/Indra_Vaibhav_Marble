CREATE TABLE purchase_expenses (
    id BIGSERIAL PRIMARY KEY,
    purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES expense_categories(id),
    description VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0)
);

CREATE INDEX idx_purchase_expenses_purchase_id
    ON purchase_expenses(purchase_id);
