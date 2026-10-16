import { Fragment, useMemo, useState } from "react";

function shortHash(value) {
  const h = String(value || "");
  if (h.length < 16) return h || "—";
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

function actionTone(action) {
  const a = String(action || "").toUpperCase();
  if (a.includes("FAIL") || a.includes("REJECT")) return "danger";
  if (a.includes("CHECKPOINT") || a.includes("ANCHOR") || a.includes("SEED")) return "anchor";
  if (a.includes("LOGIN") || a.includes("VERIFY") || a.includes("ACK")) return "ok";
  if (a.includes("ISSUE") || a.includes("CREATE") || a.includes("ADD") || a.includes("PAID")) return "info";
  return "neutral";
}

export default function AdminAuditPanel({
  auditRows = [],
  audit,
  setAudit,
  headers,
  act,
  auditQuery,
  setAuditQuery,
}) {
  const [busy, setBusy] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [expanded, setExpanded] = useState("");

  const actions = useMemo(() => {
    const map = new Map();
    for (const row of auditRows) {
      const key = row.action || "UNKNOWN";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [auditRows]);

  const roles = useMemo(() => {
    const set = new Set(auditRows.map((r) => r.role).filter(Boolean));
    return set.size;
  }, [auditRows]);

  const withIp = auditRows.filter((r) => r.ip).length;
  const checkpoints = auditRows.filter((r) => String(r.action).toUpperCase().includes("CHECKPOINT")).length;

  const filtered = useMemo(() => {
    const q = String(auditQuery || "").trim().toLowerCase();
    return auditRows.filter((row) => {
      if (actionFilter !== "all" && row.action !== actionFilter) return false;
      if (!q) return true;
      return `${row.action} ${row.actor} ${row.entity} ${row.role} ${row.ip || ""} ${row.entity_id || ""} ${row.hash || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [auditRows, auditQuery, actionFilter]);

  async function verifyChain() {
    setBusy("verify");
    try {
      const res = await fetch("/api/audit/verify", { headers });
      const data = await res.json();
      setAudit(data);
    } catch {
      setAudit({ ok: false, reason: "Could not reach the audit service." });
    } finally {
      setBusy("");
    }
  }

  async function createCheckpoint() {
    setBusy("anchor");
    try {
      await act("/api/audit/anchor");
      const res = await fetch("/api/audit/verify", { headers });
      const data = await res.json();
      setAudit(data);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="audit-desk">
      <header className="audit-intro">
        <div>
          <h3>Blockchain-Based Audit Logs</h3>
          <p>
            Tamper-evident trail of important SAAP actions. Each event is sealed to the previous hash.
            This demo uses a local hash chain with optional checkpoints — not a public blockchain.
          </p>
        </div>
        <div className="audit-intro-stats" aria-label="Audit summary">
          <span><b>{auditRows.length}</b> events</span>
          <span><b>{roles}</b> roles</span>
          <span><b>{withIp}</b> with IP</span>
          <span><b>{checkpoints}</b> checkpoints</span>
        </div>
      </header>

      <section className="audit-panel audit-actions-panel">
        <div className="audit-panel-head">
          <div>
            <em>Integrity</em>
            <h3>Hash chain controls</h3>
          </div>
          <div className="audit-action-btns">
            <button type="button" className="audit-btn audit-btn-ghost" disabled={busy === "verify"} onClick={verifyChain}>
              {busy === "verify" ? "Verifying…" : "Verify hash chain"}
            </button>
            <button type="button" className="audit-btn audit-btn-primary" disabled={busy === "anchor"} onClick={createCheckpoint}>
              {busy === "anchor" ? "Creating…" : "Create local checkpoint"}
            </button>
          </div>
        </div>

        <div className={`audit-status${audit ? (audit.ok ? " is-ok" : " is-bad") : ""}`} role="status">
          {!audit && (
            <p>Run <strong>Verify hash chain</strong> to confirm the local trail is intact, or create a checkpoint after a batch of actions.</p>
          )}
          {audit?.ok && (
            <p>
              <strong>Chain intact.</strong> {audit.events} events verified
              {audit.head ? <> · head <code title={audit.head}>{shortHash(audit.head)}</code></> : null}.
            </p>
          )}
          {audit && !audit.ok && (
            <p>
              <strong>Chain broken.</strong> {audit.reason || "Hash mismatch detected"}
              {audit.broken_at ? <> at <code>{audit.broken_at}</code></> : null}.
            </p>
          )}
        </div>

        <ol className="audit-flow" aria-label="How the audit chain works">
          <li><span>1</span><div><strong>Action happens</strong><em>Login, issue, approve, etc.</em></div></li>
          <li><span>2</span><div><strong>Event sealed</strong><em>Hash includes previous event</em></div></li>
          <li><span>3</span><div><strong>Verify</strong><em>Recompute the full chain</em></div></li>
          <li><span>4</span><div><strong>Checkpoint</strong><em>Local root for this demo</em></div></li>
        </ol>
      </section>

      <section className="audit-panel">
        <div className="audit-panel-head">
          <div>
            <em>Activity</em>
            <h3>Event log</h3>
          </div>
          <input
            className="audit-search"
            value={auditQuery}
            onChange={(e) => setAuditQuery(e.target.value)}
            placeholder="Filter by person, role, action, IP, hash…"
            aria-label="Filter audit"
          />
        </div>

        <div className="audit-filters" role="group" aria-label="Filter by action">
          <button type="button" className={actionFilter === "all" ? "on" : ""} onClick={() => setActionFilter("all")}>
            All <em>{auditRows.length}</em>
          </button>
          {actions.slice(0, 8).map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={actionFilter === name ? "on" : ""}
              onClick={() => setActionFilter(name)}
            >
              {name.replaceAll("_", " ")} <em>{count}</em>
            </button>
          ))}
        </div>

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date / time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>IP</th>
                <th>Record</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="audit-empty">No audit rows match this filter.</td></tr>
              )}
              {filtered.map((row) => {
                const open = expanded === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className={open ? "is-open" : ""}>
                      <td className="audit-time">{row.time ? new Date(row.time).toLocaleString() : "—"}</td>
                      <td>
                        <strong className="audit-actor">{row.actor || "System"}</strong>
                      </td>
                      <td>{row.role ? <em className="audit-role">{row.role}</em> : "—"}</td>
                      <td>
                        <em className={`audit-action is-${actionTone(row.action)}`}>
                          {String(row.action || "").replaceAll("_", " ")}
                        </em>
                      </td>
                      <td className="audit-mono">{row.ip || "—"}</td>
                      <td>
                        <span className="audit-entity">{row.entity}</span>
                        <small>{row.entity_id}</small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="audit-hash-btn"
                          title={row.hash || ""}
                          onClick={() => setExpanded(open ? "" : row.id)}
                        >
                          {shortHash(row.hash)}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="audit-detail-row">
                        <td colSpan={7}>
                          <div className="audit-detail">
                            <div>
                              <span>Event ID</span>
                              <code>{row.id}</code>
                            </div>
                            <div>
                              <span>Event hash</span>
                              <code>{row.hash || "—"}</code>
                            </div>
                            <div>
                              <span>Previous hash</span>
                              <code>{row.prev || "—"}</code>
                            </div>
                            <div>
                              <span>Integrity</span>
                              <code>{row.integrity || "local-hash"}</code>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
