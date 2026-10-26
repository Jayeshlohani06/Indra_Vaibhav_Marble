UPDATE purchases p
SET gst_amount = ROUND(
        (
            COALESCE(p.gst_amount, 0)
            + COALESCE((
                SELECT SUM(pe.amount)
                FROM purchase_expenses pe
                WHERE pe.purchase_id = p.id
            ), 0) * COALESCE(p.gst_rate, 0) / 100
        )::numeric,
        2
    ),
    total_amount = ROUND(
        (
            COALESCE(p.total_amount, 0)
            + COALESCE((
                SELECT SUM(pe.amount)
                FROM purchase_expenses pe
                WHERE pe.purchase_id = p.id
            ), 0) * COALESCE(p.gst_rate, 0) / 100
        )::numeric,
        2
    )
WHERE EXISTS (
    SELECT 1
    FROM purchase_expenses pe
    WHERE pe.purchase_id = p.id
);
