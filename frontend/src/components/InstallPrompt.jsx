import { useEffect, useState } from "react";
import { t } from "../i18n";
import "./InstallPrompt.css";

// Offers to put the app on the phone's home screen. Android/Chrome gives us a
// one-tap install; iPhone has no such button, so we show where to tap instead.

const DISMISSED_KEY = "install-prompt-dismissed";

// Chrome can fire this before React has drawn anything, so catch it early.
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    listeners.forEach((notify) => notify());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((notify) => notify());
  });
}

function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  // Other iPhone browsers cannot add to the home screen as an app.
  return ios && !/crios|fxios|edgios/i.test(ua);
}

function wasDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === "yes"; } catch { return false; }
}

function InstallPrompt() {
  const [canInstall, setCanInstall] = useState(Boolean(deferredPrompt));
  const [hidden, setHidden] = useState(() => isInstalled() || wasDismissed());

  useEffect(() => {
    const notify = () => setCanInstall(Boolean(deferredPrompt));
    listeners.add(notify);
    return () => listeners.delete(notify);
  }, []);

  const showIosHint = !canInstall && isIosSafari();
  if (hidden || (!canInstall && !showIosHint)) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "yes"); } catch { /* shows again next time */ }
    setHidden(true);
  }

  async function install() {
    const prompt = deferredPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    if (outcome === "accepted") setHidden(true);
  }

  return (
    <div className="install-prompt" role="region" aria-label={t("Install app")}>
      <img className="install-prompt__icon" src="/pwa-64x64.png" alt="" width="40" height="40" />
      <div className="install-prompt__text">
        <strong>{t("Install the app on this phone")}</strong>
        <span>
          {showIosHint
            ? t("Tap Share, then “Add to Home Screen”.")
            : t("Opens from your home screen, full screen, like any app.")}
        </span>
      </div>
      {!showIosHint && (
        <button type="button" className="install-prompt__install" onClick={install}>
          {t("Install")}
        </button>
      )}
      <button
        type="button"
        className="install-prompt__close"
        onClick={dismiss}
        aria-label={t("Not now")}
        title={t("Not now")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}

export default InstallPrompt;
