
-- V10: Tile packaging configuration.
-- Preserve existing product settings and stock balances.

ALTER TABLE product_inventory_settings
    ADD COLUMN tile_length_ft NUMERIC(10, 3),
    ADD COLUMN tile_width_ft NUMERIC(10, 3),
    ADD COLUMN pieces_per_box INTEGER;

-- Tile dimensions and pieces per box must either all be present
-- or all be absent. Non-tile products cannot use tile packaging.
ALTER TABLE product_inventory_settings
    ADD CONSTRAINT chk_tile_packaging_dimensions
    CHECK (
        (
            tile_length_ft IS NULL
            AND tile_width_ft IS NULL
            AND pieces_per_box IS NULL
        )
        OR
        (
            tracking_type = 'TILE'
            AND tile_length_ft > 0
            AND tile_width_ft > 0
            AND pieces_per_box > 0
        )
    );
