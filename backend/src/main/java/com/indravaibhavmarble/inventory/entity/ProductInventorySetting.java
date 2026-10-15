
package com.indravaibhavmarble.inventory.entity;

import com.indravaibhavmarble.product.entity.Product;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "product_inventory_settings")
public class ProductInventorySetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, unique = true)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(name = "tracking_type", nullable = false, length = 20)
    private InventoryTrackingType trackingType;

    @Column(name = "box_coverage_sqft", precision = 12, scale = 3)
    private BigDecimal boxCoverageSqft;

    @Column(name = "tile_length_ft", precision = 10, scale = 3)
    private BigDecimal tileLengthFt;

    @Column(name = "tile_width_ft", precision = 10, scale = 3)
    private BigDecimal tileWidthFt;

    @Column(name = "pieces_per_box")
    private Integer piecesPerBox;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    public ProductInventorySetting() {
    }

    public Long getId() {
        return id;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public InventoryTrackingType getTrackingType() {
        return trackingType;
    }

    public void setTrackingType(InventoryTrackingType trackingType) {
        this.trackingType = trackingType;
    }

    public BigDecimal getBoxCoverageSqft() {
        return boxCoverageSqft;
    }

    public void setBoxCoverageSqft(BigDecimal boxCoverageSqft) {
        this.boxCoverageSqft = boxCoverageSqft;
    }

    public BigDecimal getTileLengthFt() {
        return tileLengthFt;
    }

    public void setTileLengthFt(BigDecimal tileLengthFt) {
        this.tileLengthFt = tileLengthFt;
    }

    public BigDecimal getTileWidthFt() {
        return tileWidthFt;
    }

    public void setTileWidthFt(BigDecimal tileWidthFt) {
        this.tileWidthFt = tileWidthFt;
    }

    public Integer getPiecesPerBox() {
        return piecesPerBox;
    }

    public void setPiecesPerBox(Integer piecesPerBox) {
        this.piecesPerBox = piecesPerBox;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
