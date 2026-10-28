// Light or dark look, remembered on this device only. Light is the default so
// the app looks the same as before until someone switches.
//
// Every colour in the stylesheets is written as light-dark(light, dark); the
// browser picks one from the color-scheme set here on <html>.

const STORAGE_KEY = "app-theme";
const THEME_COLORS = { light: "#2b251e", dark: "#14120f" };

function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function apply(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

let current = readStoredTheme();
apply(current);

export function getTheme() {
  return current;
}

export function setTheme(theme) {
  current = theme === "dark" ? "dark" : "light";
  try { localStorage.setItem(STORAGE_KEY, current); } catch { /* remembering is optional */ }
  apply(current);
}
