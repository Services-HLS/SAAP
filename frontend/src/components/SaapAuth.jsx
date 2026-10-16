import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DISTRICTS } from "../data/content";
import { usePlatform } from "../context";

function makeCaptcha() {
  const a = 10 + Math.floor(Math.random() * 40);
  const b = 1 + Math.floor(Math.random() * 9);
  return { a, b, answer: a - b, label: `${a} - ${b} = ?` };
}

export function SaapLoginCard({
  defaultUsername = "student",
  defaultPassword = "demo123",
  onLocalLogin,
  onApiLogin,
}) {
  const navigate = useNavigate();
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState(defaultPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState(() => makeCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetMobile, setResetMobile] = useState("");
  const [resetNote, setResetNote] = useState("");

  const captchaOk = Number(captchaInput) === captcha.answer;

  function fillDemo(user, pass) {
    setUsername(user);
    setPassword(pass);
    setError("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!captchaOk) {
      setError("Enter the correct captcha result to continue.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem("saap-portal", JSON.stringify({ token: data.token, role: data.role, name: data.name }));
        if (onApiLogin) {
          await onApiLogin(data);
          return;
        }
        navigate("/platform");
        return;
      }
      if (onLocalLogin) {
        await onLocalLogin(username, password);
        navigate("/dashboard");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(typeof data.detail === "string" ? data.detail : "Invalid username or password.");
      setCaptcha(makeCaptcha());
      setCaptchaInput("");
    } catch (err) {
      if (onLocalLogin) {
        try {
          await onLocalLogin(username, password);
          navigate("/dashboard");
          return;
        } catch (localErr) {
          setError(localErr.message || "Sign-in failed.");
        }
      } else {
        setError(err.message || "Sign-in failed.");
      }
      setCaptcha(makeCaptcha());
      setCaptchaInput("");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e) {
    e.preventDefault();
    setResetNote("");
    if (!/^\d{10}$/.test(resetMobile)) {
      setResetNote("Enter a 10-digit mobile number.");
      return;
    }
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetMobile, channel: "mobile" }),
      });
      const data = await res.json();
      setResetNote(data.sandbox_otp
        ? `Demonstration code ${data.sandbox_otp}. No SMS provider is connected. Use Sign in with your known password.`
        : "If this number is registered, a reset code would be sent. This demo does not change passwords.");
    } catch {
      setResetNote("The registration service is offline. Use the demo passwords shown below.");
    }
  }

  if (forgot) {
    return (
      <div className="saap-login-card">
        <h2>Forgot password</h2>
        <p className="muted">Enter the mobile number linked to your account. This demo shows a sandbox code only.</p>
        <form className="saap-login-form" onSubmit={sendReset}>
          <label>
            Mobile number
            <input value={resetMobile} onChange={(e) => setResetMobile(e.target.value)} placeholder="10-digit mobile" pattern="[0-9]{10}" required />
          </label>
          {resetNote && <p className="ok">{resetNote}</p>}
          <button className="saap-login-btn" type="submit">Get OTP</button>
          <button className="saap-link-btn" type="button" onClick={() => setForgot(false)}>Return to login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="saap-login-card">
      <h2>Login</h2>
      <form className="saap-login-form" onSubmit={onSubmit}>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" required />
        </label>
        <label>
          Password
          <span className="saap-password-wrap">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button type="button" className="saap-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        <div className="saap-captcha">
          <strong>{captcha.label}</strong>
          <button type="button" className="saap-captcha-refresh" onClick={() => { setCaptcha(makeCaptcha()); setCaptchaInput(""); }} aria-label="Refresh captcha">↻</button>
          <input value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} placeholder="Enter the result here" required />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="saap-login-btn" type="submit" disabled={busy || !captchaOk}>{busy ? "Signing in…" : "Log in"}</button>
        <button className="saap-forgot" type="button" onClick={() => setForgot(true)}>Forgot password</button>
      </form>
      <p className="saap-login-hint muted">New player? <Link to="/register?type=player">Player registration</Link></p>
      <div className="saap-demo-box" aria-label="Demo credentials">
        <strong>Demo credentials</strong>
        <ul>
          <li>
            <button type="button" onClick={() => fillDemo("student", "demo123")}>Use</button>
            <span><b>Player</b> — student / demo123</span>
          </li>
          <li>
            <button type="button" onClick={() => fillDemo("admin", "demo123")}>Use</button>
            <span><b>Admin</b> — admin / demo123</span>
          </li>
          <li>
            <button type="button" onClick={() => fillDemo("officer", "saap123")}>Use</button>
            <span><b>Portal desk</b> — officer / saap123</span>
          </li>
        </ul>
        <p>Other roles: department, operator, accountant, auditor — password <b>demo123</b></p>
      </div>
    </div>
  );
}

export function PlayerRegistrationWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("otp");
  const [aadhaarSent, setAadhaarSent] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [sandboxAadhaarOtp, setSandboxAadhaarOtp] = useState("");
  const [aadhaarReferenceId, setAadhaarReferenceId] = useState("");
  const [kycToken, setKycToken] = useState("");
  const [kycProvider, setKycProvider] = useState("");
  const [mobileSandboxOtp, setMobileSandboxOtp] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    aadhaar: "",
    phone: "",
    otp: "",
    full_name: "",
    username: "",
    password: "",
    email: "",
    dob: "2014-06-01",
    gender: "Female",
    district: "Krishna",
    bank_name: "",
    bank_last4: "",
  });

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function digitsOnly(value, max) {
    return value.replace(/\D/g, "").slice(0, max);
  }

  function selectMethod(next) {
    setMethod(next);
    setError("");
    setNotice("");
    setAadhaarSent(false);
    setAadhaarOtp("");
    setSandboxAadhaarOtp("");
    setAadhaarReferenceId("");
    setKycToken("");
    setKycProvider("");
  }

  async function sendAadhaarOtp() {
    setError("");
    setNotice("");
    if (!/^\d{12}$/.test(form.aadhaar)) {
      setError("Enter a valid 12-digit Aadhaar number.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/kyc/aadhaar/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aadhaar_number: form.aadhaar,
          consent: "Y",
          reason: "KYC verification",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Could not send Aadhaar OTP.");
        return;
      }
      setAadhaarReferenceId(data.reference_id != null ? String(data.reference_id) : "");
      setKycProvider(data.provider || "");
      setSandboxAadhaarOtp(data.sandbox_otp || "");
      if (data.sandbox_otp) setAadhaarOtp(data.sandbox_otp);
      setAadhaarSent(true);
      setNotice(data.notice || "OTP sent to the mobile linked with Aadhaar.");
    } catch {
      setError("The registration service is offline.");
    } finally {
      setBusy(false);
    }
  }

  function captureBiometric() {
    setError("");
    setNotice("");
    if (!/^\d{12}$/.test(form.aadhaar)) {
      setError("Enter a valid 12-digit Aadhaar number.");
      return;
    }
    setAadhaarVerified(true);
    setKycToken("");
    setStep(2);
    setNotice("Bio-Metric capture successful (demo only). Continue with your player profile.");
  }

  async function confirmAadhaarOtp() {
    setError("");
    if (!aadhaarReferenceId) {
      setError("Request an Aadhaar OTP first.");
      return;
    }
    if (!/^\d{6}$/.test(aadhaarOtp)) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/kyc/aadhaar/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_id: String(aadhaarReferenceId),
          otp: String(aadhaarOtp),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((item) => item.msg || JSON.stringify(item)).join(" ")
            : "Aadhaar OTP verification failed.";
        setError(detail);
        return;
      }
      setKycToken(data.kyc_token || "");
      setKycProvider(data.provider || kycProvider);
      setAadhaarVerified(true);
      if (data.name) set("full_name", data.name);
      if (data.dob) set("dob", data.dob);
      if (data.gender) set("gender", data.gender);
      setNotice(data.notice || "Aadhaar verified. Complete your player profile.");
      setStep(2);
    } catch {
      setError("The registration service is offline.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMobileOtp() {
    setError("");
    setNotice("");
    if (!/^\d{10}$/.test(form.phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, channel: "mobile" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Could not send the code.");
        return;
      }
      setMobileSandboxOtp(data.sandbox_otp || "");
      if (data.sandbox_otp) set("otp", data.sandbox_otp);
      setNotice("Mobile OTP sent. This demo shows the code because no SMS provider is connected.");
    } catch {
      setError("The registration service is offline.");
    }
  }

  async function createAccount() {
    setError("");
    setNotice("");
    if (!aadhaarVerified) {
      setError("Complete Aadhaar verification first.");
      return;
    }
    if (!form.full_name || !form.username || form.password.length < 6) {
      setError("Complete name, username, and a password of at least 6 characters.");
      return;
    }
    if (!/^\d{10}$/.test(form.phone) || !/^\d{6}$/.test(form.otp)) {
      setError("Enter mobile number and the 6-digit mobile OTP.");
      return;
    }
    if (!form.bank_name || !/^\d{4}$/.test(form.bank_last4)) {
      setError("Enter bank name and account last 4 digits.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          username: form.username,
          password: form.password,
          phone: form.phone,
          email: form.email,
          otp: form.otp,
          district: form.district,
          dob: form.dob,
          gender: form.gender,
          aadhaar_last4: form.aadhaar.slice(-4),
          bank_name: form.bank_name,
          bank_last4: form.bank_last4,
          kyc_token: kycToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : "Registration failed.");
        return;
      }
      sessionStorage.setItem("saap-portal", JSON.stringify({ token: data.token, role: data.role, name: data.name }));
      setNotice(
        data.aadhaar_verified
          ? `Registration ${data.reference_no} saved with Aadhaar verified.`
          : `Registration ${data.reference_no} saved.`,
      );
      navigate("/platform");
    } catch {
      setError("The registration service is offline.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="player-reg">
      <aside className="player-reg-art" aria-hidden="true">
        <img src="/SportsInIndia.png?v=1" alt="" />
      </aside>

      <div className="player-reg-side">
        <ol className="player-reg-steps" aria-label="Registration steps">
          <li className={step === 1 ? "is-on" : aadhaarVerified ? "is-done" : ""}>
            <span>1</span>
            <em>STEP 1</em>
          </li>
          <li className={step === 2 ? "is-on" : ""}>
            <span>2</span>
            <em>STEP 2</em>
          </li>
        </ol>

        <div className="player-reg-card">
          <div className="player-reg-brand">
            <img src="/saap-logo.png" alt="Sports Authority of Andhra Pradesh" />
            <span>Government of Andhra Pradesh</span>
          </div>

          <h2>Player Registration</h2>

          {notice && <p className="ok">{notice}</p>}
          {error && <p className="error" role="alert">{error}</p>}

          {step === 1 && (
            <div className="player-reg-form">
              <div className="player-reg-methods" role="radiogroup" aria-label="Verification method">
                <label className={method === "otp" ? "is-on" : ""}>
                  <input type="radio" name="verify-method" checked={method === "otp"} onChange={() => selectMethod("otp")} />
                  OTP
                </label>
                <label className={method === "biometric" ? "is-on" : ""}>
                  <input type="radio" name="verify-method" checked={method === "biometric"} onChange={() => selectMethod("biometric")} />
                  Bio-Metric
                </label>
              </div>

              <label className="player-reg-field">
                <span>Aadhaar number</span>
                <input
                  value={form.aadhaar}
                  onChange={(e) => set("aadhaar", digitsOnly(e.target.value, 12))}
                  placeholder="Aadhaar no"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={12}
                />
              </label>

              {method === "biometric" ? (
                <button className="player-reg-send" type="button" onClick={captureBiometric} disabled={busy}>
                  <i className="fa-solid fa-fingerprint" aria-hidden="true" />
                  Capture
                </button>
              ) : !aadhaarSent ? (
                <button className="player-reg-send" type="button" onClick={sendAadhaarOtp} disabled={busy}>
                  <i className="fa-solid fa-mobile-screen-button" aria-hidden="true" />
                  {busy ? "Sending…" : "Send otp"}
                </button>
              ) : (
                <>
                  <label className="player-reg-field">
                    <span>Enter OTP</span>
                    <input
                      value={aadhaarOtp}
                      onChange={(e) => setAadhaarOtp(digitsOnly(e.target.value, 6))}
                      placeholder="6-digit OTP"
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </label>
                  {sandboxAadhaarOtp && (
                    <p className="muted player-reg-demo">Demonstration OTP: {sandboxAadhaarOtp}</p>
                  )}
                  {aadhaarReferenceId && (
                    <p className="muted player-reg-demo">
                      Ref {aadhaarReferenceId}
                      {kycProvider ? ` · ${kycProvider}` : ""}
                    </p>
                  )}
                  <div className="player-reg-actions">
                    <button className="btn ghost" type="button" onClick={sendAadhaarOtp} disabled={busy}>Resend OTP</button>
                    <button className="player-reg-send" type="button" onClick={confirmAadhaarOtp} disabled={busy}>
                      {busy ? "Verifying…" : "Verify OTP"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="player-reg-form">
              <div className="player-reg-grid">
                <label className="player-reg-field">
                  <span>Full name</span>
                  <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
                </label>
                <label className="player-reg-field">
                  <span>Username</span>
                  <input value={form.username} onChange={(e) => set("username", e.target.value)} />
                </label>
                <label className="player-reg-field">
                  <span>Password</span>
                  <input type="password" minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} />
                </label>
                <label className="player-reg-field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </label>
                <label className="player-reg-field">
                  <span>Mobile number</span>
                  <input value={form.phone} onChange={(e) => set("phone", digitsOnly(e.target.value, 10))} placeholder="10-digit mobile" inputMode="numeric" />
                </label>
                <label className="player-reg-field">
                  <span>Date of birth</span>
                  <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
                </label>
                <label className="player-reg-field">
                  <span>Gender</span>
                  <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="player-reg-field">
                  <span>District</span>
                  <select value={form.district} onChange={(e) => set("district", e.target.value)}>
                    {DISTRICTS.map((district) => <option key={district}>{district}</option>)}
                  </select>
                </label>
                <label className="player-reg-field">
                  <span>Bank name</span>
                  <input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
                </label>
                <label className="player-reg-field">
                  <span>Account last 4</span>
                  <input value={form.bank_last4} onChange={(e) => set("bank_last4", digitsOnly(e.target.value, 4))} inputMode="numeric" maxLength={4} />
                </label>
              </div>

              <div className="player-reg-actions">
                <button className="btn ghost" type="button" onClick={sendMobileOtp}>Get mobile OTP</button>
              </div>
              <label className="player-reg-field">
                <span>Mobile OTP</span>
                <input value={form.otp} onChange={(e) => set("otp", digitsOnly(e.target.value, 6))} placeholder="6-digit OTP" inputMode="numeric" maxLength={6} />
              </label>
              {mobileSandboxOtp && <p className="muted player-reg-demo">Demonstration OTP: {mobileSandboxOtp}</p>}
              <p className="muted player-reg-demo">
                Aadhaar ending ****{form.aadhaar.slice(-4)} verified
                {kycProvider ? ` via ${kycProvider}` : ""}
              </p>

              <div className="player-reg-actions">
                <button className="btn ghost" type="button" onClick={() => { setStep(1); setNotice(""); setError(""); }}>Back</button>
                <button className="player-reg-send" type="button" disabled={busy} onClick={createAccount}>
                  {busy ? "Saving…" : "Create registration"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SaapAuthShell({ children, title = "Login" }) {
  return (
    <section className="saap-auth-shell">
      <div className="saap-auth-brand">
        <img src="/saap-logo.png" alt="Sports Authority of Andhra Pradesh" className="saap-auth-logo" />
        <span>Government of Andhra Pradesh</span>
      </div>
      <div className="saap-auth-stage" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

export function useLocalPortalLogin() {
  const { login } = usePlatform();
  return login;
}
