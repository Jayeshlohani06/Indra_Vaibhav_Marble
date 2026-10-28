import hi from "./hi";

// English is written in the code; Hindi comes from the dictionary in ./hi,
// keyed by the exact English text. Anything not yet translated stays English.
//
//   t("Open the day")                      -> "दिन शुरू करें"
//   t("Close {date}?", { date: "28 Oct" }) -> "28 Oct बंद करें?"

const STORAGE_KEY = "app-language";
export const LANGUAGES = { en: "English", hi: "हिंदी" };

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

let current = readStoredLanguage();
if (typeof document !== "undefined") document.documentElement.lang = current;

export function getLanguage() {
  return current;
}

// Remembered on this device only; each person picks their own language.
export function setLanguage(language) {
  current = language === "hi" ? "hi" : "en";
  try { localStorage.setItem(STORAGE_KEY, current); } catch { /* remembering is optional */ }
  if (typeof document !== "undefined") document.documentElement.lang = current;
}

export function t(text, vars) {
  if (text === null || text === undefined) return text;
  let out = current === "hi" && Object.prototype.hasOwnProperty.call(hi, text) ? hi[text] : text;
  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])));
  }
  return out;
}
