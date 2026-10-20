ALTER TABLE expenses
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN voided_at TIMESTAMPTZ,
    ADD COLUMN void_reason VARCHAR(500);

ALTER TABLE expenses
    ADD CONSTRAINT expenses_status_check
    CHECK (status IN ('ACTIVE', 'VOIDED'));

CREATE INDEX idx_expenses_status_date
    ON expenses (status, expense_date DESC);

CREATE TABLE expense_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    category_type VARCHAR(40) NOT NULL DEFAULT 'OPERATING',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expense_category_type_check
        CHECK (category_type IN ('OPERATING', 'ADMINISTRATIVE', 'SELLING', 'FINANCIAL', 'OTHER'))
);

CREATE INDEX idx_expense_categories_active_name
    ON expense_categories (is_active, name);

INSERT INTO expense_categories (name, description, category_type)
VALUES
    ('Rent', 'Office, warehouse, or showroom rent', 'OPERATING'),
    ('Utilities', 'Electricity, water, internet, and similar services', 'OPERATING'),
    ('Transport', 'Delivery, fuel, and transportation costs', 'SELLING'),
    ('Office Supplies', 'Stationery and general office supplies', 'ADMINISTRATIVE'),
    ('Repairs and Maintenance', 'Equipment, vehicle, and premises maintenance', 'OPERATING')
ON CONFLICT (name) DO NOTHING;
