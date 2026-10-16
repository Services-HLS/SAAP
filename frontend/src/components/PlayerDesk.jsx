import { useMemo, useState } from "react";
import DeskIcon from "./DeskIcon";
import DeskShell from "./DeskShell";

const WELCOME_COPY =
  "Sports Authority of Andhra Pradesh (SAAP) was established in 1988 under The Andhra Pradesh Sports Authorities Act, 1988 and reconstituted in 1996 and 2010 for promoting sports in Andhra Pradesh. Sports Authority of Andhra Pradesh (SAAP) is a statutory body formed as per AP Sports Act 2010 (Act No. 5 of 2010). Sports Authority of Andhra Pradesh functioning as per Andhra Pradesh Sports Act 2010.";

const CAREER_OPPORTUNITIES = [
  {
    type: "Recruitment",
    title: "Sports-quota police / forest recruitment notices",
    text: "State sports-quota recruitment for eligible medal winners and certified players.",
    href: "/recruitment",
  },
  {
    type: "Scholarship",
    title: "Athlete scholarships and day-boarder support",
    text: "Scholarship pathways under SAAP schemes for women athletes, nurseries, and boarding support.",
    href: "/schemes/day-boarders",
  },
  {
    type: "Coaching",
    title: "Coaching and training opportunities",
    text: "Apply for coaching camps, academy pathways, and Khelo India linked training centres.",
    href: "/training",
  },
  {
    type: "Scheme",
    title: "Project Gaandiva / Paanchajanya",
    text: "Talent identification and high-performance pathways published by SAAP.",
    href: "/schemes/gaandiva",
  },
  {
    type: "Recruitment",
    title: "DSC / companion recruitment updates",
    text: "District sports cadre and companion recruitment notifications.",
    href: "/dsc",
  },
];

const PLAYER_MODULES = [
  {
    id: "dashboard",
    title: "Player Dashboard and History",
    nav: "Dashboard & history",
    blurb: "Show the player's event participation, certificates, reward applications/payments, kit acknowledgements, and current application or verification statuses in one place.",
    icon: "gauge",
  },
  {
    id: "eligible",
    title: "Eligible Events",
    nav: "Eligible events",
    blurb: "Display only events the player appears eligible for based on configured criteria such as age group, sport, district, category, and registration status; explain eligibility where possible.",
    icon: "event",
  },
  {
    id: "career",
    title: "Career Opportunities",
    nav: "Career opportunities",
    blurb: "Publish sports-related opportunities such as sports-quota recruitment notices, scholarships, coaching/training opportunities, and relevant application links.",
    icon: "users",
  },
  {
    id: "kits",
    title: "Kit Acknowledgement",
    nav: "Kit acknowledgement",
    blurb: "Let players view kits allocated to them and acknowledge receipt digitally, with item details, quantity, date, and acknowledgement history.",
    icon: "box",
  },
  {
    id: "grievance",
    title: "Grievance Submission and Tracking",
    nav: "Grievances",
    blurb: "Allow players to submit a grievance, attach supporting files, receive a reference number, track progress, and view responses or resolution details.",
    icon: "handshake",
  },
];

function playerCode(profile) {
  if (profile?.reference_no) {
    const digits = String(profile.reference_no).replace(/\D/g, "");
    if (digits) return `P${digits.padStart(8, "0").slice(-8)}`;
  }
  if (profile?.student_id) return `P${String(10000000 + profile.student_id)}`;
  return "P10000000";
}

function formatDob(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}-${m}-${y}`;
}

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value).slice(0, 16);
  }
}

export default function PlayerDesk({
  profile,
  rewards = [],
  certificates = [],
  registrations = [],
  events = [],
  inventory = { items: [], acknowledgements: [] },
  tickets = [],
  notifications = [],
  notice,
  error,
  otp,
  setOtp,
  sandboxOtp,
  setSandboxOtp,
  amount,
  setAmount,
  bankLast4,
  setBankLast4,
  act,
  signOut,
}) {
  const [view, setView] = useState("home");
  const [profileTab, setProfileTab] = useState("personal");
  const [incentiveFilter, setIncentiveFilter] = useState("");
  const [grievanceSubject, setGrievanceSubject] = useState("");
  const [grievanceDetail, setGrievanceDetail] = useState("");
  const [grievanceFile, setGrievanceFile] = useState("");
  const [lastGrievanceRef, setLastGrievanceRef] = useState("");

  const code = playerCode(profile);
  const pendingKits = inventory.acknowledgements.filter((a) => a.status === "pending");
  const openGrievances = tickets.filter((t) => t.status === "open");
  const eligibleEvents = useMemo(() => events.filter((event) => event.eligible), [events]);
  const ineligibleEvents = useMemo(() => events.filter((event) => event.eligible === false), [events]);

  const filteredRewards = useMemo(() => {
    const q = incentiveFilter.trim().toLowerCase();
    if (!q) return rewards;
    return rewards.filter((row) => `${row.amount} ${row.status} ${row.bank_status} ${row.payment_reference || ""}`.toLowerCase().includes(q));
  }, [rewards, incentiveFilter]);

  const sections = [
    {
      label: "Overview",
      items: [
        { id: "home", label: "Home", icon: "home" },
        { id: "welcome", label: "Welcome", icon: "shield" },
        { id: "profile", label: "Player Profile", icon: "user" },
      ],
    },
    {
      label: "Player modules",
      items: PLAYER_MODULES.map((mod) => ({
        id: mod.id,
        label: mod.nav || mod.title,
        icon: mod.icon,
        badge:
          mod.id === "kits" && pendingKits.length
            ? pendingKits.length
            : mod.id === "grievance" && openGrievances.length
              ? openGrievances.length
              : mod.id === "eligible" && eligibleEvents.length
                ? eligibleEvents.length
                : undefined,
      })),
    },
    {
      label: "More apps",
      items: [
        { id: "rewards", label: "Rewards", icon: "rupee" },
        { id: "certificates", label: "Certificates", icon: "certificate" },
      ],
    },
  ];

  const titles = {
    home: "Player desk",
    welcome: "Welcome",
    profile: "Player profile",
    dashboard: "Player Dashboard and History",
    eligible: "Eligible Events",
    career: "Career Opportunities",
    kits: "Kit Acknowledgement",
    grievance: "Grievance Submission and Tracking",
    rewards: "Rewards",
    certificates: "Certificates",
  };

  async function submitGrievance(event) {
    event.preventDefault();
    const attachment = grievanceFile ? `\n\n[Supporting file] ${grievanceFile}` : "";
    const data = await act("/api/support", {
      subject: grievanceSubject,
      detail: `${grievanceDetail}${attachment}`,
    });
    if (data?.id) {
      setLastGrievanceRef(`GRV-${String(data.id).padStart(6, "0")}`);
      setGrievanceSubject("");
      setGrievanceDetail("");
      setGrievanceFile("");
    }
  }

  return (
    <DeskShell
      brandTitle="SAAP"
      brandSubtitle="PLAYER DESK"
      userName={profile?.name || "Player"}
      roleLabel="player"
      sections={sections}
      activeId={view}
      onNavigate={setView}
      onSignOut={signOut}
      notice={notice}
      error={error}
    >
      <div className="saap-desk-pagehead">
        <h2>{titles[view] || "Player desk"}</h2>
      </div>

      {view === "home" && (
        <>
          <p className="muted admin-desk-intro">
            Signed in as {profile?.name} · {code}
            {profile?.district ? ` · ${profile.district}` : ""}. Open a module below — same application layout as the admin desk.
          </p>
          <div className="admin-module-grid">
            {PLAYER_MODULES.map((mod) => (
              <button key={mod.id} type="button" className="admin-module-card" onClick={() => setView(mod.id)}>
                <span className="admin-module-icon"><DeskIcon name={mod.icon} /></span>
                <strong>{mod.title}</strong>
                <p>{mod.blurb}</p>
                {mod.id === "dashboard" && <em>{registrations.length} registrations · {certificates.length} certificates</em>}
                {mod.id === "eligible" && <em>{eligibleEvents.length} eligible now</em>}
                {mod.id === "career" && <em>{CAREER_OPPORTUNITIES.length} opportunities</em>}
                {mod.id === "kits" && <em>{pendingKits.length} awaiting acknowledgement</em>}
                {mod.id === "grievance" && <em>{openGrievances.length} open</em>}
              </button>
            ))}
          </div>
        </>
      )}

      {view === "welcome" && (
        <>
          <div className="saap-desk-welcome-chip">Welcome {code}</div>
          <article className="saap-desk-card saap-desk-welcome-card">
            <h2>Welcome to Sports Authority of Andhra Pradesh</h2>
            <div className="saap-desk-welcome-grid">
              <p>{WELCOME_COPY}</p>
              <img src="/saap-logo.png" alt="Sports Authority of Andhra Pradesh" />
            </div>
          </article>
        </>
      )}

      {view === "dashboard" && (
        <article className="saap-desk-card">
          <p className="muted">{PLAYER_MODULES[0].blurb}</p>
          <div className="stat-grid admin-stat-grid">
            {[
              ["Registrations", registrations.length],
              ["Participated", registrations.filter((r) => r.participation === "present").length],
              ["Certificates", certificates.length],
              ["Rewards", rewards.length],
              ["Kits pending", pendingKits.length],
              ["Aadhaar", profile?.aadhaar_verified ? "Verified" : "Pending"],
              ["Mobile", profile?.phone_verified ? "Verified" : "Pending"],
              ["Open grievances", openGrievances.length],
            ].map(([label, value]) => (
              <article key={label}><b>{value}</b>{label}</article>
            ))}
          </div>

          <h3>Verification status</h3>
          <dl className="saap-desk-dl">
            <div><dt>Player ID</dt><dd>{code}{profile?.reference_no ? ` · ${profile.reference_no}` : ""}</dd></div>
            <div><dt>Aadhaar</dt><dd>{profile?.aadhaar_verified ? `Verified ${profile.aadhaar_masked || ""}` : "Not verified — complete OTP in Profile"}</dd></div>
            <div><dt>Mobile</dt><dd>{profile?.phone || "—"} · {profile?.phone_verified ? "verified" : "not verified"}</dd></div>
            <div><dt>Bank</dt><dd>{profile?.bank_name ? `${profile.bank_name} ****${profile.bank_last4} (${profile.bank_status})` : "Not on file"}</dd></div>
          </dl>

          <h3>Event participation</h3>
          <ul className="saap-desk-list">
            {registrations.length === 0 && <li className="saap-desk-empty">No event applications yet.</li>}
            {registrations.map((row) => (
              <li key={row.id}>
                <strong>{row.event}</strong> · {row.sport || "Sport"} · {row.district} · application <em>{row.status}</em>
                {row.participation ? ` · attendance ${row.participation}` : " · attendance not recorded"}
              </li>
            ))}
          </ul>

          <h3>Certificates</h3>
          <ul className="saap-desk-list">
            {certificates.length === 0 && <li className="saap-desk-empty">No certificates yet.</li>}
            {certificates.map((cert) => (
              <li key={cert.reference_no}><strong>{cert.reference_no}</strong> · {cert.title} · {cert.status}{cert.issued_at ? ` · ${String(cert.issued_at).slice(0, 10)}` : ""}</li>
            ))}
          </ul>

          <h3>Reward applications / payments</h3>
          <ul className="saap-desk-list">
            {rewards.length === 0 && <li className="saap-desk-empty">No reward applications.</li>}
            {rewards.map((row) => (
              <li key={row.id}>₹{row.amount} · {row.status} · bank ****{row.bank_last4} ({row.bank_status}){row.payment_reference ? ` · ${row.payment_reference}` : ""}</li>
            ))}
          </ul>

          <h3>Kit acknowledgements</h3>
          <ul className="saap-desk-list">
            {inventory.acknowledgements.length === 0 && <li className="saap-desk-empty">No kit issues yet.</li>}
            {inventory.acknowledgements.map((ack) => (
              <li key={ack.id}>{ack.item} · qty {ack.quantity} · {ack.status}{ack.issued_at ? ` · issued ${String(ack.issued_at).slice(0, 10)}` : ""}</li>
            ))}
          </ul>
        </article>
      )}

      {view === "eligible" && (
        <article className="saap-desk-card">
          <p className="muted">{PLAYER_MODULES[1].blurb}</p>
          {!profile?.aadhaar_verified && (
            <p className="admin-alert">Aadhaar verification is pending. Eligible events can be listed, but registration usually requires a verified profile.</p>
          )}
          <h3>Events you appear eligible for</h3>
          <ul className="saap-desk-list">
            {eligibleEvents.length === 0 && <li className="saap-desk-empty">No eligible events match your age group, sport, district, or category right now.</li>}
            {eligibleEvents.map((event) => {
              const mine = registrations.find((row) => row.event_id === event.id);
              return (
                <li key={event.id}>
                  <div>
                    <strong>{event.name}</strong> · {event.sport} · {event.category} · ages {event.min_age}–{event.max_age}
                    <p className="desk-status is-ok">{event.eligibility_note || "You meet the configured eligibility checks for this event."}</p>
                    <p className="muted">{event.venue}, {event.district} · closes {String(event.deadline || "").slice(0, 10)} · {event.registered ?? "—"}/{event.capacity} places</p>
                    {mine && <p className="muted">Your application status: {mine.status}{mine.participation ? ` · attendance ${mine.participation}` : ""}</p>}
                  </div>
                  {profile?.aadhaar_verified && !mine && (
                    <button type="button" className="saap-desk-primary" onClick={() => act("/api/events/register", { event_id: event.id })}>Register</button>
                  )}
                </li>
              );
            })}
          </ul>
          {ineligibleEvents.length > 0 && (
            <>
              <h3>Other listed events (not eligible)</h3>
              <ul className="saap-desk-list">
                {ineligibleEvents.map((event) => (
                  <li key={event.id}>
                    <strong>{event.name}</strong> · {event.sport} · {event.category}
                    <p className="desk-status is-bad">{event.eligibility_note || "You do not match age, district, category, or registration rules for this event."}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      )}

      {view === "career" && (
        <article className="saap-desk-card">
          <p className="muted">{PLAYER_MODULES[2].blurb}</p>
          <ul className="saap-desk-list">
            {CAREER_OPPORTUNITIES.map((item) => (
              <li key={item.title}>
                <div>
                  <em className="player-career-type">{item.type}</em>
                  <strong> {item.title}</strong>
                  <p className="muted">{item.text}</p>
                </div>
                <a className="saap-desk-primary" href={item.href}>Open application / notice</a>
              </li>
            ))}
          </ul>
        </article>
      )}

      {view === "kits" && (
        <article className="saap-desk-card">
          <p className="muted">{PLAYER_MODULES[3].blurb}</p>
          <h3>Awaiting your acknowledgement</h3>
          <ul className="saap-desk-list">
            {pendingKits.length === 0 && <li className="saap-desk-empty">No kits waiting for acknowledgement.</li>}
            {pendingKits.map((ack) => (
              <li key={ack.id}>
                <div>
                  <strong>{ack.item}</strong>
                  <p className="muted">Quantity {ack.quantity} · issued {ack.issued_at ? String(ack.issued_at).slice(0, 10) : "—"} · status {ack.status}</p>
                </div>
                <button type="button" className="saap-desk-primary" onClick={() => act(`/api/inventory/ack/${ack.id}`)}>Acknowledge receipt</button>
              </li>
            ))}
          </ul>
          <h3>Acknowledgement history</h3>
          <div className="table-wrap">
            <table className="saap-desk-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Issued</th><th>Status</th></tr></thead>
              <tbody>
                {inventory.acknowledgements.length === 0 && <tr><td colSpan={4} className="saap-desk-empty">No kit history.</td></tr>}
                {inventory.acknowledgements.map((ack) => (
                  <tr key={ack.id}>
                    <td>{ack.item}</td>
                    <td>{ack.quantity}</td>
                    <td>{ack.issued_at ? String(ack.issued_at).slice(0, 10) : "—"}</td>
                    <td><em className={`kit-status is-${ack.status}`}>{ack.status}</em></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {view === "grievance" && (
        <article className="saap-desk-card">
          <p className="muted">{PLAYER_MODULES[4].blurb}</p>
          {lastGrievanceRef && <p className="ok">Grievance saved. Reference number: <strong>{lastGrievanceRef}</strong></p>}
          <form className="form" onSubmit={submitGrievance}>
            <label>Subject<input required value={grievanceSubject} onChange={(e) => setGrievanceSubject(e.target.value)} placeholder="Brief subject" /></label>
            <label>Detail<textarea required rows={4} value={grievanceDetail} onChange={(e) => setGrievanceDetail(e.target.value)} placeholder="Describe the issue, dates, and what resolution you need" /></label>
            <label>Supporting file
              <input
                type="file"
                onChange={(e) => setGrievanceFile(e.target.files?.[0]?.name || "")}
              />
            </label>
            {grievanceFile && <p className="muted">Attached for this demo record: {grievanceFile}</p>}
            <button className="saap-desk-primary" type="submit">Submit grievance</button>
          </form>
          <h3>Track progress</h3>
          <ul className="saap-desk-list">
            {tickets.length === 0 && <li className="saap-desk-empty">No grievances submitted yet.</li>}
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <div>
                  <strong>GRV-{String(ticket.id).padStart(6, "0")}</strong> · {ticket.subject} · <em>{ticket.status}</em>
                  <p className="muted">{ticket.detail}</p>
                  <p className="muted">
                    {ticket.status === "open"
                      ? "In progress — SAAP staff will respond. Typical acknowledgement within 2 working days."
                      : "Resolved / closed. Review the detail above for resolution notes."}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </article>
      )}

      {view === "profile" && (
        <article className="saap-desk-card saap-desk-profile-card">
          <div className="saap-desk-profile-summary">
            <p className="saap-desk-pid">{code}</p>
            <div className="saap-desk-photo"><img src="/saap-logo.png" alt="" /></div>
            <p className="saap-desk-pname">{profile?.name}</p>
            <p>Gender: {profile?.gender || "—"}</p>
            <p>Date of Birth: {formatDob(profile?.dob)}</p>
          </div>
          <div className="saap-desk-profile-detail">
            <div className="saap-desk-tabs">
              {[
                ["personal", "Personal details"],
                ["communication", "Communication details"],
                ["bank", "Bank details"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={profileTab === id ? "is-on" : ""} onClick={() => setProfileTab(id)}>{label}</button>
              ))}
            </div>
            {profileTab === "personal" && (
              <dl className="saap-desk-dl">
                <div><dt>Full name</dt><dd>{profile?.name}</dd></div>
                <div><dt>Email id</dt><dd>{profile?.email || "—"}</dd></div>
                <div><dt>Mobile</dt><dd>{profile?.phone || "—"}</dd></div>
                <div><dt>District</dt><dd>{profile?.district || "—"}</dd></div>
                <div><dt>Aadhaar</dt><dd>{profile?.aadhaar_masked || "Not verified"}{profile?.aadhaar_verified ? " (verified)" : ""}</dd></div>
              </dl>
            )}
            {profileTab === "communication" && (
              <dl className="saap-desk-dl">
                <div><dt>Mobile</dt><dd>{profile?.phone || "—"}</dd></div>
                <div><dt>Email</dt><dd>{profile?.email || "—"}</dd></div>
              </dl>
            )}
            {profileTab === "bank" && (
              <dl className="saap-desk-dl">
                <div><dt>Bank name</dt><dd>{profile?.bank_name || "—"}</dd></div>
                <div><dt>Account last 4</dt><dd>{profile?.bank_last4 ? `****${profile.bank_last4}` : "—"}</dd></div>
                <div><dt>Status</dt><dd>{profile?.bank_status || "—"}</dd></div>
              </dl>
            )}
            {!profile?.aadhaar_verified && (
              <div className="saap-desk-aadhaar">
                <h3>Aadhaar OTP</h3>
                <div className="saap-desk-inline-form">
                  <button type="button" className="saap-desk-primary" onClick={async () => { const data = await act("/api/students/me/otp"); if (data?.sandbox_otp) setSandboxOtp(data.sandbox_otp); }}>Request OTP</button>
                  <label>Enter code<input value={otp} onChange={(e) => setOtp(e.target.value)} /></label>
                  <button type="button" className="saap-desk-ghost" onClick={() => act("/api/students/me/otp/verify", { otp })}>Verify</button>
                </div>
                {sandboxOtp && <p className="muted">Sandbox code: {sandboxOtp}</p>}
              </div>
            )}
          </div>
        </article>
      )}

      {view === "rewards" && (
        <article className="saap-desk-card saap-desk-table-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="saap-desk-pagehead" style={{ padding: "16px 16px 0" }}>
            <h2 style={{ fontSize: "1.1rem" }}>Rewards</h2>
            <button type="button" className="saap-desk-primary" onClick={() => act("/api/rewards", { amount: Number(amount || 1500), bank_last4: bankLast4 || profile?.bank_last4 || "" })}>+ Request</button>
          </div>
          <div className="saap-desk-filterbar">
            <input value={incentiveFilter} onChange={(e) => setIncentiveFilter(e.target.value)} placeholder="Filter..." />
          </div>
          <div className="saap-desk-table-wrap">
            <table className="saap-desk-table">
              <thead><tr><th>Amount</th><th>Bank</th><th>Status</th><th>Reference</th></tr></thead>
              <tbody>
                {filteredRewards.length === 0 && <tr><td colSpan={4} className="saap-desk-empty">No Rows To Show</td></tr>}
                {filteredRewards.map((row) => (
                  <tr key={row.id}>
                    <td>₹{row.amount}</td>
                    <td>****{row.bank_last4}</td>
                    <td>{row.status}</td>
                    <td>{row.payment_reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="saap-desk-inline-form" onSubmit={(e) => { e.preventDefault(); act("/api/rewards", { amount: Number(amount), bank_last4: bankLast4 }); }}>
            <label>Amount (₹)<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label>Account last 4<input pattern="[0-9]{4}" value={bankLast4} onChange={(e) => setBankLast4(e.target.value)} /></label>
            <button className="saap-desk-primary" type="submit">Submit</button>
          </form>
        </article>
      )}

      {view === "certificates" && (
        <article className="saap-desk-card">
          <ul className="saap-desk-list">
            {certificates.length === 0 && <li className="saap-desk-empty">No certificates yet.</li>}
            {certificates.map((cert) => (
              <li key={cert.reference_no}><strong>{cert.reference_no}</strong> · {cert.title} · {cert.status}</li>
            ))}
          </ul>
        </article>
      )}

      {notifications.length > 0 && view === "home" && (
        <p className="muted" style={{ marginTop: 12 }}>{notifications.length} notice(s) on file · last update {formatWhen(notifications[0]?.created_at)}</p>
      )}
    </DeskShell>
  );
}
