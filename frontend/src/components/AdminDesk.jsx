import { useEffect, useMemo, useState } from "react";
import AdminAuditPanel from "./AdminAuditPanel";
import AdminCertificatePanel, {
  CertificateTemplate,
  CertificateVerifyPanel,
  loadLocalCerts,
  makeLocalQr,
} from "./AdminCertificatePanel";
import AdminEventsPanel from "./AdminEventsPanel";
import AdminKitsPanel from "./AdminKitsPanel";
import AdminReportsPanel from "./AdminReportsPanel";
import DeskIcon from "./DeskIcon";
import DeskShell from "./DeskShell";

const MODULES = [
  {
    id: "events",
    title: "Events",
    nav: "Events",
    blurb: "View upcoming, live and completed events. Open any event for registered player details by sport, Aadhaar, village, and biometric verification.",
    icon: "event",
  },
  {
    id: "kits",
    title: "Inventory of Kits",
    nav: "Kit inventory",
    blurb: "Maintain sports kit stock, item details, quantities, allocation to players/events, issue and return records, and low-stock alerts.",
    icon: "box",
  },
  {
    id: "certificates",
    title: "Certificate Generation",
    nav: "Certificates",
    blurb: "Generate standardized digital certificates for eligible players based on verified event participation and results; support download and controlled re-issuance.",
    icon: "certificate",
  },
  {
    id: "verify",
    title: "Certificate Verification by ID",
    nav: "Verify certificate",
    blurb: "Allow authorized users or the public to verify a certificate using a unique certificate ID or QR code and view its validity/status.",
    icon: "qr",
  },
  {
    id: "audit",
    title: "Blockchain-Based Audit Logs",
    nav: "Audit logs",
    blurb: "Maintain tamper-evident audit records for important actions, including user ID, date/time, IP address, available location data, action performed, and affected record.",
    icon: "link",
  },
  {
    id: "rewards",
    title: "Reward Money Distribution",
    nav: "Rewards",
    blurb: "Track approved reward amounts and payment status for players; validate registered bank-account details and record payment references, failures, and reconciliation outcomes.",
    icon: "rupee",
  },
  {
    id: "biometric",
    title: "Biometric Verification at Events",
    nav: "Biometric check-in",
    blurb: "Verify a registered player's identity at the event check-in point using an approved biometric device and consent-based verification workflow.",
    icon: "fingerprint",
  },
  {
    id: "grievance",
    title: "Grievance Redressal",
    nav: "Grievances",
    blurb: "Receive, assign, track, escalate, and resolve grievances with status updates, response timelines, supporting documents, and closure feedback.",
    icon: "handshake",
  },
];

const LOW_STOCK = 5;

export default function AdminDesk(props) {
  const {
    profile,
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
    users = [],
    reports,
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
    newItem,
    setNewItem,
    auditQuery,
    setAuditQuery,
    certQuery,
    setCertQuery,
    ticketSubject,
    setTicketSubject,
    ticketDetail,
    setTicketDetail,
  } = props;

  const [view, setView] = useState("home");
  const [verifyId, setVerifyId] = useState("");
  const [verified, setVerified] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [rewardFilter, setRewardFilter] = useState("");
  const [bioFilter, setBioFilter] = useState("");
  const [grievanceNote, setGrievanceNote] = useState("");

  const lowStockItems = inventory.items.filter((item) => item.stock <= LOW_STOCK);
  const readyForCert = registrations.filter((row) => row.participation === "present");
  const pendingBio = registrations.filter((row) => row.status === "approved" && !row.participation);
  const openTickets = tickets.filter((t) => t.status === "open");

  const filteredRewards = useMemo(() => {
    const q = rewardFilter.trim().toLowerCase();
    if (!q) return rewards;
    return rewards.filter((row) => `${row.student} ${row.amount} ${row.status} ${row.bank_status} ${row.payment_reference || ""}`.toLowerCase().includes(q));
  }, [rewards, rewardFilter]);

  const filteredBio = useMemo(() => {
    const q = bioFilter.trim().toLowerCase();
    const rows = registrations.filter((row) => row.status === "approved");
    if (!q) return rows;
    return rows.filter((row) => `${row.event} ${row.student} ${row.district} ${row.status} ${row.participation || ""}`.toLowerCase().includes(q));
  }, [registrations, bioFilter]);

  async function lookupCertificate(rawRef) {
    const ref = String(rawRef || "").trim();
    if (!ref) return { missing: "Enter a certificate ID / reference." };
    try {
      const res = await fetch(`/api/certificates/verify/${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (res.ok) {
        return {
          ...data,
          qr: data.qr || `/api/certificates/verify/${data.reference_no}/qr`,
          issued_by_name: data.issued_by_name || data.issued_by?.name || "",
          integrity: data.integrity || "ok",
        };
      }
      const local = loadLocalCerts().find((row) => String(row.reference_no).toLowerCase() === ref.toLowerCase());
      if (local) {
        return {
          ...local,
          title: local.title || local.event,
          qr: local.qr || makeLocalQr(local.reference_no),
          issued_by_name: local.issued_by_name || local.issued_by?.name || "",
          issued_by_role: local.issued_by_role || local.issued_by?.role || "admin",
          integrity: local.integrity || "ok",
          status: local.status || "issued",
          source: "local",
        };
      }
      return { missing: typeof data.detail === "string" ? data.detail : "Certificate not found" };
    } catch {
      const local = loadLocalCerts().find((row) => String(row.reference_no).toLowerCase() === ref.toLowerCase());
      if (local) {
        return {
          ...local,
          title: local.title || local.event,
          qr: local.qr || makeLocalQr(local.reference_no),
          issued_by_name: local.issued_by_name || local.issued_by?.name || "",
          issued_by_role: local.issued_by_role || local.issued_by?.role || "admin",
          integrity: local.integrity || "ok",
          status: local.status || "issued",
          source: "local",
        };
      }
      return { missing: "The registration service is not running, and no local certificate matched that reference." };
    }
  }

  async function runVerify(event) {
    event.preventDefault();
    setVerifyBusy(true);
    setVerified(null);
    const result = await lookupCertificate(verifyId);
    setVerified(result);
    setVerifyBusy(false);
  }

  useEffect(() => {
    if (view !== "verify" || !verifyId.trim() || verified) return undefined;
    let cancelled = false;
    (async () => {
      setVerifyBusy(true);
      const result = await lookupCertificate(verifyId);
      if (!cancelled) {
        setVerified(result);
        setVerifyBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [view, verifyId]);

  const titles = {
    home: "Admin desk",
    events: "Events",
    kits: "Inventory of Kits",
    certificates: "Certificate Generation",
    audit: "Blockchain-Based Audit Logs",
    rewards: "Reward Money Distribution",
    biometric: "Biometric Verification at Events",
    verify: "Certificate Verification by ID",
    grievance: "Grievance Redressal",
    accounts: "Accounts",
    reports: "Reports",
  };

  const sections = [
    {
      label: "Overview",
      items: [
        { id: "home", label: "Home", icon: "home" },
        { id: "events", label: "Events", icon: "event" },
        { id: "reports", label: "Reports", icon: "chart" },
        { id: "accounts", label: "Accounts", icon: "users" },
      ],
    },
    {
      label: "Admin modules",
      items: MODULES.filter((mod) => mod.id !== "events").map((mod) => ({
        id: mod.id,
        label: mod.nav || mod.title,
        icon: mod.icon,
        badge:
          mod.id === "kits" && lowStockItems.length
            ? lowStockItems.length
            : mod.id === "grievance" && openTickets.length
              ? openTickets.length
              : mod.id === "biometric" && pendingBio.length
                ? pendingBio.length
                : undefined,
      })),
    },
  ];

  if (view === "reports") {
    return (
      <div className="pbi-fullscreen">
        <AdminReportsPanel
          reports={reports}
          events={events}
          downloadReport={downloadReport}
          onClose={() => setView("home")}
        />
      </div>
    );
  }

  return (
    <DeskShell
      brandTitle="SAAP"
      brandSubtitle="ADMIN DESK"
      userName={profile?.name || "Administrator"}
      roleLabel="admin"
      sections={sections}
      activeId={view}
      onNavigate={setView}
      onSignOut={signOut}
      notice={notice}
      error={error}
    >
      <div className="saap-desk-pagehead">
        <h2>{titles[view] || "Admin"}</h2>
      </div>

      {view === "home" && (
        <>
          <p className="muted admin-desk-intro">
            Signed in as {profile?.name} · role admin. Open Events for player check-in, or a module below for kits, certificates, audit, rewards, biometric queue, certificate lookup, and grievances.
          </p>
          <div className="admin-module-grid">
            {MODULES.map((mod) => (
              <button key={mod.id} type="button" className="admin-module-card" onClick={() => setView(mod.id)}>
                <span className="admin-module-icon"><DeskIcon name={mod.icon} /></span>
                <strong>{mod.title}</strong>
                <p>{mod.blurb}</p>
                {mod.id === "events" && <em>Upcoming · live · completed</em>}
                {mod.id === "kits" && lowStockItems.length > 0 && <em>{lowStockItems.length} low-stock alert{lowStockItems.length > 1 ? "s" : ""}</em>}
                {mod.id === "certificates" && <em>{readyForCert.length} ready to issue</em>}
                {mod.id === "biometric" && <em>{pendingBio.length} awaiting check-in</em>}
                {mod.id === "grievance" && <em>{openTickets.length} open</em>}
                {mod.id === "rewards" && <em>{rewards.filter((r) => r.status === "pending" || r.status === "approved").length} in pipeline</em>}
                {mod.id === "audit" && <em>{auditRows.length} events</em>}
              </button>
            ))}
          </div>
        </>
      )}

      {view === "events" && (
        <article className="saap-desk-card evt-panel-card">
          <AdminEventsPanel />
        </article>
      )}

      {view === "kits" && (
        <article className="saap-desk-card evt-panel-card">
          <AdminKitsPanel
            inventory={inventory}
            registrations={registrations}
            act={act}
            issueStudent={issueStudent}
            setIssueStudent={setIssueStudent}
            itemId={itemId}
            setItemId={setItemId}
            newItem={newItem}
            setNewItem={setNewItem}
          />
        </article>
      )}

      {view === "certificates" && (
        <article className="saap-desk-card evt-panel-card">
          <AdminCertificatePanel
            registrations={registrations}
            certificates={certificates}
            profile={profile}
            act={act}
            printCertificate={printCertificate}
            certQuery={certQuery}
            setCertQuery={setCertQuery}
            onOpenVerify={(ref) => { setVerifyId(ref); setView("verify"); }}
          />
        </article>
      )}

      {view === "audit" && (
        <article className="saap-desk-card evt-panel-card">
          <AdminAuditPanel
            auditRows={auditRows}
            audit={audit}
            setAudit={setAudit}
            headers={headers}
            act={act}
            auditQuery={auditQuery}
            setAuditQuery={setAuditQuery}
          />
        </article>
      )}

      {view === "rewards" && (
        <article className="saap-desk-card">
          <p className="muted">{MODULES.find((m) => m.id === "rewards")?.blurb}</p>
          <div className="saap-desk-filterbar is-plain">
            <input value={rewardFilter} onChange={(e) => setRewardFilter(e.target.value)} placeholder="Filter rewards..." aria-label="Filter rewards" />
          </div>
          <div className="table-wrap">
            <table className="saap-desk-table">
              <thead><tr><th>Player</th><th>Amount</th><th>Bank check</th><th>Status</th><th>Payment ref</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredRewards.length === 0 && <tr><td colSpan={6} className="saap-desk-empty">No reward requests yet.</td></tr>}
                {filteredRewards.map((reward) => (
                  <tr key={reward.id}>
                    <td>{reward.student}</td>
                    <td>₹{reward.amount}</td>
                    <td>****{reward.bank_last4} · {reward.bank_status}</td>
                    <td>{reward.status}</td>
                    <td>{reward.payment_reference || "—"}</td>
                    <td>
                      <span className="row-actions">
                        {reward.status === "pending" && <button type="button" className="saap-desk-primary" onClick={() => act(`/api/rewards/${reward.id}/approve`)}>Approve</button>}
                        {reward.status === "approved" && (
                          <>
                            <button type="button" className="saap-desk-primary" onClick={() => act(`/api/rewards/${reward.id}/pay`, { status: "processed" })}>Record payment</button>
                            <button type="button" className="saap-desk-ghost" onClick={() => act(`/api/rewards/${reward.id}/pay`, { status: "failed" })}>Mark failed</button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {view === "biometric" && (
        <article className="saap-desk-card">
          <p className="muted">{MODULES.find((m) => m.id === "biometric")?.blurb} Sandbox device only — no physical scanner connected.</p>
          <div className="saap-desk-filterbar is-plain">
            <input value={bioFilter} onChange={(e) => setBioFilter(e.target.value)} placeholder="Filter approved registrations..." aria-label="Filter biometric queue" />
          </div>
          <ul className="saap-desk-list">
            {filteredBio.length === 0 && <li className="saap-desk-empty">No approved registrations for check-in.</li>}
            {filteredBio.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.student}</strong> · {row.event} · {row.district} · #{row.id}
                  {row.participation && <p className="ok">Already recorded: {row.participation}</p>}
                </div>
                {!row.participation && (
                  <span className="row-actions">
                    <button type="button" className="saap-desk-primary" onClick={() => act("/api/attendance", { registration_id: row.id, status: "present" })}>Biometric match</button>
                    <button type="button" className="saap-desk-ghost" onClick={() => act("/api/attendance", { registration_id: row.id, status: "exception", exception_note: "Fingerprint did not match" })}>Record mismatch</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="muted">Events listed: {events.length}.</p>
        </article>
      )}

      {view === "verify" && (
        <article className="saap-desk-card">
          <p className="muted">{MODULES.find((m) => m.id === "verify")?.blurb}</p>
          <form className="saap-desk-inline-form" onSubmit={runVerify}>
            <label>Certificate ID / reference
              <input value={verifyId} onChange={(e) => setVerifyId(e.target.value)} placeholder="e.g. SAAP-2026-630979 or CERT-2026-0001" required />
            </label>
            <button className="saap-desk-primary" type="submit" disabled={verifyBusy}>{verifyBusy ? "Checking…" : "Verify"}</button>
          </form>
          {verified && (
            <div className="admin-verify-result">
              {verified.missing ? <p className="error">{verified.missing}</p> : (
                <div className="cert-page-stack">
                  <CertificateTemplate cert={verified} issuerName={verified.issued_by_name || verified.issued_by?.name} templateId={verified.template || "classic"} />
                  <CertificateVerifyPanel cert={verified} issuerName={verified.issued_by_name || verified.issued_by?.name} />
                </div>
              )}
            </div>
          )}
        </article>
      )}

      {view === "grievance" && (
        <article className="saap-desk-card">
          <p className="muted">{MODULES.find((m) => m.id === "grievance")?.blurb}</p>
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            const detail = grievanceNote ? `${ticketDetail}\n\n[Admin note] ${grievanceNote}` : ticketDetail;
            act("/api/support", { subject: ticketSubject, detail });
            setTicketSubject("");
            setTicketDetail("");
            setGrievanceNote("");
          }}>
            <label>Subject<input required value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} /></label>
            <label>Detail<textarea required rows={3} value={ticketDetail} onChange={(e) => setTicketDetail(e.target.value)} /></label>
            <label>Assign / escalate note<input value={grievanceNote} onChange={(e) => setGrievanceNote(e.target.value)} /></label>
            <button className="saap-desk-primary" type="submit">Log grievance</button>
          </form>
          <ul className="saap-desk-list">
            {tickets.length === 0 && <li className="saap-desk-empty">No grievances yet.</li>}
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <div>
                  <strong>{ticket.subject}</strong> · {ticket.name} · <em>{ticket.status}</em>
                  <p className="muted">{ticket.detail}</p>
                </div>
                {ticket.status === "open" && <button type="button" className="saap-desk-primary" onClick={() => act(`/api/support/${ticket.id}/close`)}>Resolve &amp; close</button>}
              </li>
            ))}
          </ul>
        </article>
      )}

      {view === "accounts" && (
        <article className="saap-desk-card">
          <div className="table-wrap">
            <table className="saap-desk-table">
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>District</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {users.map((person) => (
                  <tr key={person.id}>
                    <td>{person.name}</td>
                    <td>{person.username}</td>
                    <td>{person.role}</td>
                    <td>{person.district}</td>
                    <td>{person.active ? "Active" : "Inactive"}</td>
                    <td>
                      {person.username !== "admin" && (
                        <button type="button" className="saap-desk-ghost" onClick={() => act(`/api/users/${person.id}`, { active: !person.active }, "PATCH")}>
                          {person.active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

    </DeskShell>
  );
}
