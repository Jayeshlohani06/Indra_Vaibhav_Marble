
import { useState } from "react";
import { login } from "../../services/api/authApi";
import "./LoginPage.css";

function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login(email.trim(), password);
      setPassword("");
      onLoginSuccess(response);
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-showcase" aria-label="Indra Vaibhav Marble">
          <div className="login-showcase-glow" />
          <div className="login-showcase-content">
            <div className="login-logo">
              <span>IV</span>
              <i />
            </div>
            <p className="login-eyebrow">INDRA VAIBHAV MARBLE</p>
            <h1>Shape your business<br /><em>with confidence.</em></h1>
            <p className="login-showcase-copy">
              One elegant workspace for inventory, billing, customers, and every
              detail that keeps your business moving.
            </p>
            <div className="login-showcase-points">
              <span><b>✓</b> Real-time business overview</span>
              <span><b>✓</b> Secure role-based access</span>
              <span><b>✓</b> Smarter inventory control</span>
            </div>
          </div>
          <div className="login-stone-shape login-stone-shape-one" />
          <div className="login-stone-shape login-stone-shape-two" />
          <div className="login-showcase-footer">EST. 2006 <span /> BUILT FOR BETTER BUSINESS</div>
        </section>

        <section className="login-card">
          <div className="login-brand">
            <div className="login-mobile-mark">IV</div>
            <p className="login-welcome">WELCOME BACK</p>
            <h2>Sign in to your workspace</h2>
            <p className="login-subtitle">
              Enter your details to continue to your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="email">Email address</label>
            <div className="login-input-wrap">
              <span className="login-input-icon" aria-hidden="true">@</span>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="login-label-row">
              <label htmlFor="password">Password</label>
            </div>
            <div className="login-input-wrap">
              <span className="login-input-icon login-lock-icon" aria-hidden="true">●</span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <p className="login-error" role="alert">
                <span aria-hidden="true">!</span>{error}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              <span>{loading ? "Signing in..." : "Sign in securely"}</span>
              {!loading && <span className="login-submit-arrow" aria-hidden="true">→</span>}
            </button>
          </form>

          <div className="login-security-note">
            <span className="login-shield" aria-hidden="true">✓</span>
            <span><strong>Your information is protected</strong><small>Secure, role-based access to your business data.</small></span>
          </div>

          <p className="login-footer">© 2006 Indra Vaibhav Marble <span>•</span> Business management, refined.</p>
        </section>
      </div>
    </main>
  );
}

export default LoginPage;
