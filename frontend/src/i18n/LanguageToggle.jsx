import { getLanguage } from "./index";
import "./LanguageToggle.css";

// Switches between English and Hindi. The parent keeps the language in state
// so the whole screen redraws in the new language.
function LanguageToggle({ onChange, className = "" }) {
  const next = getLanguage() === "hi" ? "en" : "hi";
  return (
    <button
      type="button"
      className={`language-toggle ${className}`}
      onClick={() => onChange(next)}
      lang={next}
      aria-label={next === "hi" ? "हिंदी में देखें" : "Switch to English"}
    >
      {next === "hi" ? "हिंदी" : "English"}
    </button>
  );
}

export default LanguageToggle;
