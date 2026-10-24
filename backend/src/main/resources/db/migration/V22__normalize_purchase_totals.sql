UPDATE purchases p
SET total_amount = ROUND(
    (
        COALESCE(p.subtotal, 0)
        - COALESCE(p.discount_amount, 0)
        + COALESCE(p.gst_amount, 0)
        + COALESCE((
            SELECT SUM(pe.amount)
            FROM purchase_expenses pe
            WHERE pe.purchase_id = p.id
        ), 0)
    )::numeric,
    2
);
