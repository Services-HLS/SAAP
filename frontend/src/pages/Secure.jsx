import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { SaapAuthShell, SaapLoginCard } from "../components/SaapAuth";
import { usePlatform } from "../context";
import { ROLES } from "../lib/platform";

function Hero({ kicker, title, text }) {
  return (
    <header className="page-hero">
      <div className="wrap">
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
        {text && <p className="lede">{text}</p>}
      </div>
    </header>
  );
}

function Need({ allow, children }) {
  const { user } = usePlatform();
  if (!user) return <Navigate to="/login" replace />;
  if (!allow.includes(user.role)) {
    return (
      <section className="wrap prose">
        <h1>This desk is limited to {allow.map((r) => ROLES[r]).join(" and ")}.</h1>
        <p>You are signed in as {ROLES[user.role]}. Sign in with another role if this task is yours.</p>
      </section>
    );
  }
  return children;
}

export function Login() {
  const { login, user } = usePlatform();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <Hero
        kicker="SAAP login"
        title="Sign in with your username and password."
        text="Player demo opens the player desk. Admin demo opens the admin desk. Same captcha pattern as sports.ap.gov.in."
      />
      <section className="wrap login-demo-wrap">
        <SaapAuthShell title="Login">
          <SaapLoginCard
            defaultUsername="student"
            defaultPassword="demo123"
            onLocalLogin={login}
          />
        </SaapAuthShell>
      </section>
    </>
  );
}

export function Dashboard() {
  const { user, state, decideApplication } = usePlatform();
  const [reason, setReason] = useState("Verified against the district list");
  if (!user) return <Navigate to="/login" replace />;
  const mine = state.applications.filter((a) => a.createdBy === user.username || a.name === user.name);
  const pending = state.applications.filter((a) => a.status === "pending");
  const myAudit = state.audit.filter((a) => a.actor === user.name).slice(0, 6);
  const canDecide = user.role === "officer" || user.role === "admin";

  return (
    <>
      <Hero kicker={ROLES[user.role]} title={`Welcome, ${user.name}.`} text={`${user.district} · ${user.phone}`} />
      <section className="wrap dash-grid">
        <article className="panel-card">
          <h2>{canDecide ? "Waiting for a decision" : "Your requests"}</h2>
          <ul className="queue">
            {(canDecide ? pending : mine).map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.type} · {item.sport} · {item.district}</span>
                  <em>{item.status}</em>
                </div>
                {canDecide && item.status === "pending" && (
                  <div className="decide">
                    <button type="button" className="btn primary" onClick={() => decideApplication(item.id, "approved", reason)}>Approve</button>
                    <button type="button" className="btn ghost" onClick={() => decideApplication(item.id, "returned", reason)}>Return</button>
                  </div>
                )}
                {item.certificateId && <Link to={`/certificates/${item.certificateId}`}>Certificate {item.certificateId}</Link>}
              </li>
            ))}
            {(canDecide ? pending : mine).length === 0 && <li>Nothing in this queue.</li>}
          </ul>
          {canDecide && (
            <label className="reason">Decision note
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          )}
        </article>
        <article className="panel-card">
          <h2>Recent actions</h2>
          <ul className="audit-mini">
            {myAudit.map((a) => (
              <li key={a.id}><strong>{a.action}</strong><span>{a.detail}</span></li>
            ))}
          </ul>
          <div className="cta-row">
            {(user.role === "officer" || user.role === "admin") && <Link to="/audit">Full audit</Link>}
            <Link to="/ledger">Ledger</Link>
            {(user.role === "officer" || user.role === "admin") && <Link to="/desk">WhatsApp desk</Link>}
          </div>
        </article>
      </section>
    </>
  );
}

export function Audit() {
  const { state, user } = usePlatform();
  const [q, setQ] = useState("");
  const rows = state.audit.filter((a) => `${a.action} ${a.detail} ${a.actor}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Need allow={["officer", "admin"]}>
      <Hero kicker="Audit trail" title="Every sign-in, filing, decision, certificate, and WhatsApp notice." text={user ? `Reading as ${user.name}.` : ""} />
      <section className="wrap">
        <input className="filter" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by person, action, or detail" aria-label="Filter audit" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Person</th><th>Role</th><th>Action</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.time).toLocaleString()}</td>
                  <td>{a.actor}</td>
                  <td>{a.role}</td>
                  <td>{a.action}</td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Need>
  );
}

export function Ledger() {
  const { state, verifyChain, verifyCertificateRecord, anchorNote, user, resetDemo } = usePlatform();
  const [params] = useSearchParams();
  const [check, setCheck] = useState(null);
  const [id, setId] = useState(params.get("id") || "SAAP-CAMP-2026-0142");
  const [found, setFound] = useState(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    verifyChain().then(setCheck);
  }, [state.chain.length, verifyChain]);

  async function lookup(e) {
    e.preventDefault();
    const result = await verifyCertificateRecord(id);
    setFound(result.cert || null);
    setMsg(result.reason);
  }

  return (
    <>
      <Hero kicker="SAAP ledger" title="A hash chain for filings, decisions, certificates, and WhatsApp notices." text="Each block stores the previous fingerprint. Edit an old record and verification fails. This chain lives in the browser for this portal. It is the record design, not a government mainnet." />
      <section className="wrap ledger-tools">
        <p className={check?.ok ? "ok" : "error"}>{check ? (check.ok ? `Chain intact · ${check.length} blocks` : check.issues.join(" ")) : "Checking…"}</p>
        <form className="form inline" onSubmit={lookup}>
          <label>Certificate ID<input value={id} onChange={(e) => setId(e.target.value)} /></label>
          <button className="btn primary" type="submit">Verify</button>
        </form>
        {msg && <p>{msg} {found && <Link to={`/certificates/${found.id}`}>Open certificate</Link>}</p>}
        {user?.role === "admin" && (
          <form className="form inline" onSubmit={async (e) => { e.preventDefault(); await anchorNote(note); setNote(""); }}>
            <label>Admin note<input value={note} onChange={(e) => setNote(e.target.value)} required /></label>
            <button className="btn ghost" type="submit">Anchor</button>
            <button className="btn ghost" type="button" onClick={() => { if (window.confirm("Reset the portal demo data stored in this browser? Applications, messages, and ledger notes on this device will be replaced with the original sample.")) resetDemo(); }}>Reset demo data</button>
          </form>
        )}
      </section>
      <section className="wrap chain">
        {[...state.chain].reverse().map((block) => (
          <article key={block.hash}>
            <header><span>Block {block.index}</span><strong>{block.action}</strong></header>
            <p>{block.actor} · {new Date(block.time).toLocaleString()}</p>
            <pre>{JSON.stringify(block.payload, null, 2)}</pre>
            <p className="hash">prev {block.prev.slice(0, 18)}…</p>
            <p className="hash">hash {block.hash}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function Desk() {
  const { state, sendWhatsApp } = usePlatform();
  const [to, setTo] = useState(state.applications[0]?.phone || "");
  const [name, setName] = useState(state.applications[0]?.name || "");
  const [body, setBody] = useState("SAAP: your application has been updated. Open the portal dashboard for the certificate ID.");
  const [note, setNote] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    const result = await sendWhatsApp({ to, name, body, relatedId: "desk" });
    const opened = window.open(result.url, "_blank", "noopener");
    setNote(opened
      ? "Recorded on this browser’s ledger and audit trail. WhatsApp opened in a new tab. This build does not confirm delivery."
      : "Recorded on this browser’s ledger and audit trail. The WhatsApp window was blocked, so the message was not handed to WhatsApp.");
  }

  return (
    <Need allow={["officer", "admin"]}>
      <Hero kicker="WhatsApp desk" title="Send a notice the audit trail will remember." text="The message is stored on this browser’s ledger, then WhatsApp opens. This build does not confirm that a provider delivered it." />
      <section className="wrap service-layout">
        <form className="form" onSubmit={onSubmit}>
          <label>Applicant
            <select value={name} onChange={(e) => {
              const app = state.applications.find((a) => a.name === e.target.value);
              setName(e.target.value);
              if (app) setTo(app.phone);
            }}>
              {state.applications.map((a) => <option key={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label>Mobile<input value={to} onChange={(e) => setTo(e.target.value)} required /></label>
          <label>Message<textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <button className="btn primary" type="submit">Send and log</button>
          {note && <p className="ok">{note}</p>}
        </form>
        <article className="panel-card">
          <h2>Recent notices</h2>
          <ul className="audit-mini">
            {state.messages.slice(0, 6).map((m) => (
              <li key={m.id}><strong>{m.name || m.to}</strong><span>{m.body}</span></li>
            ))}
            {state.messages.length === 0 && <li>No notices yet.</li>}
          </ul>
        </article>
      </section>
    </Need>
  );
}
