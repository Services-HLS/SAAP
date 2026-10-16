import { useMemo, useState } from "react";
import { DISTRICTS } from "../data/content";
import DeskShell from "./DeskShell";

const ROLE_LABEL = {
  department: "Department officer",
  operator: "Venue operator",
  accountant: "Accountant",
  auditor: "Auditor",
};

export default function StaffDesk({
  profile,
  sessionRole,
  rewards = [],
  certificates = [],
  registrations = [],
  events = [],
  inventory = { items: [], acknowledgements: [] },
  tickets = [],
  auditRows = [],
  audit,
  setAudit,
  headers,
  reports,
  sports = [],
  categories = [],
  notice,
  error,
  act,
  signOut,
  printCertificate,
  downloadReport,
  issueStudent,
  setIssueStudent,
  itemId,
  setItemId,
  eventForm,
  setEventForm,
  auditQuery,
  setAuditQuery,
  certQuery,
  setCertQuery,
  regQuery,
  setRegQuery,
}) {
  const role = sessionRole || profile?.role || "department";
  const [view, setView] = useState("home");
  const [verifyId, setVerifyId] = useState("");
  const [verified, setVerified] = useState(null);

  const canReview = role === "department";
  const canBio = role === "operator";
  const canPay = role === "accountant";
  const canCert = role === "department";
  const canAudit = ["department", "accountant", "auditor"].includes(role);
  const canEvents = role === "department";
  const canInventory = role === "department";

  const pendingRegs = registrations.filter((r) => r.status === "pending");
  const pendingBio = registrations.filter((r) => r.status === "approved" && !r.participation);
  const pendingPay = rewards.filter((r) => r.status === "approved");

  const shownRegs = useMemo(() => {
    const q = regQuery.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((row) => `${row.event} ${row.student} ${row.status} ${row.district} ${row.sport || ""}`.toLowerCase().includes(q));
  }, [registrations, regQuery]);

  const shownCerts = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    if (!q) return certificates;
    return certificates.filter((c) => `${c.reference_no} ${c.student} ${c.title}`.toLowerCase().includes(q));
  }, [certificates, certQuery]);

  const shownAudit = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    if (!q) return auditRows;
    return auditRows.filter((row) => `${row.action} ${row.actor} ${row.role} ${row.ip || ""}`.toLowerCase().includes(q));
  }, [auditRows, auditQuery]);

  const navItems = [
    { id: "home", label: "Home", icon: "home" },
    canReview && { id: "registrations", label: "Registrations", icon: "file", badge: pendingRegs.length || undefined },
    canBio && { id: "biometric", label: "Biometric check-in", icon: "fingerprint", badge: pendingBio.length || undefined },
    canCert && { id: "certificates", label: "Certificates", icon: "certificate" },
    (canReview || canPay) && { id: "rewards", label: "Rewards", icon: "rupee", badge: pendingPay.length || undefined },
    canInventory && { id: "kits", label: "Kit inventory", icon: "box" },
    canEvents && { id: "events", label: "Events", icon: "event" },
    { id: "verify", label: "Verify certificate", icon: "qr" },
    canAudit && { id: "audit", label: "Audit logs", icon: "link" },
    reports && { id: "reports", label: "Reports", icon: "chart" },
    { id: "grievance", label: "Grievances", icon: "handshake" },
  ].filter(Boolean);

  const sections = [
    { label: "Workspace", items: navItems },
  ];

  const titles = Object.fromEntries(navItems.map((item) => [item.id, item.label]));
  titles.home = `${ROLE_LABEL[role] || "Staff"} desk`;

  async function runVerify(event) {
    event.preventDefault();
    try {
      const res = await fetch(`/api/certificates/verify/${encodeURIComponent(verifyId.trim())}`);
      const data = await res.json();
      setVerified(res.ok ? data : { missing: typeof data.detail === "string" ? data.detail : "Not found" });
    } catch {
      setVerified({ missing: "Registration service offline." });
    }
  }

  return (
    <DeskShell
      brandTitle="SAAP"
      brandSubtitle={`${(ROLE_LABEL[role] || "STAFF").toUpperCase()} DESK`}
      userName={profile?.name || "Staff"}
      roleLabel={role}
      sections={sections}
      activeId={view}
      onNavigate={setView}
      onSignOut={signOut}
      notice={notice}
      error={error}
    >
      <div className="saap-desk-pagehead">
        <h2>{titles[view] || "Desk"}</h2>
      </div>

      {view === "home" && (
        <>
          <p className="muted admin-desk-intro">
            Signed in as {profile?.name} · {ROLE_LABEL[role] || role}
            {profile?.district ? ` · ${profile.district}` : ""}. Use the sidebar modules for your role.
          </p>
          <div className="admin-module-grid">
            {navItems.filter((item) => item.id !== "home").map((item) => (
              <button key={item.id} type="button" className="admin-module-card" onClick={() => setView(item.id)}>
                <strong>{item.label}</strong>
                <p>Open the {item.label.toLowerCase()} workspace for this desk.</p>
                {item.badge != null && <em>{item.badge} pending</em>}
              </button>
            ))}
          </div>
        </>
      )}

      {view === "registrations" && (
        <article className="saap-desk-card">
          <div className="saap-desk-filterbar is-plain">
            <input value={regQuery} onChange={(e) => setRegQuery(e.target.value)} placeholder="Filter registrations..." />
          </div>
          <ul className="saap-desk-list">
            {shownRegs.length === 0 && <li className="saap-desk-empty">No registrations.</li>}
            {shownRegs.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.event}</strong> · {row.student} · {row.district} · {row.status}
                  {row.participation ? ` · attendance ${row.participation}` : ""}
                </div>
                {canReview && row.status === "pending" && (
                  <span className="row-actions">
                    <button type="button" className="saap-desk-primary" onClick={() => act(`/api/registrations/${row.id}/review`, { status: "approved" })}>Approve</button>
                    <button type="button" className="saap-desk-ghost" onClick={() => act(`/api/registrations/${row.id}/review`, { status: "correction" })}>Return</button>
                    <button type="button" className="saap-desk-ghost" onClick={() => act(`/api/registrations/${row.id}/review`, { status: "rejected" })}>Reject</button>
                  </span>
                )}
                {canCert && row.participation === "present" && (
                  <button type="button" className="saap-desk-primary" onClick={() => act(`/api/certificates/${row.id}`)}>Issue certificate</button>
                )}
              </li>
            ))}
          </ul>
        </article>
      )}

      {view === "biometric" && (
        <article className="saap-desk-card">
          <p className="muted">Sandbox biometric check-in. No physical device is connected.</p>
          <ul className="saap-desk-list">
            {registrations.filter((r) => r.status === "approved").length === 0 && <li className="saap-desk-empty">No approved registrations.</li>}
            {registrations.filter((r) => r.status === "approved").map((row) => (
              <li key={row.id}>
                <strong>{row.student}</strong> · {row.event} · {row.participation || "awaiting check-in"}
                {!row.participation && (
                  <span className="row-actions">
                    <button type="button" className="saap-desk-primary" onClick={() => act("/api/attendance", { registration_id: row.id, status: "present" })}>Biometric match</button>
                    <button type="button" className="saap-desk-ghost" onClick={() => act("/api/attendance", { registration_id: row.id, status: "exception", exception_note: "Mismatch" })}>Mismatch</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </article>
      )}

      {view === "certificates" && (
        <article className="saap-desk-card">
          <div className="saap-desk-filterbar is-plain">
            <input value={certQuery} onChange={(e) => setCertQuery(e.target.value)} placeholder="Search certificates..." />
          </div>
          <ul className="saap-desk-list">
            {shownCerts.length === 0 && <li className="saap-desk-empty">No certificates.</li>}
            {shownCerts.map((cert) => (
              <li key={cert.reference_no}>
                {cert.reference_no} · {cert.student} · {cert.status}
                <button type="button" className="saap-desk-ghost" onClick={() => printCertificate(cert)}>Print</button>
              </li>
            ))}
          </ul>
        </article>
      )}

      {view === "rewards" && (
        <article className="saap-desk-card">
          <ul className="saap-desk-list">
            {rewards.length === 0 && <li className="saap-desk-empty">No rewards.</li>}
            {rewards.map((reward) => (
              <li key={reward.id}>
                {reward.student} · ₹{reward.amount} · {reward.status} · ****{reward.bank_last4}
                <span className="row-actions">
                  {canReview && reward.status === "pending" && <button type="button" className="saap-desk-primary" onClick={() => act(`/api/rewards/${reward.id}/approve`)}>Approve</button>}
                  {canPay && reward.status === "approved" && <button type="button" className="saap-desk-primary" onClick={() => act(`/api/rewards/${reward.id}/pay`, { status: "processed" })}>Record payment</button>}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {view === "kits" && (
        <article className="saap-desk-card">
          <ul className="saap-desk-list">
            {inventory.items.map((item) => <li key={item.id}>{item.name}: {item.stock} in stock</li>)}
          </ul>
          {inventory.items.length > 0 && (
            <form className="saap-desk-inline-form" onSubmit={(e) => { e.preventDefault(); act("/api/inventory/issue", { item_id: Number(itemId || inventory.items[0].id), student_id: Number(issueStudent), quantity: 1 }); }}>
              <label>Item
                <select value={itemId || inventory.items[0].id} onChange={(e) => setItemId(e.target.value)}>
                  {inventory.items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>Student id<input value={issueStudent} onChange={(e) => setIssueStudent(e.target.value)} required /></label>
              <button className="saap-desk-primary" type="submit">Issue</button>
            </form>
          )}
        </article>
      )}

      {view === "events" && (
        <article className="saap-desk-card">
          <form className="form two" onSubmit={(e) => {
            e.preventDefault();
            act("/api/events", {
              name: eventForm.name,
              sport_id: Number(eventForm.sport_id),
              district: eventForm.district,
              venue: eventForm.venue,
              age_category_id: Number(eventForm.age_category_id),
              deadline: eventForm.deadline,
              held_on: eventForm.held_on,
              capacity: Number(eventForm.capacity),
            });
          }}>
            <label>Event name<input required value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} /></label>
            <label>Venue<input required value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} /></label>
            <label>Sport
              <select required value={eventForm.sport_id} onChange={(e) => setEventForm({ ...eventForm, sport_id: e.target.value })}>
                <option value="">Choose</option>
                {sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
              </select>
            </label>
            <label>Age category
              <select required value={eventForm.age_category_id} onChange={(e) => setEventForm({ ...eventForm, age_category_id: e.target.value })}>
                <option value="">Choose</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>District
              <select value={eventForm.district} onChange={(e) => setEventForm({ ...eventForm, district: e.target.value })}>
                {DISTRICTS.map((district) => <option key={district}>{district}</option>)}
              </select>
            </label>
            <label>Capacity<input required value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })} /></label>
            <label>Deadline<input required type="date" value={eventForm.deadline} onChange={(e) => setEventForm({ ...eventForm, deadline: e.target.value })} /></label>
            <label>Event date<input required type="date" value={eventForm.held_on} onChange={(e) => setEventForm({ ...eventForm, held_on: e.target.value })} /></label>
            <button className="saap-desk-primary" type="submit">Save event</button>
          </form>
          <ul className="saap-desk-list">
            {events.map((event) => <li key={event.id}>{event.name} · {event.sport} · {event.district}</li>)}
          </ul>
        </article>
      )}

      {view === "verify" && (
        <article className="saap-desk-card">
          <form className="saap-desk-inline-form" onSubmit={runVerify}>
            <label>Certificate ID<input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} required /></label>
            <button className="saap-desk-primary" type="submit">Verify</button>
          </form>
          {verified && (verified.missing ? <p className="error">{verified.missing}</p> : (
            <p className="ok">{verified.reference_no} · {verified.student} · {verified.status} · {verified.integrity}</p>
          ))}
        </article>
      )}

      {view === "audit" && (
        <article className="saap-desk-card">
          <div className="saap-desk-inline-form">
            <button type="button" className="saap-desk-ghost" onClick={async () => setAudit(await fetch("/api/audit/verify", { headers }).then((r) => r.json()))}>Verify hash chain</button>
          </div>
          {audit && <p className={audit.ok ? "ok" : "error"}>{audit.ok ? `Intact · ${audit.events} events` : "Chain does not verify"}</p>}
          <div className="saap-desk-filterbar is-plain">
            <input value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="Filter audit..." />
          </div>
          <div className="table-wrap">
            <table className="saap-desk-table">
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>IP</th></tr></thead>
              <tbody>
                {shownAudit.map((row) => (
                  <tr key={row.id}>
                    <td>{row.time ? new Date(row.time).toLocaleString() : "—"}</td>
                    <td>{row.actor}</td>
                    <td>{row.action}</td>
                    <td>{row.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {view === "reports" && reports && (
        <article className="saap-desk-card">
          <button type="button" className="saap-desk-ghost" onClick={downloadReport}>Download CSV</button>
          <div className="stat-grid admin-stat-grid">
            {[
              ["Students", reports.students],
              ["Pending", reports.registrations?.pending],
              ["Certificates", reports.certificates],
              ["Rewards paid", reports.rewards?.processed],
            ].map(([label, value]) => (
              <article key={label}><b>{value ?? "—"}</b>{label}</article>
            ))}
          </div>
        </article>
      )}

      {view === "grievance" && (
        <article className="saap-desk-card">
          <ul className="saap-desk-list">
            {tickets.length === 0 && <li className="saap-desk-empty">No grievances.</li>}
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <strong>{ticket.subject}</strong> · {ticket.name} · {ticket.status}
                {ticket.status === "open" && canReview && (
                  <button type="button" className="saap-desk-primary" onClick={() => act(`/api/support/${ticket.id}/close`)}>Close</button>
                )}
              </li>
            ))}
          </ul>
        </article>
      )}
    </DeskShell>
  );
}
