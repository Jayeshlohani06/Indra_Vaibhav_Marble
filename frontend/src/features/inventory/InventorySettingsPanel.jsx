
import { useEffect, useMemo, useState } from "react";

import {
  getInventorySettings,
  saveInventorySettings,
} from "../../services/api/inventoryApi";
import { t } from "../../i18n";

const EMPTY_SETTINGS = {
  trackingType: "STANDARD",
  tileLengthFt: "",
  tileWidthFt: "",
  piecesPerBox: "",
};

function InventorySettingsPanel({ products = [] }) {
  const activeProducts = useMemo(
    () => products.filter((product) => product.active !== false),
    [products]
  );

  const [productId, setProductId] = useState("");
  const [settings, setSettings] = useState({ ...EMPTY_SETTINGS });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = activeProducts.find(
    (product) => String(product.id) === String(productId)
  );

  const isTile = settings.trackingType === "TILE";

  const tileCoverage = useMemo(() => {
    const length = Number(settings.tileLengthFt);
    const width = Number(settings.tileWidthFt);
    const pieces = Number(settings.piecesPerBox);

    if (
      !isTile ||
      !settings.tileLengthFt ||
      !settings.tileWidthFt ||
      !settings.piecesPerBox ||
      length <= 0 ||
      width <= 0 ||
      pieces <= 0
    ) {
      return null;
    }

    return length * width * pieces;
  }, [settings, isTile]);

  useEffect(() => {
    if (!productId) {
      setSettings({ ...EMPTY_SETTINGS });
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      setLoadingSettings(true);
      setError("");
      setMessage("");

      try {
        const data = await getInventorySettings(productId);

        if (cancelled) return;

        setSettings({
          trackingType: data.trackingType || "STANDARD",
          tileLengthFt: data.tileLengthFt ?? "",
          tileWidthFt: data.tileWidthFt ?? "",
          piecesPerBox: data.piecesPerBox ?? "",
        });
      } catch (err) {
        if (cancelled) return;

        // A product without saved settings can be configured here.
        // Keep other errors visible so API/authentication problems
        // are not mistaken for a successful load.
        setSettings({ ...EMPTY_SETTINGS });

        const errorText = String(err.message || "");
        if (/404|not found|no inventory setting/i.test(errorText)) {
          setMessage(t("No saved settings found. Configure this product below."));
        } else {
          setError(
            t("Could not load saved settings: {error}. You can try saving a configuration.", { error: errorText })
          );
        }
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  function handleTrackingTypeChange(event) {
    const trackingType = event.target.value;

    setSettings({
      trackingType,
      tileLengthFt: "",
      tileWidthFt: "",
      piecesPerBox: "",
    });

    setMessage("");
    setError("");
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setSettings((current) => ({
      ...current,
      [name]: value,
    }));

    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!productId) {
      setError(t("Select a product first."));
      return;
    }

    const request = {
      trackingType: settings.trackingType,
      tileLengthFt: null,
      tileWidthFt: null,
      piecesPerBox: null,
    };

    if (isTile) {
      const length = Number(settings.tileLengthFt);
      const width = Number(settings.tileWidthFt);
      const pieces = Number(settings.piecesPerBox);

      if (
        !settings.tileLengthFt ||
        !settings.tileWidthFt ||
        !settings.piecesPerBox ||
        !Number.isFinite(length) ||
        !Number.isFinite(width) ||
        !Number.isInteger(pieces) ||
        length <= 0 ||
        width <= 0 ||
        pieces <= 0
      ) {
        setError(
          t("Enter positive tile dimensions and a positive whole number of pieces per box.")
        );
        return;
      }

      request.tileLengthFt = length;
      request.tileWidthFt = width;
      request.piecesPerBox = pieces;
    }

    try {
      setSaving(true);

      const saved = await saveInventorySettings(productId, request);

      setSettings({
        trackingType: saved.trackingType || request.trackingType,
        tileLengthFt: saved.tileLengthFt ?? "",
        tileWidthFt: saved.tileWidthFt ?? "",
        piecesPerBox: saved.piecesPerBox ?? "",
      });

      setMessage(t("Inventory settings saved successfully."));
    } catch (err) {
      setError(err.message || t("Unable to save inventory settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-panel inventory-settings-panel">
      <div className="inventory-panel-heading">
        <div>
          <h2>{t("Inventory Settings & Tile Packaging")}</h2>
          <p>
            {t("Configure how each product is tracked. These settings do not change the product's existing stock quantity.")}
          </p>
        </div>
      </div>

      {message && (
        <div className="inventory-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="inventory-error" role="alert">
          {error}
        </div>
      )}

      <form className="inventory-form" onSubmit={handleSubmit}>
        <div className="inventory-form-grid">
          <label>
            {t("Product *")}
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              required
            >
              <option value="">{t("Select a product")}</option>
              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.productCode} — {product.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t("Inventory Tracking Type *")}
            <select
              value={settings.trackingType}
              onChange={handleTrackingTypeChange}
              disabled={!productId || loadingSettings || saving}
              required
            >
              <option value="STANDARD">{t("Standard Quantity")}</option>
              <option value="TILE">{t("Tiles — Boxes & Coverage")}</option>
              <option value="SLAB">{t("Individual Slabs")}</option>
              <option value="BAG">{t("Bags")}</option>
            </select>
          </label>

          {isTile && (
            <>
            <label>
              {t("Tile Length (feet) *")}
              <input
                name="tileLengthFt"
                type="number"
                min="0.001"
                step="0.001"
                value={settings.tileLengthFt}
                onChange={handleFieldChange}
                disabled={loadingSettings || saving}
                required
              />
            </label>

            <label>
              {t("Tile Width (feet) *")}
              <input
                name="tileWidthFt"
                type="number"
                min="0.001"
                step="0.001"
                value={settings.tileWidthFt}
                onChange={handleFieldChange}
                disabled={loadingSettings || saving}
                required
              />
            </label>

            <label>
              {t("Pieces per Box *")}
              <input
                name="piecesPerBox"
                type="number"
                min="1"
                step="1"
                value={settings.piecesPerBox}
                onChange={handleFieldChange}
                disabled={loadingSettings || saving}
                required
              />
            </label>
            </>
          )}
        </div>

        {isTile && (
          <div className="inventory-coverage-preview">
            <span>{t("Calculated coverage per box")}</span>
            <strong>
              {tileCoverage !== null
                ? `${tileCoverage.toFixed(3)} sq. ft.`
                : t("Enter valid tile dimensions")}
            </strong>
            <p>
              {t("Tile length × tile width × pieces per box. The calculation assumes the dimensions are in feet.")}
            </p>
          </div>
        )}

        {selectedProduct && (
          <div className="inventory-settings-stock-note">
            <strong>{t("Current stock:")}</strong>{" "}
            {Number(selectedProduct.stockQuantity ?? 0).toLocaleString(
              "en-IN"
            )}{" "}
            {selectedProduct.unitCode || selectedProduct.unit || ""}
            <p>
              {t("Saving tracking settings will not convert or overwrite this quantity.")}
            </p>
          </div>
        )}

        <div className="inventory-form-actions">
          <button
            className="inventory-primary-button"
            type="submit"
            disabled={!productId || loadingSettings || saving}
          >
            {loadingSettings
              ? t("Loading settings...")
              : saving
                ? t("Saving...")
                : t("Save Inventory Settings")}
          </button>
        </div>
      </form>
    </section>
  );
}

export default InventorySettingsPanel;
