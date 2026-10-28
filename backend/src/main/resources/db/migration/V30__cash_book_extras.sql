-- Cash book extras: owner settings, duplicate-save protection on payments,
-- the daily UPI/bank check, and monthly salary for the staff salary sheet.
-- Only adds columns and one table; existing data is unchanged.

ALTER TABLE cash_settings
    -- Owner's WhatsApp number for the day summary (digits, with country code).
    ADD COLUMN owner_whatsapp VARCHAR(20),
    -- After this time (IST) an open day shows a "count and close" reminder.
    ADD COLUMN closing_reminder_time TIME NOT NULL DEFAULT '20:00',
    -- Expenses above this need a bill/receipt number unless the owner enters
    -- them. 0 turns the rule off.
    ADD COLUMN large_expense_threshold NUMERIC(14,2) NOT NULL DEFAULT 5000
        CHECK (large_expense_threshold >= 0);

-- A double-tapped "Save payment" records the payment once.
ALTER TABLE sales_order_payments ADD COLUMN request_id UUID UNIQUE;
ALTER TABLE purchase_payments ADD COLUMN request_id UUID UNIQUE;

-- What the UPI app / bank statement showed as received for the day, entered
-- at closing and compared with the payments recorded in the app.
CREATE TABLE cash_digital_checks (
    session_id BIGINT NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL,
    reported_amount NUMERIC(14,2) NOT NULL CHECK (reported_amount >= 0),
    PRIMARY KEY (session_id, payment_method)
);

ALTER TABLE staff_members
    ADD COLUMN monthly_salary NUMERIC(14,2) CHECK (monthly_salary IS NULL OR monthly_salary >= 0);
