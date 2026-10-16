import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminDesk from "../components/AdminDesk";
import PlayerDesk from "../components/PlayerDesk";
import StaffDesk from "../components/StaffDesk";
import { DISTRICTS } from "../data/content";

const emptySession = { token: "", role: "", name: "" };
const STEPS = [
  ["1", "Register", "Profile, date of birth and bank account"],
  ["2", "Aadhaar OTP", "Sandbox identity check"],
  ["3", "Eligibility", "Games that match the date of birth"],
  ["4", "Event", "Register only when eligible"],
  ["5", "Biometric", "Venue staff confirm participation"],
  ["6", "Certificate", "Issued after attendance"],
  ["7", "Reward", "Department approval, then accounts"],
  ["8", "Kit", "Student acknowledges the issued item"],
  ["9", "Reports", "Counts, payouts and the audit trail"],
  ["10", "History", "Participation and certificate status"],
];

const blankForm = {
  full_name: "",
  username: "",
  password: "",
  phone: "",
  email: "",
  channel: "mobile",
  otp: "",
  district: "Krishna",
  dob: "2014-06-01",
  gender: "Female",
  aadhaar_last4: "",
  bank_name: "",
  bank_last4: "",
};

export default function Platform() {
  const [session, setSession] = useState(emptySession);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [inventory, setInventory] = useState({ items: [], acknowledgements: [] });
  const [certificates, setCertificates] = useState([]);
  const [reports, setReports] = useState(null);
  const [otp, setOtp] = useState("");
  const [contactCode, setContactCode] = useState("");
  const [sandboxOtp, setSandboxOtp] = useState("");
  const [amount, setAmount] = useState("1500");
  const [bankLast4, setBankLast4] = useState("");
  const [issueStudent, setIssueStudent] = useState("");
  const [audit, setAudit] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [regQuery, setRegQuery] = useState("");
  const [certQuery, setCertQuery] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDetail, setTicketDetail] = useState("");
  const [sports, setSports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [itemId, setItemId] = useState("");
  const [newItem, setNewItem] = useState({ name: "", stock: "10" });
  const [eventForm, setEventForm] = useState({
    name: "",
    sport_id: "",
    district: "Krishna",
    venue: "",
    age_category_id: "",
    deadline: "2026-12-01",
    held_on: "2026-11-15",
    capacity: "40",
  });
  const [checkedCert, setCheckedCert] = useState(null);
  const [params] = useSearchParams();

  const headers = {
    Authorization: session.token ? `Bearer ${session.token}` : "",
    "Content-Type": "application/json",
  };

  function applySession(data) {
    const next = { token: data.token, role: data.role, name: data.name };
    setSession(next);
    sessionStorage.setItem("saap-portal", JSON.stringify(next));
    return next;
  }

  async function load(token = session.token) {
    if (!token) return;
    const auth = { Authorization: `Bearer ${token}` };
    const call = (path) => fetch(path, { headers: auth }).then((res) => res.json());
    const [me, eventRows, registrationRows, rewardRows, stock, certs] = await Promise.all([
      call("/api/me"),
      call("/api/events"),
      call("/api/registrations"),
      call("/api/rewards").catch(() => []),
      call("/api/inventory"),
      call("/api/certificates").catch(() => []),
    ]);
    if (!me.role) {
      sessionStorage.removeItem("saap-portal");
      setSession(emptySession);
      setProfile(null);
      setError(typeof me.detail === "string" ? me.detail : "Sign in again.");
      setRegistrations([]);
      setRewards([]);
      setCertificates([]);
      setInventory({ items: [], acknowledgements: [] });
      setReports(null);
      const publicEvents = await fetch("/api/events").then((res) => res.json()).catch(() => []);
      setEvents(Array.isArray(publicEvents) ? publicEvents : []);
      return;
    }
    setProfile(me);
    setEvents(Array.isArray(eventRows) ? eventRows : []);
    setRegistrations(Array.isArray(registrationRows) ? registrationRows : []);
    setRewards(Array.isArray(rewardRows) ? rewardRows : []);
    setInventory(stock.items ? stock : { items: [], acknowledgements: [] });
    setCertificates(Array.isArray(certs) ? certs : []);
    const notes = await call("/api/notifications").catch(() => []);
    setNotifications(Array.isArray(notes) ? notes : []);
    const ticketRows = await call("/api/support").catch(() => []);
    setTickets(Array.isArray(ticketRows) ? ticketRows : []);
    if (["department", "admin"].includes(me.role)) {
      const [sportRows, categoryRows] = await Promise.all([call("/api/sports"), call("/api/age-categories")]);
      setSports(Array.isArray(sportRows) ? sportRows : []);
      setCategories(Array.isArray(categoryRows) ? categoryRows : []);
    } else {
      setSports([]);
      setCategories([]);
    }
    if (me.role === "admin") {
      const people = await call("/api/users");
      setUsers(Array.isArray(people) ? people : []);
    } else {
      setUsers([]);
    }
    if (["department", "accountant", "admin", "auditor"].includes(me.role)) {
      const trail = await call("/api/audit");
      setAuditRows(Array.isArray(trail) ? trail : []);
    } else {
      setAuditRows([]);
    }
    if (me.bank_last4) setBankLast4(me.bank_last4);
    if (["department", "accountant", "admin", "auditor"].includes(me.role)) {
      const summary = await call("/api/reports");
      setReports(summary.students !== undefined ? summary : null);
    } else {
      setReports(null);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("saap-portal");
    if (!saved) {
      fetch("/api/events").then((res) => res.json()).then((rows) => setEvents(Array.isArray(rows) ? rows : [])).catch(() => setError("The registration service is not running. Start it from the backend folder."));
      return;
    }
    const next = JSON.parse(saved);
    setSession(next);
    load(next.token);
  }, []);

  async function register(event) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.detail === "string" ? data.detail : "Check the registration fields");
      return;
    }
    const next = applySession(data);
    setNotice(`Registration ${data.reference_no} is saved. The mobile or email code was accepted. Sandbox bank check: ${data.bank_status}. No bank was contacted. Complete the Aadhaar OTP next.`);
    load(next.token);
  }

  async function act(path, body, method = "POST") {
    setError("");
    const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.detail === "string" ? data.detail : "The action was refused");
      return data;
    }
    setNotice(data.notice || "Saved.");
    load();
    return data;
  }

  function signOut() {
    sessionStorage.removeItem("saap-portal");
    setSession(emptySession);
    setProfile(null);
    setReports(null);
    setRegistrations([]);
    setCertificates([]);
    setRewards([]);
    setAuditRows([]);
    setNotifications([]);
    setTickets([]);
    setUsers([]);
    setNotice("");
    setError("");
  }

  const staff = session.role === "department" || session.role === "admin";
  const canReadAudit = ["department", "accountant", "admin", "auditor"].includes(session.role);
  const progress = [
    Boolean(profile),
    Boolean(profile?.aadhaar_verified),
    Boolean(profile?.aadhaar_verified),
    registrations.length > 0,
    registrations.some((row) => row.participation),
    certificates.length > 0,
    rewards.length > 0,
    inventory.acknowledgements.length > 0,
    Boolean(reports),
    registrations.length > 0 || certificates.length > 0,
  ];
  const shownRegistrations = registrations.filter((row) => `${row.event} ${row.student} ${row.status} ${row.district} ${row.sport || ""}`.toLowerCase().includes(regQuery.toLowerCase()));
  const shownCertificates = certificates.filter((cert) => `${cert.reference_no} ${cert.title} ${cert.student} ${cert.sport || ""} ${cert.status}`.toLowerCase().includes(certQuery.toLowerCase()));
  const shownAudit = auditRows.filter((row) => `${row.action} ${row.actor} ${row.entity} ${row.role} ${row.ip || ""}`.toLowerCase().includes(auditQuery.toLowerCase()));

  function downloadReport() {
    if (!reports) return;
    const lines = [
      ["Scope", reports.scope],
      ["Students", reports.students],
      ["Aadhaar verified", reports.verified_students],
      ["Registrations pending", reports.registrations.pending],
      ["Registrations approved", reports.registrations.approved],
      ["Registrations rejected", reports.registrations.rejected],
      ["Participated", reports.participated],
      ["Biometric mismatches", reports.biometric_exceptions],
      ["Certificates", reports.certificates],
      ["Rewards pending", reports.rewards.pending],
      ["Rewards approved", reports.rewards.approved],
      ["Rewards paid", reports.rewards.processed],
      ["Rewards failed", reports.rewards.failed],
      ["Banks validated", reports.bank.validated],
      ["Banks not validated", reports.bank.unvalidated],
      ["Kits pending", reports.kits.pending],
      ["Kits acknowledged", reports.kits.acknowledged],
    ];
    if (Array.isArray(reports.by_district)) {
      lines.push(["District", "Students"]);
      reports.by_district.forEach((row) => lines.push([row.district, row.students]));
    }
    const csv = lines.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "saap-registration-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function sendContactCode() {
    setError("");
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: form.phone, email: form.email, channel: form.channel }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.detail === "string" ? data.detail : "The code could not be created");
      return;
    }
    setContactCode(data.sandbox_otp || "");
    if (data.sandbox_otp) setForm((current) => ({ ...current, otp: data.sandbox_otp }));
    setNotice(data.notice || "Code created.");
  }

  function printCertificate(cert) {
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      setError("The print window was blocked.");
      return;
    }
    const safe = (value) => String(value ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
    const issuer = safe(cert.issued_by_name || cert.issued_by?.name || "");
    const qr = safe(cert.qr || `/api/certificates/verify/${cert.reference_no}/qr`);
    win.document.write(`<!doctype html><html><head><title>${safe(cert.reference_no)}</title>
      <style>
        body{font-family:Georgia,"Times New Roman",serif;color:#1a2b4a;margin:0;padding:28px;background:#efe6d4}
        .sheet{max-width:860px;margin:0 auto;background:linear-gradient(180deg,#fffdf8,#f7f0e4);border:14px double #7a151a;padding:36px 40px;text-align:center}
        .logo{width:min(420px,88%);height:auto;margin:0 auto 10px;display:block;background:#fff;padding:12px 18px;border:1px solid #e6dcc8;border-radius:8px}
        .gov{letter-spacing:.16em;text-transform:uppercase;font-size:.78rem;color:#7a151a;font-weight:700}
        h1{margin:6px 0 16px;font-size:2rem;color:#7a151a}
        .name{font-size:2rem;margin:12px 0;color:#7a151a;border-bottom:1px solid #c9b89a;display:inline-block;padding:0 18px 6px}
        .meta{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin:18px 0}
        .signs{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:24px}
        .seal{width:90px;height:90px;border:3px solid #7a151a;border-radius:50%;display:grid;place-content:center;margin:0 auto;color:#7a151a;font-weight:700;box-shadow:inset 0 0 0 4px #c9a227}
      </style></head><body><div class="sheet">
      <img class="logo" src="${window.location.origin}/saap-logo.png" alt="Sports Authority of Andhra Pradesh" />
      <p class="gov">Government of Andhra Pradesh</p>
      <h1>Certificate of Participation</h1>
      <p>This is to certify that</p>
      <p class="name">${safe(cert.student)}</p>
      <p>has successfully participated in <em>${safe(cert.event || cert.title)}</em>${cert.sport ? ` in the discipline of <strong>${safe(cert.sport)}</strong>` : ""}${cert.district ? ` representing <strong>${safe(cert.district)}</strong>` : ""}, organised under the Sports Authority of Andhra Pradesh (SAAP).</p>
      <div class="meta"><span>Certificate No. <strong>${safe(cert.reference_no)}</strong></span><span>Generated by <strong>${issuer || "—"}</strong></span></div>
      <div class="signs">
        <div><img alt="Certificate QR" src="${qr}" width="110" height="110" /><br><small>Scan to verify</small></div>
        <div class="seal">SAAP</div>
        <div><strong>${issuer || "Authorised Officer"}</strong><br><small>Authorised by</small></div>
      </div>
      </div></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  useEffect(() => {
    const reference = params.get("verify");
    if (!reference) return;
    fetch(`/api/certificates/verify/${encodeURIComponent(reference)}`)
      .then(async (res) => {
        const data = await res.json();
        setCheckedCert(res.ok ? data : { missing: data.detail || "Certificate not found" });
      })
      .catch(() => setCheckedCert({ missing: "The registration service is not running." }));
  }, [params]);

  if (session.role === "student" && profile) {
    return (
      <PlayerDesk
        profile={profile}
        rewards={rewards}
        certificates={certificates}
        registrations={registrations}
        events={events}
        inventory={inventory}
        tickets={tickets}
        notifications={notifications}
        notice={notice}
        error={error}
        otp={otp}
        setOtp={setOtp}
        sandboxOtp={sandboxOtp}
        setSandboxOtp={setSandboxOtp}
        amount={amount}
        setAmount={setAmount}
        bankLast4={bankLast4}
        setBankLast4={setBankLast4}
        act={act}
        signOut={signOut}
      />
    );
  }

  if (session.role === "admin" && profile) {
    return (
      <AdminDesk
        profile={profile}
        rewards={rewards}
        certificates={certificates}
        registrations={registrations}
        events={events}
        inventory={inventory}
        tickets={tickets}
        auditRows={auditRows}
        audit={audit}
        setAudit={setAudit}
        headers={headers}
        users={users}
        reports={reports}
        notice={notice}
        error={error}
        act={act}
        signOut={signOut}
        printCertificate={printCertificate}
        downloadReport={downloadReport}
        issueStudent={issueStudent}
        setIssueStudent={setIssueStudent}
        itemId={itemId}
        setItemId={setItemId}
        newItem={newItem}
        setNewItem={setNewItem}
        auditQuery={auditQuery}
        setAuditQuery={setAuditQuery}
        certQuery={certQuery}
        setCertQuery={setCertQuery}
        ticketSubject={ticketSubject}
        setTicketSubject={setTicketSubject}
        ticketDetail={ticketDetail}
        setTicketDetail={setTicketDetail}
      />
    );
  }

  if (profile && ["department", "operator", "accountant", "auditor"].includes(session.role)) {
    return (
      <StaffDesk
        profile={profile}
        sessionRole={session.role}
        rewards={rewards}
        certificates={certificates}
        registrations={registrations}
        events={events}
        inventory={inventory}
        tickets={tickets}
        auditRows={auditRows}
        audit={audit}
        setAudit={setAudit}
        headers={headers}
        reports={reports}
        sports={sports}
        categories={categories}
        notice={notice}
        error={error}
        act={act}
        signOut={signOut}
        printCertificate={printCertificate}
        downloadReport={downloadReport}
        issueStudent={issueStudent}
        setIssueStudent={setIssueStudent}
        itemId={itemId}
        setItemId={setItemId}
        eventForm={eventForm}
        setEventForm={setEventForm}
        auditQuery={auditQuery}
        setAuditQuery={setAuditQuery}
        certQuery={certQuery}
        setCertQuery={setCertQuery}
        regQuery={regQuery}
        setRegQuery={setRegQuery}
      />
    );
  }

  return (
    <>
      <header className="page-hero page-hero-compact">
        <div className="wrap">
          <p className="eyebrow">Sports Authority of Andhra Pradesh</p>
          <h1>Student registration, participation and rewards</h1>
          <p className="lede">New players register through Aadhaar OTP, profile, and bank details — the same order as the official SAAP portal.</p>
        </div>
      </header>
      <div className="portal-wrap platform-page">
        <div className="portal-steps">
          {STEPS.map(([n, title, text], index) => (
            <article key={n} className={progress[index] ? "done" : ""}><span>{n}</span><strong> {title}</strong><p>{text}</p></article>
          ))}
        </div>
        {checkedCert && (
          <article className="panel-card">
            <h2>Certificate check</h2>
            {checkedCert.missing ? <p className="error">{checkedCert.missing}</p> : (
              <>
                <p>{checkedCert.reference_no} · {checkedCert.student} · {checkedCert.title}</p>
                <p>{checkedCert.sport} · {checkedCert.district} · {checkedCert.venue || ""}{checkedCert.held_on ? ` · ${checkedCert.held_on}` : ""}</p>
                <p>Status {checkedCert.status} · record check {checkedCert.integrity}{checkedCert.participation ? ` · participation ${checkedCert.participation.status}` : ""}</p>
                <p>Mobile check {checkedCert.phone_verified ? "verified" : "not recorded"} · Aadhaar check {checkedCert.aadhaar_verified ? "verified" : "not recorded"}</p>
                {checkedCert.chain && <p>Certificate seal {checkedCert.chain.intact ? "intact" : "does not match"} · {checkedCert.chain.hash}</p>}
                {checkedCert.qr && <img src={checkedCert.qr} alt={`QR code for ${checkedCert.reference_no}`} width="160" height="160" />}
                <p className="muted">{checkedCert.notice}</p>
              </>
            )}
          </article>
        )}
        {notice && <p className="ok">{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        {!session.token && (
          <div className="platform-reg-only">
            <article className="panel-card platform-auth-side">
              <h2>New player / student</h2>
              <p>Registration follows the official order: Aadhaar OTP → profile → bank details → confirm.</p>
              <p className="muted">Open the player registration wizard to create your account. After registration you land on the player desk. Admin and staff sign in from the Login page.</p>
              <Link className="saap-login-btn" to="/register?type=player">Player registration</Link>
              <p className="muted"><Link to="/login">Admin / staff login</Link></p>
            </article>
          </div>
        )}

        {profile && (
          <article className="panel-card">
            <h2>{profile.name}</h2>
            <p>{profile.role} · {profile.district}{profile.reference_no ? ` · ${profile.reference_no}` : ""}{profile.age ? ` · age ${profile.age}` : ""}</p>
            <p>Permissions: {(profile.permissions || []).join(", ") || "none listed"}</p>
            <p>Aadhaar {profile.aadhaar_verified ? `verified ${profile.aadhaar_masked}` : "not verified yet"}{profile.bank_last4 ? ` · ${profile.bank_name} ****${profile.bank_last4} (${profile.bank_status})` : ""}</p>
            <button className="btn ghost" type="button" onClick={signOut}>Sign out</button>
          </article>
        )}

        <section className="platform-section">
          <h2>Games and events</h2>
          <div className={`event-grid${events.length === 1 ? " is-single" : ""}`}>
            {events.length === 0 && <p className="muted">No games are listed yet.</p>}
            {events.map((event) => (
              <article className="record" key={event.id}>
                <h3>{event.name}</h3>
                <p>{event.sport} · {event.category} · ages {event.min_age}–{event.max_age}</p>
                <p>{event.venue}, {event.district}</p>
                <p className="muted">Event date {event.held_on || "not set"} · closes {String(event.deadline || "").slice(0, 10)} · {event.registered ?? "—"}/{event.capacity} places</p>
                {event.eligibility_note && <p className={event.eligible ? "ok" : "error"}>{event.eligibility_note}</p>}
                {session.role === "student" && event.eligible && !registrations.some((row) => row.event_id === event.id) && (
                  <button className="btn primary" type="button" onClick={() => act("/api/events/register", { event_id: event.id })}>Register</button>
                )}
                {session.role === "student" && registrations.some((row) => row.event_id === event.id) && <p className="muted">You are already registered for this event.</p>}
              </article>
            ))}
          </div>
        </section>

        {session.token && (
          <section>
            <h2>Registrations and participation</h2>
            <input className="filter" value={regQuery} onChange={(e) => setRegQuery(e.target.value)} placeholder="Filter by student, event, sport, or status" aria-label="Filter registrations" />
            {shownRegistrations.length === 0 && <p>No registrations yet.</p>}
            <div className="portal-grid">
              {shownRegistrations.map((row) => (
                <article className="record" key={row.id}>
                  <h3>{row.event}</h3>
                  <p>{row.student} · student {row.student_id} · {row.sport || "Sport"} · {row.district} · {row.status}{row.participation ? ` · attendance ${row.participation}` : ""}</p>
                  <div className="row-actions">
                    {staff && row.status === "pending" && <button className="btn primary" type="button" onClick={() => act(`/api/registrations/${row.id}/review`, { status: "approved" })}>Approve</button>}
                    {staff && row.status === "pending" && <button className="btn ghost" type="button" onClick={() => act(`/api/registrations/${row.id}/review`, { status: "correction" })}>Return</button>}
                    {staff && row.status === "pending" && <button className="btn ghost" type="button" onClick={() => act(`/api/registrations/${row.id}/review`, { status: "rejected" })}>Reject</button>}
                    {session.role === "operator" && row.status === "approved" && !row.participation && <button className="btn primary" type="button" onClick={() => act("/api/attendance", { registration_id: row.id, status: "present" })}>Biometric match</button>}
                    {session.role === "operator" && row.status === "approved" && !row.participation && <button className="btn ghost" type="button" onClick={() => act("/api/attendance", { registration_id: row.id, status: "exception", exception_note: "Fingerprint did not match" })}>Record mismatch</button>}
                    {staff && row.participation === "present" && <button className="btn ghost" type="button" onClick={() => act(`/api/certificates/${row.id}`)}>Issue certificate</button>}
                  </div>
                  {staff && row.status === "approved" && row.participation !== "present" && <p className="muted">A certificate can be issued after attendance is recorded as present. The biometric check is a sandbox label. No device is connected.</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {session.token && (
          <section className="portal-grid">
            <article className="panel-card">
              <h2>Certificates</h2>
              <input className="filter" value={certQuery} onChange={(e) => setCertQuery(e.target.value)} placeholder="Search reference, student, or sport" aria-label="Filter certificates" />
              {shownCertificates.length === 0 && <p>No certificates yet.</p>}
              {shownCertificates.map((cert) => (
                <p key={cert.reference_no}>
                  {cert.reference_no} · {cert.title} · {cert.student} · {cert.sport || "Sport"} · {cert.district || ""} · {cert.status}
                  {cert.issued_at ? ` · ${cert.issued_at.slice(0, 10)}` : ""} · record check {cert.integrity || "unavailable"}
                  {cert.qr && <img src={cert.qr} alt={`QR code for ${cert.reference_no}`} width="96" height="96" />}
                  <span className="row-actions">
                    <button className="btn ghost" type="button" onClick={() => printCertificate(cert)}>Print</button>
                    <a href={`/platform?verify=${encodeURIComponent(cert.reference_no)}`}>Verification link</a>
                  </span>
                </p>
              ))}
            </article>
            <article className="panel-card">
              <h2>Rewards</h2>
              {session.role === "student" && (
                <form className="form" onSubmit={(e) => { e.preventDefault(); act("/api/rewards", { amount: Number(amount), bank_last4: bankLast4 }); }}>
                  <label>Amount (₹)<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
                  <label>Saved account last 4<input pattern="[0-9]{4}" value={bankLast4} onChange={(e) => setBankLast4(e.target.value)} /></label>
                  <button className="btn primary" type="submit">Submit reward request</button>
                  <p className="muted">The four digits must match the account saved at registration. A match is a sandbox check. It is not a bank transfer.</p>
                </form>
              )}
              {rewards.map((reward) => (
                <p key={reward.id}>{reward.student} · ₹{reward.amount} · bank ****{reward.bank_last4} · {reward.bank_status} · {reward.status}{reward.payment_reference ? ` · ${reward.payment_reference}` : ""}{reward.simulation ? " · sandbox" : ""}
                  <span className="row-actions">
                    {staff && reward.status === "pending" ? <button className="btn primary" type="button" onClick={() => act(`/api/rewards/${reward.id}/approve`)}>Approve</button> : null}
                    {session.role === "accountant" && reward.status === "approved" ? <button className="btn primary" type="button" onClick={() => act(`/api/rewards/${reward.id}/pay`, { status: "processed" })}>Record sandbox payment</button> : null}
                  </span>
                </p>
              ))}
            </article>
          </section>
        )}

        {session.token && (
          <article className="panel-card">
            <h2>Sports kit and acknowledgement</h2>
            {inventory.items.map((item) => <p key={item.id}>{item.name}: {item.stock} in stock</p>)}
            {inventory.acknowledgements.length === 0 && <p>No kit issues in this view.</p>}
            {inventory.acknowledgements.map((ack) => (
              <p key={ack.id}>{ack.item} for {ack.student} · student {ack.student_id} · qty {ack.quantity} · {ack.status}{ack.issued_at ? ` · ${ack.issued_at.slice(0, 10)}` : ""}
                {session.role === "student" && ack.status === "pending" ? <button className="btn primary" type="button" onClick={() => act(`/api/inventory/ack/${ack.id}`)}>Acknowledge</button> : null}
              </p>
            ))}
            {staff && inventory.items.length > 0 && (
              <form className="form inline" onSubmit={(e) => { e.preventDefault(); act("/api/inventory/issue", { item_id: Number(itemId || inventory.items[0].id), student_id: Number(issueStudent), quantity: 1 }); }}>
                <label>Item
                  <select value={itemId || inventory.items[0].id} onChange={(e) => setItemId(e.target.value)}>
                    {inventory.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.stock})</option>)}
                  </select>
                </label>
                <label>Student id<input value={issueStudent} onChange={(e) => setIssueStudent(e.target.value)} placeholder="From the registration card" /></label>
                <button className="btn primary" type="submit">Issue item</button>
              </form>
            )}
            {session.role === "admin" && (
              <form className="form inline" onSubmit={(e) => { e.preventDefault(); act("/api/inventory/items", { name: newItem.name, stock: Number(newItem.stock) }); setNewItem({ name: "", stock: "10" }); }}>
                <label>New item<input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} required /></label>
                <label>Opening stock<input value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })} required /></label>
                <button className="btn ghost" type="submit">Add item</button>
              </form>
            )}
          </article>
        )}

        {staff && (
          <article className="panel-card">
            <h2>Events, sports, and age categories</h2>
            <p className="muted">{session.role === "department" ? `You can add events in ${profile?.district || "your district"}.` : "Administrator event records are stored in the registration database."}</p>
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
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.min_age}–{category.max_age})</option>)}
                </select>
              </label>
              <label>District
                <select value={eventForm.district} onChange={(e) => setEventForm({ ...eventForm, district: e.target.value })}>
                  {DISTRICTS.map((district) => <option key={district}>{district}</option>)}
                </select>
              </label>
              <label>Capacity<input required value={eventForm.capacity} onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })} /></label>
              <label>Registration deadline<input required type="date" value={eventForm.deadline} onChange={(e) => setEventForm({ ...eventForm, deadline: e.target.value })} /></label>
              <label>Event date<input required type="date" value={eventForm.held_on} onChange={(e) => setEventForm({ ...eventForm, held_on: e.target.value })} /></label>
              <button className="btn primary" type="submit">Save event</button>
            </form>
            {session.role === "admin" && (
              <div className="portal-grid">
                <form className="form" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); act("/api/sports", { name: data.get("name") }); e.currentTarget.reset(); }}>
                  <h3>Add a sport</h3>
                  <label>Name<input name="name" required /></label>
                  <button className="btn ghost" type="submit">Add sport</button>
                </form>
                <form className="form" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); act("/api/age-categories", { name: data.get("name"), min_age: Number(data.get("min_age")), max_age: Number(data.get("max_age")) }); e.currentTarget.reset(); }}>
                  <h3>Add an age category</h3>
                  <label>Name<input name="name" required /></label>
                  <label>Minimum age<input name="min_age" required /></label>
                  <label>Maximum age<input name="max_age" required /></label>
                  <button className="btn ghost" type="submit">Add category</button>
                </form>
              </div>
            )}
          </article>
        )}

        {session.role === "admin" && (
          <article className="panel-card">
            <h2>Accounts</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>District</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {users.map((person) => (
                    <tr key={person.id}>
                      <td>{person.name}</td>
                      <td>{person.username}</td>
                      <td>{person.role}</td>
                      <td>{person.district}</td>
                      <td>{person.active ? "Active" : "Inactive"}</td>
                      <td>{person.username !== "admin" && <button className="btn ghost" type="button" onClick={() => act(`/api/users/${person.id}`, { active: !person.active }, "PATCH")}>{person.active ? "Deactivate" : "Activate"}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}

        {reports && (
          <section>
            <h2>Reports</h2>
            <p className="muted">{reports.scope === "all" ? "These counts cover every district." : `These counts cover ${reports.scope} only.`}</p>
            <button className="btn ghost" type="button" onClick={downloadReport}>Download CSV</button>
            <div className="stat-grid">
              {[
                ["Students", reports.students],
                ["Aadhaar verified", reports.verified_students],
                ["Pending registrations", reports.registrations.pending],
                ["Approved", reports.registrations.approved],
                ["Rejected", reports.registrations.rejected],
                ["Participated", reports.participated],
                ["Biometric mismatches", reports.biometric_exceptions],
                ["Certificates", reports.certificates],
                ["Rewards pending", reports.rewards.pending],
                ["Rewards approved", reports.rewards.approved],
                ["Rewards paid", reports.rewards.processed],
                ["Rewards failed", reports.rewards.failed],
                ["Banks validated", reports.bank.validated],
                ["Banks not validated", reports.bank.unvalidated],
                ["Kits pending", reports.kits.pending],
                ["Kits acknowledged", reports.kits.acknowledged],
              ].map(([label, value]) => (
                <article key={label}><b>{value ?? "—"}</b>{label}</article>
              ))}
            </div>
            {Array.isArray(reports.by_district) && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>District</th><th>Students</th></tr></thead>
                  <tbody>
                    {reports.by_district.map((row) => <tr key={row.district}><td>{row.district}</td><td>{row.students}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {session.token && (
          <section className="portal-grid">
            <article className="panel-card">
              <h2>Notices</h2>
              <p className="muted">These rows are sandbox logs. A WhatsApp provider is not connected, so nothing here was delivered to a phone.</p>
              {notifications.length === 0 && <p>No notices yet.</p>}
              {notifications.map((note) => <p key={note.id}>{note.body} · {note.status}</p>)}
            </article>
            <article className="panel-card">
              <h2>Support</h2>
              <form className="form" onSubmit={(e) => { e.preventDefault(); act("/api/support", { subject: ticketSubject, detail: ticketDetail }); setTicketSubject(""); setTicketDetail(""); }}>
                <label>Subject<input required value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} /></label>
                <label>Detail<textarea required rows={3} value={ticketDetail} onChange={(e) => setTicketDetail(e.target.value)} /></label>
                <button className="btn primary" type="submit">Save ticket</button>
              </form>
              {tickets.map((ticket) => (
                <p key={ticket.id}>{ticket.subject} · {ticket.name} · {ticket.status}
                  {staff && ticket.status === "open" ? <button className="btn ghost" type="button" onClick={() => act(`/api/support/${ticket.id}/close`)}>Close</button> : null}
                </p>
              ))}
            </article>
          </section>
        )}

        {canReadAudit && (
          <article className="panel-card">
            <h2>Registration audit trail</h2>
            <p className="muted">Sign-in, failed sign-in, data changes, and administrative actions are stored here with the IP address captured at login. This is the registration-service hash chain. It is separate from the public portal ledger, and it is not an external blockchain.</p>
            <div className="row-actions">
              <button className="btn ghost" type="button" onClick={async () => setAudit(await fetch("/api/audit/verify", { headers }).then((res) => res.json()))}>Verify hash chain</button>
              {session.role === "admin" && <button className="btn primary" type="button" onClick={() => act("/api/audit/anchor")}>Create local checkpoint</button>}
            </div>
            {audit && <p>{audit.ok ? `Local hash chain intact, ${audit.events} events.` : "The local hash chain does not verify."}{audit.ok === undefined ? "" : " This check does not contact an external ledger."}</p>}
            <input className="filter" value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="Filter by person, role, or action" aria-label="Filter registration audit" />
            <div className="table-wrap">
              <table>
                <thead><tr><th>Time</th><th>Person</th><th>Role</th><th>Action</th><th>IP address</th><th>Record</th></tr></thead>
                <tbody>
                  {shownAudit.map((row) => (
                    <tr key={row.id}>
                      <td>{row.time ? new Date(row.time).toLocaleString() : ""}</td>
                      <td>{row.actor}</td>
                      <td>{row.role}</td>
                      <td>{row.action}</td>
                      <td>{row.ip || "—"}</td>
                      <td>{row.entity} {row.entity_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}
      </div>
    </>
  );
}
