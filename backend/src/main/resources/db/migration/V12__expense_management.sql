
CREATE TABLE expenses (
    id BIGSERIAL PRIMARY KEY,

    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,

    amount NUMERIC(14, 2) NOT NULL
        CHECK (amount > 0),

    payment_method VARCHAR(30) NOT NULL
        CHECK (
            payment_method IN (
                'CASH',
                'UPI',
                'BANK_TRANSFER',
                'CHEQUE',
                'CARD',
                'OTHER'
            )
        ),

    supplier_id BIGINT REFERENCES suppliers(id),
    reference_number VARCHAR(100),
    notes VARCHAR(1000),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_expense_date
    ON expenses (expense_date DESC);

CREATE INDEX idx_expenses_category_date
    ON expenses (category, expense_date DESC);
