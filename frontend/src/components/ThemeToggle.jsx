import { t } from "../i18n";
import "./ThemeToggle.css";

// Switches between the light and dark look. The parent keeps the theme in
// state so the icon updates; the colours change through CSS alone.
function ThemeToggle({ theme, onChange, className = "" }) {
  const dark = theme === "dark";
  const text = dark ? t("Switch to light mode") : t("Switch to dark mode");
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => onChange(dark ? "light" : "dark")}
      aria-label={text}
      title={text}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z" />
        </svg>
      )}
    </button>
  );
}

export default ThemeToggle;
