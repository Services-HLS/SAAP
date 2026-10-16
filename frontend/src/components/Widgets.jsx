import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { OFFICE } from "../data/content";
import {
  answerQuestion,
  readPortalSession,
  roleLabel,
  suggestionsForRole,
  welcomeForRole,
} from "../lib/agent";
import { usePlatform } from "../context";

const WA_CONSENT_KEY = "saap-wa-updates-consent";

export default function Widgets() {
  const [openPanel, setOpenPanel] = useState(null);
  return (
    <>
      <ChatWidget
        open={openPanel === "agent"}
        hidden={openPanel === "wa"}
        onToggle={() => setOpenPanel((v) => (v === "agent" ? null : "agent"))}
        onClose={() => setOpenPanel(null)}
      />
      <WhatsAppButton
        open={openPanel === "wa"}
        hidden={openPanel === "agent"}
        onToggle={() => setOpenPanel((v) => (v === "wa" ? null : "wa"))}
        onClose={() => setOpenPanel(null)}
      />
    </>
  );
}

function useAgentSession() {
  const { user } = usePlatform();
  const [portal, setPortal] = useState(() => readPortalSession());

  useEffect(() => {
    const sync = () => setPortal(readPortalSession());
    sync();
    window.addEventListener("storage", sync);
    const id = window.setInterval(sync, 2000);
    return () => {
      window.removeEventListener("storage", sync);
      window.clearInterval(id);
    };
  }, []);

  return useMemo(() => {
    if (portal?.token && portal?.role) {
      return { token: portal.token, role: portal.role, name: portal.name || "" };
    }
    if (user) {
      return { token: "", role: user.role, name: user.name || "" };
    }
    return null;
  }, [portal, user]);
}

function ChatWidget({ open, hidden, onToggle, onClose }) {
  const session = useAgentSession();
  const role = session?.role || null;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState(() => [
    { from: "agent", text: welcomeForRole(null) },
  ]);
  const navigate = useNavigate();
  const chips = suggestionsForRole(role);

  useEffect(() => {
    setThread([{ from: "agent", text: welcomeForRole(role, session?.name) }]);
    setText("");
  }, [role, session?.name]);

  async function ask(raw) {
    const value = raw.trim();
    if (!value || busy) return;
    setBusy(true);
    setThread((t) => [...t, { from: "you", text: value }]);
    setText("");

    let result = answerQuestion(value, session);
    try {
      const headers = { "Content-Type": "application/json" };
      if (session?.token) headers.Authorization = `Bearer ${session.token}`;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ question: value, role_hint: role || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.source && data.source !== "faq") {
          result = {
            reply: `${data.answer}${data.source === "account-records" || data.source === "role-permissions" ? "" : " (registration-service rules — not an external AI.)"}`,
            links: result.links,
          };
        }
      }
    } catch {
      /* local guide still answers offline */
    }

    setThread((t) => [...t, { from: "agent", text: result.reply, links: result.links }]);
    setBusy(false);
  }

  const started = thread.some((m) => m.from === "you");

  return (
    <div className={`saap-dock saap-chat-dock${open ? " is-open" : ""}${hidden ? " is-hidden" : ""}`}>
      {open && (
        <section className="saap-panel saap-panel-agent saap-glass" aria-label="AI BI conversational agent">
          <header className="saap-panel-head">
            <strong className="agent-title">
              <img src="/AI_BI_LOGO.gif" alt="AI BI agent" className="agent-logo" />
              <span>
                AI BI agent
                <em className="agent-role-tag">{role ? roleLabel(role) : "Guest · public guide"}</em>
              </span>
            </strong>
            <button type="button" className="saap-panel-close" onClick={onClose} aria-label="Close chat">Close</button>
          </header>
          <div className="saap-panel-body">
            <div className="saap-thread" aria-live="polite">
              {thread.map((m, i) => (
                <div key={i} className={m.from === "you" ? "saap-bubble you" : "saap-bubble"}>
                  <p>{m.text}</p>
                  {m.links && (
                    <div className="saap-link-row">
                      {m.links.map((l) => (
                        <button key={l.to} type="button" onClick={() => { navigate(l.to); onClose(); }}>{l.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="saap-bubble is-typing" aria-hidden="true">
                  <span /><span /><span />
                </div>
              )}
            </div>
            {!started && (
              <div className="saap-chips" aria-label="Suggested questions">
                {chips.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <form className="saap-panel-composer" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={role ? "Ask about your role, events, certificates…" : "Ask about programmes, events, policies…"}
              aria-label="Message the AI BI agent"
              disabled={busy}
            />
            <button className="saap-send" type="submit" disabled={busy}>{busy ? "…" : "Send"}</button>
          </form>
        </section>
      )}
      <button type="button" className="saap-fab saap-fab-chat" onClick={onToggle} aria-label="Open the AI BI agent" aria-expanded={open} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined}>
        <span className="saap-fab-icon" aria-hidden="true">
          <img src="/AI_BI_LOGO.gif" alt="" className="agent-logo" />
        </span>
      </button>
    </div>
  );
}

function WhatsAppButton({ open, hidden, onToggle, onClose }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("Hello SAAP, I need help with a sports service.");
  const [consent, setConsent] = useState(() => localStorage.getItem(WA_CONSENT_KEY) === "1");
  const { sendWhatsApp } = usePlatform();
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  const phoneDisplay = OFFICE.phones[1] || OFFICE.whatsapp;

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setSent("");
    if (consent) localStorage.setItem(WA_CONSENT_KEY, "1");
    else localStorage.removeItem(WA_CONSENT_KEY);

    const consentLine = consent
      ? " [I consent to receive automated SAAP status updates on WhatsApp after this enquiry.]"
      : "";
    const body = `${name ? `${name}: ` : ""}${note}${consentLine}`;
    const phone = String(OFFICE.whatsapp || "").replace(/\D/g, "");
    const fallbackUrl = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
    try {
      const { url } = await sendWhatsApp({
        to: OFFICE.whatsapp,
        name: "SAAP helpdesk",
        body,
        relatedId: consent ? "public-help-consent" : "public-help",
      });
      const opened = window.open(url || fallbackUrl, "_blank", "noopener,noreferrer");
      setSent(opened
        ? `WhatsApp opened to the official SAAP number ${phoneDisplay}.${consent ? " Automated updates consent was recorded locally." : ""} Delivery is not confirmed on this demo.`
        : "WhatsApp popup was blocked. Allow popups, or use the link below.");
      if (!opened) setSent((s) => `${s} ${url || fallbackUrl}`);
    } catch {
      const opened = window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      setSent(opened
        ? "Opened WhatsApp with your message to the official SAAP number."
        : `Could not open WhatsApp automatically. Use: ${fallbackUrl}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`saap-dock saap-wa-dock${open ? " is-open" : ""}${hidden ? " is-hidden" : ""}`}>
      {open && (
        <section className="saap-panel saap-panel-wa saap-glass" aria-label="WhatsApp SAAP support">
          <header>
            <strong>WhatsApp support</strong>
            <button type="button" onClick={onClose} aria-label="Close WhatsApp">Close</button>
          </header>
          <p className="muted">
            Enquiries route to the approved official number <strong>{phoneDisplay}</strong>.
            This opens WhatsApp with your message — delivery is not confirmed in the demo.
          </p>
          <form onSubmit={submit} className="stack">
            <label className="saap-field">
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Your name" />
            </label>
            <label className="saap-field">
              Message
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Message" required />
            </label>
            <label className="saap-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I consent to receive automated SAAP status updates on WhatsApp after this enquiry (optional).</span>
            </label>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "Opening…" : "Open WhatsApp"}</button>
          </form>
          {sent && <p className="ok">{sent}</p>}
          <Link to="/desk">Officer WhatsApp desk</Link>
        </section>
      )}
      <button type="button" className="saap-fab saap-fab-wa" onClick={onToggle} aria-label="Open WhatsApp support" aria-expanded={open} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined}>
        <span className="saap-fab-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path fill="currentColor" d="M12.04 3C7.3 3 3.46 6.8 3.46 11.5c0 1.5.4 2.96 1.16 4.24L3.4 21l5.4-1.4a8.7 8.7 0 0 0 3.24.62c4.74 0 8.58-3.8 8.58-8.5S16.78 3 12.04 3zm4.9 12.02c-.2.58-1.18 1.08-1.64 1.14-.42.06-.96.08-1.55-.1-.36-.1-.82-.26-1.42-.5-2.5-1.08-4.12-3.6-4.24-3.76-.12-.18-1-1.32-1-2.52s.62-1.78.84-2.02c.2-.24.46-.3.62-.3h.44c.14 0 .34-.02.52.4.2.46.66 1.6.72 1.72.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.26.3-.36.42-.12.12-.24.26-.1.5.14.24.62 1.02 1.34 1.66.92.82 1.7 1.08 1.94 1.2.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.14 1.16z" />
          </svg>
        </span>
      </button>
    </div>
  );
}
