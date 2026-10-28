import { useState } from "react";
import { login } from "../../services/api/authApi";
import "./LoginPage.css";
import { t } from "../../i18n";
import LanguageToggle from "../../i18n/LanguageToggle";
import ThemeToggle from "../../components/ThemeToggle";

// Line icons for the panel, drawn on a 24px grid like the sidebar icons.
const HIGHLIGHTS = [
  {
    icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
    text: "Make bills and print invoices",
  },
  {
    icon: "M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5",
    text: "Keep track of stock and purchases",
  },
  {
    icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2",
    text: "See who owes you, and whom you owe",
  },
];

function LoginPage({ onLoginSuccess, onLanguageChange, theme, onThemeChange }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(identifier.trim(), password);
      setPassword("");
      onLoginSuccess(response);
    } catch (err) {
      setError(err.message || t("Unable to sign in. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  function checkCapsLock(event) {
    setCapsLockOn(event.getModifierState?.("CapsLock") === true);
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-panel" aria-label="Indra Vaibhav Marble">
          <div className="login-brand">
            <div className="login-mark" aria-hidden="true">IV</div>
            <div>
              <p className="login-brand-name">Indra Vaibhav Marble</p>
              <p className="login-brand-tagline">{t("Selling quality marble since 2006")}</p>
            </div>
          </div>

          <div className="login-panel-body">
            <h1>{t("Your shop, in one place.")}</h1>
            <ul className="login-highlights">
              {HIGHLIGHTS.map((item) => (
                <li key={item.text}>
                  <span className="login-highlight-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d={item.icon} /></svg>
                  </span>
                  {t(item.text)}
                </li>
              ))}
            </ul>
          </div>

          <p className="login-panel-footer">Bodhgaya, Gaya, Bihar</p>
        </section>

        <section className="login-card">
          <div className="login-toggles">
            {onThemeChange && <ThemeToggle theme={theme} onChange={onThemeChange} />}
            {onLanguageChange && <LanguageToggle onChange={onLanguageChange} />}
          </div>
          <div className="login-card-heading">
            <div className="login-phone-brand">
              <div className="login-mark" aria-hidden="true">IV</div>
              <span>Indra Vaibhav Marble</span>
            </div>
            <h2>{t("Welcome back")}</h2>
            <p>{t("Sign in with the mobile number or email and the password your shop admin gave you.")}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-identifier">{t("Mobile number or email")}</label>
              <input
                id="login-identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                placeholder={t("e.g. 9876543210 or name@example.com")}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">{t("Password")}</label>
              <div className="login-password">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={checkCapsLock}
                  onKeyUp={checkCapsLock}
                  onBlur={() => setCapsLockOn(false)}
                  aria-describedby={capsLockOn ? "caps-lock-warning" : undefined}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-pressed={showPassword}
                >
                  {showPassword ? t("Hide") : t("Show")}
                </button>
              </div>
              {capsLockOn && (
                <p className="login-hint login-hint--warning" id="caps-lock-warning">
                  {t("Caps Lock is on")}
                </p>
              )}
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? t("Signing in…") : t("Sign in")}
            </button>
          </form>

          <p className="login-help">
            {t("Forgot your password? Ask your shop admin to set a new one from the Users page.")}
          </p>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
