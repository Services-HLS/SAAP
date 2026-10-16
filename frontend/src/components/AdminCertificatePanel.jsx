import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SAAP_EVENT_REPORTS } from "../data/saapReports";
import { buildEventPlayers, loadVerifyMap } from "../data/saapEventPlayers";

const LOCAL_CERT_KEY = "saap-admin-local-certs";

export const CERT_TEMPLATES = [
  {
    id: "classic",
    label: "Classic participation",
    blurb: "Traditional SAAP border with gold corners.",
    defaultTitle: "Certificate of Participation",
  },
  {
    id: "merit",
    label: "Merit / achievement",
    blurb: "Gold ribbon style for standout performance.",
    defaultTitle: "Certificate of Merit",
  },
  {
    id: "modern",
    label: "Modern SAAP",
    blurb: "Clean navy layout for contemporary events.",
    defaultTitle: "Certificate of Appreciation",
  },
];

const EMPTY_DRAFT = {
  title: "Certificate of Participation",
  intro: "This is to certify that",
  student: "",
  event: "",
  sport: "",
  district: "",
  village: "",
  aadhaar: "",
  venue: "",
  body: "has successfully participated in the event organised under the Sports Authority of Andhra Pradesh (SAAP).",
  issuerName: "",
  issuerTitle: "Collector",
  issuerRole: "admin",
  registerMethod: "aadhaar",
  biometricVerified: "yes",
  issuedOn: "",
  reference_no: "",
};

function findEventMeta(eventName) {
  const row = SAAP_EVENT_REPORTS.find((e) => e.name === eventName);
  if (!row) return null;
  const dates = row.start && row.end
    ? `${row.start} → ${row.end}`
    : (row.start || row.end || "");
  return {
    ...row,
    dates,
    level: row.level || (row.name?.toLowerCase().includes("national") ? "National" : row.name?.toLowerCase().includes("state") ? "State" : "SAAP event"),
  };
}

function issuerDisplay(cert, issuerName) {
  const name = issuerName || cert?.issued_by_name || cert?.issued_by?.name || "—";
  const title = cert?.issuer_title || cert?.issued_by_title || "";
  if (title) return `${name} (${title})`;
  const role = cert?.issued_by_role || cert?.issued_by?.role || "";
  if (role && role !== "admin") return `${name} (${role})`;
  if (role === "admin") return `${name} (Administrator)`;
  return name;
}

function makeDigitalSignature(payload) {
  const raw = [
    payload.reference_no,
    payload.student,
    payload.event,
    payload.sport,
    payload.issued_at,
    payload.issuerName,
  ].join("|");
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
  return `SAAP-DS-${hex}-${String(payload.reference_no || "X").slice(-4)}`;
}

async function detectClientIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) return data.ip;
    }
  } catch {
    /* ignore */
  }
  return "Unavailable (client network)";
}

function loadLocalCerts() {
  try {
    const raw = localStorage.getItem(LOCAL_CERT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalCerts(rows) {
  try {
    localStorage.setItem(LOCAL_CERT_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function makeLocalQr(referenceNo) {
  const url = `${window.location.origin}/cert/${encodeURIComponent(referenceNo)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
}

function formatIssuedOn(value) {
  if (!value) {
    return new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function CertificateTemplate({ cert, issuerName, templateId = "classic" }) {
  if (!cert) return null;
  const tpl = templateId || cert.template || "classic";
  const qrSrc = cert.qr?.startsWith("http") || cert.qr?.startsWith("data:")
    ? cert.qr
    : (cert.qr || makeLocalQr(cert.reference_no));
  const issuer = issuerName || cert.issued_by_name || cert.issued_by?.name || "Authorised Officer";
  const issuedOn = cert.issued_on_label || formatIssuedOn(cert.issued_at);
  const title = cert.cert_title || cert.title_line || (
    tpl === "merit" ? "Certificate of Merit" : tpl === "modern" ? "Certificate of Appreciation" : "Certificate of Participation"
  );
  const intro = cert.intro || "This is to certify that";
  const body = cert.body || (
    <>
      has successfully participated in
      {" "}
      <em>{cert.event || cert.title}</em>
      {cert.sport ? <> in the discipline of <strong>{cert.sport}</strong></> : null}
      {cert.district ? <> representing <strong>{cert.district}</strong></> : null}
      , organised under the Sports Authority of Andhra Pradesh (SAAP).
    </>
  );

  return (
    <article className={`cert-template is-${tpl}`} aria-label={title}>
      <div className="cert-sheet">
        <div className="cert-ornament cert-ornament-tl" aria-hidden="true" />
        <div className="cert-ornament cert-ornament-tr" aria-hidden="true" />
        <div className="cert-ornament cert-ornament-bl" aria-hidden="true" />
        <div className="cert-ornament cert-ornament-br" aria-hidden="true" />

        <header className="cert-classic-head">
          <div className="cert-logo-wrap">
            <img
              src="/saap-logo.png"
              alt="Sports Authority of Andhra Pradesh"
              className="cert-logo"
              width="420"
              height="50"
            />
          </div>
          <p className="cert-gov">Government of Andhra Pradesh</p>
          <h3 className="cert-title">{title}</h3>
          <p className="cert-ribbon" aria-hidden="true">{tpl === "merit" ? "★★ MERIT ★★" : "★★★"}</p>
        </header>

        <p className="cert-body cert-intro">{intro}</p>
        <p className="cert-name">{cert.student}</p>
        <p className="cert-body cert-prose">
          {typeof body === "string" ? (
            <>
              {body}
              {" "}
              {cert.event || cert.title ? <em>{cert.event || cert.title}</em> : null}
              {cert.sport ? <> · <strong>{cert.sport}</strong></> : null}
              {cert.district ? <> · <strong>{cert.district}</strong></> : null}
              {cert.venue ? <> · Venue: <strong>{cert.venue}</strong></> : null}
            </>
          ) : body}
        </p>

        <div className="cert-classic-meta">
          <p><span>Certificate No.</span> {cert.reference_no || "— pending —"}</p>
          <p><span>Date of issue</span> {issuedOn}</p>
          {cert.village ? <p><span>Village</span> {cert.village}</p> : null}
          {cert.aadhaar ? <p><span>Aadhaar</span> {cert.aadhaar}</p> : null}
        </div>

        <div className="cert-sign-row">
          <div className="cert-sign">
            <div className="cert-qr-mini">
              <img src={qrSrc} alt={`QR for ${cert.reference_no || "draft"}`} width="96" height="96" />
            </div>
            <em>Scan to verify</em>
          </div>
          <div className="cert-seal" aria-hidden="true">
            <span>SAAP</span>
            <small>Official Seal</small>
          </div>
          <div className="cert-sign">
            <strong>{issuerDisplay(cert, issuer)}</strong>
            <em>Generated / authorised by</em>
            <em>{cert.issuer_title || cert.issued_by_title || cert.issued_by_role || cert.issued_by?.role || "Administrator"}</em>
          </div>
        </div>

        <div className="cert-dsign-badge" aria-label="Digital signature">
          <span className="cert-dsign-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="40" height="40">
              <circle cx="24" cy="24" r="22" fill="#ecfdf5" stroke="#047857" strokeWidth="2" />
              <path d="M14 25l6 6 14-14" fill="none" stroke="#047857" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M30 14h6v6" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
              <path d="M18 34H12v-6" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <strong>Digitally signed</strong>
            <em>{cert.digital_signature || "Signature attached on issue"}</em>
          </div>
        </div>

        <footer className="cert-foot">
          This certificate is digitally issued by SAAP. Authenticity can be verified by scanning the QR code.
          {cert.digital_signature ? <> Digital signature: <span className="cert-mono">{cert.digital_signature}</span></> : null}
        </footer>
      </div>
    </article>
  );
}

function shortHash(label, seed = "") {
  const raw = `${label}|${seed}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function CertificateBlockchainTrail({ cert }) {
  if (!cert || cert.status === "draft") return null;
  const method = (cert.register_method || cert.registration_method || "").toLowerCase();
  const authLabel = method === "biometric" || method === "bio-metric"
    ? "Bio-Metric"
    : method === "aadhaar" || method === "otp" || !method
      ? "Aadhaar OTP"
      : String(cert.register_method || cert.registration_method);
  const bioOk = cert.biometric_verified === true || cert.biometric_verified === "yes" || cert.biometric_verified === "verified";
  const issuedAt = cert.issued_at
    ? new Date(cert.issued_at).toLocaleString()
    : (cert.issued_on_label || "—");
  const ref = cert.reference_no || "SAAP";
  const playerName = cert.student || "Player";
  const issuerName = cert.issued_by_name || cert.issued_by?.name || "Portal Administrator";
  const issuerRole = cert.issued_by_role || cert.issued_by?.role || cert.issuer_title || "admin";
  const ipAddress = cert.ip_address || cert.generated_ip || "—";
  const location = [cert.village, cert.district, cert.venue].filter(Boolean).join(" · ") || cert.district || "—";

  const steps = [
    {
      id: 1,
      title: "Player registered",
      detail: `${playerName} via ${authLabel}`,
      fields: {
        name: playerName,
        role: "Player",
        ip: ipAddress,
        authentication: authLabel,
        timestamp: issuedAt,
        location,
      },
      hash: shortHash("reg", `${ref}|${cert.student}|${method}`),
      tone: "ok",
    },
    {
      id: 2,
      title: "Identity verified",
      detail: bioOk ? "Biometric / Aadhaar check complete" : "Verification pending or not recorded",
      fields: {
        name: playerName,
        role: "Player",
        ip: ipAddress,
        authentication: authLabel,
        timestamp: issuedAt,
        location,
      },
      hash: shortHash("id", `${ref}|${cert.biometric_verified}`),
      tone: bioOk ? "ok" : "warn",
    },
    {
      id: 3,
      title: "Event participation",
      detail: `${cert.event || cert.title || "Event"} · ${cert.sport || "Sport"}`,
      fields: {
        name: playerName,
        role: "Player",
        ip: ipAddress,
        authentication: authLabel,
        timestamp: issuedAt,
        location: cert.venue || location,
      },
      hash: shortHash("evt", `${ref}|${cert.event}|${cert.sport}`),
      tone: "ok",
    },
    {
      id: 4,
      title: "Certificate generated",
      detail: `IP ${ipAddress} · ${issuedAt}`,
      fields: {
        name: issuerName,
        role: issuerRole,
        ip: ipAddress,
        authentication: authLabel,
        timestamp: issuedAt,
        location,
      },
      hash: shortHash("gen", `${ref}|${ipAddress}|${cert.issued_at}`),
      tone: "ok",
    },
    {
      id: 5,
      title: "Digitally signed",
      detail: cert.digital_signature || "SAAP digital seal applied",
      fields: {
        name: issuerName,
        role: issuerRole,
        ip: ipAddress,
        authentication: authLabel,
        timestamp: issuedAt,
        location,
      },
      hash: shortHash("sig", cert.digital_signature || ref),
      tone: cert.digital_signature ? "ok" : "warn",
    },
    {
      id: 6,
      title: "Ledger anchored",
      detail: `Integrity ${cert.integrity || "ok"} · ready to verify`,
      fields: {
        name: issuerName,
        role: issuerRole,
        ip: ipAddress,
        authentication: authLabel,
        timestamp: issuedAt,
        location,
      },
      hash: shortHash("led", `${ref}|${cert.integrity}`),
      tone: "ok",
    },
  ];

  // Snake layout so block 3 drops to block 4 (right column), then 5 ← 4, 6 ← 5:
  // [1]—[2]—[3]
  //           |
  // [6]—[5]—[4]
  const top = steps.slice(0, 3);
  const bottomVisual = [steps[5], steps[4], steps[3]]; // display L→R as 6,5,4

  function ChainLink({ vertical = false }) {
    return (
      <span className={`cert-chain-link ${vertical ? "is-v" : "is-h"}`} aria-hidden="true">
        <span className="cert-chain-rail" />
        <svg className="cert-chain-svg" viewBox="0 0 48 28" width="38" height="22">
          {/* interlocking chain links — visible between compact blocks */}
          <ellipse cx="15" cy="14" rx="11" ry="7.5" fill="none" stroke="currentColor" strokeWidth="2.8" />
          <ellipse cx="33" cy="14" rx="11" ry="7.5" fill="none" stroke="currentColor" strokeWidth="2.8" />
          <path d="M22 10.5h4M22 17.5h4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <span className="cert-chain-rail" />
      </span>
    );
  }

  function BlockCard({ step, prevHash }) {
    const fields = step.fields || {};
    return (
      <article className={`cert-chain-box is-${step.tone}`}>
        <header>
          <span className="cert-chain-num">Block {step.id}</span>
          <strong>{step.title}</strong>
        </header>
        <p>{step.detail}</p>
        <dl className="cert-chain-meta">
          <div><dt>Name</dt><dd title={fields.name}>{fields.name || "—"}</dd></div>
          <div><dt>Role</dt><dd title={fields.role}>{fields.role || "—"}</dd></div>
          <div><dt>IP address</dt><dd title={fields.ip}>{fields.ip || "—"}</dd></div>
          <div><dt>Auth</dt><dd title={fields.authentication}>{fields.authentication || "—"}</dd></div>
          <div><dt>Timestamp</dt><dd title={fields.timestamp}>{fields.timestamp || "—"}</dd></div>
          <div><dt>Location</dt><dd title={fields.location}>{fields.location || "—"}</dd></div>
        </dl>
        <code title="Block hash">{step.hash}</code>
        {prevHash ? <em>prev → {prevHash}</em> : <em>genesis block</em>}
      </article>
    );
  }

  return (
    <section className="cert-chain" aria-label="Certificate blockchain trail">
      <div className="cert-chain-head">
        <div>
          <p className="cert-chain-kicker">SAAP ledger</p>
          <h3>Blockchain process trail</h3>
          <p>Linked blocks from registration → identity → event → issue → signature → ledger anchor.</p>
        </div>
      </div>

      {/* Desktop snake: 1—2—3 then down to 4, then 5—6 leftward as [6][5][4] */}
      <div className="cert-chain-diagram is-desktop">
        <ol className="cert-chain-row is-top">
          {top.map((step, i) => (
            <li key={step.id} className="cert-chain-step">
              {i > 0 && <ChainLink />}
              <BlockCard step={step} prevHash={i > 0 ? steps[i - 1].hash : null} />
            </li>
          ))}
        </ol>

        <div className="cert-chain-bridge" aria-hidden="true">
          <span className="cert-chain-bridge-spacer" />
          <span className="cert-chain-bridge-spacer" />
          <ChainLink vertical />
        </div>

        <ol className="cert-chain-row is-bottom">
          {bottomVisual.map((step, i) => {
            const prevHash = step.id === 4 ? steps[2].hash : steps[step.id - 2].hash;
            return (
              <li key={`b-${step.id}`} className="cert-chain-step">
                {i > 0 && <ChainLink />}
                <BlockCard step={step} prevHash={prevHash} />
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mobile: straight 1→6 column */}
      <ol className="cert-chain-diagram is-mobile">
        {steps.map((step, i) => (
          <li key={`m-${step.id}`} className="cert-chain-step is-stack">
            {i > 0 && <ChainLink vertical />}
            <BlockCard step={step} prevHash={i > 0 ? steps[i - 1].hash : null} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function CertificateVerifyPanel({ cert, issuerName }) {
  if (!cert) return null;
  const method = (cert.register_method || cert.registration_method || "").toLowerCase();
  const methodLabel = method === "biometric" || method === "bio-metric"
    ? "Bio-Metric"
    : method === "aadhaar" || method === "otp"
      ? "Aadhaar OTP"
      : (cert.register_method || cert.registration_method || "Not recorded");
  const bioRaw = cert.biometric_verified ?? cert.biometricVerified;
  const bioLabel = bioRaw === true || bioRaw === "yes" || bioRaw === "verified"
    ? "Verified"
    : bioRaw === false || bioRaw === "no" || bioRaw === "pending"
      ? "Not verified"
      : (bioRaw || "Not recorded");
  const eventMeta = cert.event_meta || findEventMeta(cert.event || cert.title) || {};

  return (
    <section className="cert-verify-block" aria-label="Verify certificate">
      <div className="cert-verify-block-head">
        <h3>Verify certificate</h3>
        <p>Public check of this certificate — player, event, integrity and who generated it.</p>
      </div>
      <div className="cert-verify-status ok">
        Certificate record found · status {cert.status || "issued"} · integrity {cert.integrity || "ok"}
        {cert.digital_signature ? " · digitally signed" : ""}
      </div>

      <h4 className="cert-verify-section">Player &amp; registration</h4>
      <dl className="cert-verify-dl">
        <div><dt>Reference</dt><dd>{cert.reference_no}</dd></div>
        <div><dt>Template</dt><dd>{cert.template || "classic"}</dd></div>
        <div><dt>Player</dt><dd>{cert.student}</dd></div>
        <div><dt>District</dt><dd>{cert.district || "—"}</dd></div>
        <div><dt>Village</dt><dd>{cert.village || "—"}</dd></div>
        <div><dt>Aadhaar</dt><dd>{cert.aadhaar || "—"}</dd></div>
        <div><dt>Registered by</dt><dd>{methodLabel}</dd></div>
        <div><dt>Biometric verified</dt><dd>{bioLabel}</dd></div>
        <div><dt>Sport</dt><dd>{cert.sport || "—"}</dd></div>
        <div><dt>Participation</dt><dd>{cert.participation?.status || cert.participation || "present"}</dd></div>
      </dl>

      <h4 className="cert-verify-section">Event details</h4>
      <dl className="cert-verify-dl">
        <div className="cert-verify-span"><dt>Event</dt><dd>{cert.event || cert.title || "—"}</dd></div>
        <div><dt>Year</dt><dd>{cert.event_year || eventMeta.year || "—"}</dd></div>
        <div><dt>Status</dt><dd>{cert.event_status || eventMeta.status || "—"}</dd></div>
        <div className="cert-verify-span"><dt>Venue</dt><dd>{cert.venue || eventMeta.venue || "—"}</dd></div>
        <div className="cert-verify-span"><dt>Organised by</dt><dd>{cert.organised_by || eventMeta.organisedBy || "Sports Authority of Andhra Pradesh (SAAP)"}</dd></div>
        <div className="cert-verify-span"><dt>Conducted by</dt><dd>{cert.conducted_by || eventMeta.conductedBy || "—"}</dd></div>
        {(cert.event_level || eventMeta.level) && (
          <div><dt>Level</dt><dd>{cert.event_level || eventMeta.level}</dd></div>
        )}
        {(cert.event_dates || eventMeta.dates) && (
          <div className="cert-verify-span"><dt>Dates</dt><dd>{cert.event_dates || eventMeta.dates}</dd></div>
        )}
      </dl>

      <h4 className="cert-verify-section">Issuance &amp; security</h4>
      <dl className="cert-verify-dl">
        <div><dt>Issued on</dt><dd>{cert.issued_at ? new Date(cert.issued_at).toLocaleString() : "—"}</dd></div>
        <div><dt>Issued by</dt><dd>{issuerDisplay(cert, issuerName)}</dd></div>
        <div><dt>Issuer account</dt><dd>{cert.issued_by?.username || cert.issuer_username || "—"}</dd></div>
        <div><dt>IP address (generated)</dt><dd className="cert-mono">{cert.ip_address || cert.generated_ip || "—"}</dd></div>
        <div className="cert-verify-span"><dt>Digital signature</dt><dd className="cert-mono">{cert.digital_signature || "—"}</dd></div>
        <div><dt>Signature status</dt><dd>{cert.digital_signature ? "Valid · SAAP signed" : "Not attached"}</dd></div>
        <div><dt>Integrity</dt><dd>{cert.integrity || "ok"}</dd></div>
      </dl>
      {cert.notice && <p className="muted cert-notice">{cert.notice}</p>}
      <CertificateBlockchainTrail cert={cert} />
    </section>
  );
}

function draftFromSelected(selected, profile, templateId) {
  const tpl = CERT_TEMPLATES.find((t) => t.id === templateId) || CERT_TEMPLATES[0];
  const meta = selected ? findEventMeta(selected.event) : null;
  if (!selected) {
    return {
      ...EMPTY_DRAFT,
      title: tpl.defaultTitle,
      issuerName: profile?.name || "Portal Administrator",
      issuerTitle: "Collector",
      issuerRole: "admin",
      registerMethod: "aadhaar",
      biometricVerified: "yes",
      issuedOn: new Date().toISOString().slice(0, 10),
    };
  }
  return {
    title: tpl.defaultTitle,
    intro: "This is to certify that",
    student: selected.student || "",
    event: selected.event || "",
    sport: selected.sport || "",
    district: selected.district || "",
    village: selected.village || "",
    aadhaar: selected.aadhaar || "",
    venue: selected.venue || meta?.venue || "",
    body: "has successfully participated in",
    issuerName: profile?.name || "Portal Administrator",
    issuerTitle: "Collector",
    issuerRole: "admin",
    registerMethod: selected.source === "event" ? "biometric" : "aadhaar",
    biometricVerified: selected.participation === "present" || selected.source === "event" ? "yes" : "no",
    issuedOn: new Date().toISOString().slice(0, 10),
    reference_no: "",
  };
}

export default function AdminCertificatePanel({
  registrations = [],
  certificates = [],
  profile,
  act,
  printCertificate,
  certQuery,
  setCertQuery,
  onOpenVerify,
}) {
  const [eventKey, setEventKey] = useState("");
  const [sport, setSport] = useState("");
  const [playerKey, setPlayerKey] = useState("");
  const [templateId, setTemplateId] = useState("classic");
  const [draft, setDraft] = useState(() => draftFromSelected(null, profile, "classic"));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [localCerts, setLocalCerts] = useState(() => loadLocalCerts());
  const [verifyMap] = useState(() => loadVerifyMap());

  const apiPool = useMemo(() => {
    return registrations
      .filter((row) => row.status === "approved" || row.participation === "present")
      .map((row) => ({
        key: `api-${row.id}`,
        source: "api",
        registrationId: row.id,
        event: row.event,
        sport: row.sport || "Sport",
        student: row.student,
        district: row.district,
        participation: row.participation || "",
        aadhaar: "",
        village: "",
        venue: "",
      }));
  }, [registrations]);

  const eventPool = useMemo(() => {
    const verifiedIds = verifyMap || {};
    const rows = [];
    SAAP_EVENT_REPORTS.forEach((event) => {
      buildEventPlayers(event).forEach((player) => {
        const manual = verifiedIds[player.id] === true;
        const eligible = event.status === "upcoming" ? manual : (manual || player.defaultVerified);
        if (!eligible) return;
        rows.push({
          key: `evt-${player.id}`,
          source: "event",
          registrationId: null,
          playerId: player.id,
          event: event.name,
          eventId: event.id,
          sport: player.sport,
          student: player.name,
          district: player.district,
          participation: "present",
          aadhaar: player.aadhaar,
          village: player.village,
          venue: event.venue || "",
          year: event.year,
        });
      });
    });
    return rows;
  }, [verifyMap]);

  const pool = useMemo(() => {
    const issuedStudents = new Set(
      [...certificates, ...localCerts].map((c) => `${c.event}|${c.student}|${c.sport || ""}`.toLowerCase()),
    );
    return [...apiPool, ...eventPool].filter((row) => {
      const stamp = `${row.event}|${row.student}|${row.sport}`.toLowerCase();
      return !issuedStudents.has(stamp);
    });
  }, [apiPool, eventPool, certificates, localCerts]);

  const events = useMemo(() => [...new Set(pool.map((r) => r.event))].sort(), [pool]);
  const sports = useMemo(() => {
    const rows = pool.filter((r) => !eventKey || r.event === eventKey);
    return [...new Set(rows.map((r) => r.sport))].sort();
  }, [pool, eventKey]);
  const players = useMemo(() => {
    return pool.filter((r) => {
      if (eventKey && r.event !== eventKey) return false;
      if (sport && r.sport !== sport) return false;
      return true;
    });
  }, [pool, eventKey, sport]);

  const selected = players.find((p) => p.key === playerKey) || null;

  useEffect(() => {
    if (eventKey && !events.includes(eventKey)) setEventKey("");
  }, [events, eventKey]);

  useEffect(() => {
    if (sport && !sports.includes(sport)) setSport("");
  }, [sports, sport]);

  useEffect(() => {
    if (playerKey && !players.some((p) => p.key === playerKey)) setPlayerKey("");
  }, [players, playerKey]);

  useEffect(() => {
    if (!selected) return;
    setDraft(draftFromSelected(selected, profile, templateId));
  }, [selected?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tpl = CERT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setDraft((d) => ({ ...d, title: tpl.defaultTitle }));
  }, [templateId]);

  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function buildCertPayload(reference_no, extras = {}) {
    const meta = findEventMeta(draft.event);
    const issuedAt = draft.issuedOn ? new Date(draft.issuedOn).toISOString() : new Date().toISOString();
    const name = draft.issuerName || profile?.name || "Portal Administrator";
    const role = draft.issuerRole || "admin";
    const title = draft.issuerTitle || "Collector";
    const base = {
      reference_no,
      cert_title: draft.title,
      title: draft.event,
      student: draft.student,
      event: draft.event,
      sport: draft.sport,
      district: draft.district,
      village: draft.village,
      aadhaar: draft.aadhaar,
      venue: draft.venue || meta?.venue || "",
      intro: draft.intro,
      body: draft.body,
      status: "issued",
      issued_at: issuedAt,
      issued_on_label: formatIssuedOn(draft.issuedOn),
      issued_by_name: name,
      issued_by_role: role,
      issuer_title: title,
      issued_by: { name, role, username: profile?.username || "admin", title },
      qr: makeLocalQr(reference_no),
      verify_url: `/cert/${reference_no}`,
      integrity: "ok",
      template: templateId,
      register_method: draft.registerMethod || "aadhaar",
      biometric_verified: draft.biometricVerified || "yes",
      participation: selected?.participation || "present",
      event_year: meta?.year,
      event_status: meta?.status,
      event_level: meta?.level,
      event_dates: meta?.dates,
      organised_by: meta?.organisedBy || "Sports Authority of Andhra Pradesh (SAAP)",
      conducted_by: meta?.conductedBy || "",
      event_meta: meta || null,
      digital_signature: makeDigitalSignature({
        reference_no,
        student: draft.student,
        event: draft.event,
        sport: draft.sport,
        issued_at: issuedAt,
        issuerName: name,
      }),
      ...extras,
    };
    return base;
  }

  const liveCert = useMemo(() => {
    const ref = draft.reference_no || "SAAP-DRAFT-PREVIEW";
    const meta = findEventMeta(draft.event);
    return {
      ...buildCertPayload(ref, {
        status: "draft",
        integrity: "preview",
        ip_address: "— after generate —",
      }),
      organised_by: meta?.organisedBy,
      conducted_by: meta?.conductedBy,
    };
  }, [draft, templateId, selected, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const issued = useMemo(() => {
    const q = (certQuery || "").trim().toLowerCase();
    const merged = [
      ...certificates.map((c) => ({ ...c, source: "api" })),
      ...localCerts.map((c) => ({ ...c, source: "local" })),
    ].sort((a, b) => String(b.issued_at || "").localeCompare(String(a.issued_at || "")));
    if (!q) return merged;
    return merged.filter((c) => `${c.reference_no} ${c.title} ${c.student} ${c.sport || ""} ${c.event || ""} ${c.issued_by_name || ""}`.toLowerCase().includes(q));
  }, [certificates, localCerts, certQuery]);

  async function generate() {
    if (!draft.student.trim() || !draft.event.trim()) {
      setError("Player name and event are required. Select a player or type the fields.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const reference_no = draft.reference_no?.trim()
        || `SAAP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const ip = await detectClientIp();

      if (selected?.source === "api" && selected.registrationId) {
        if (selected.participation !== "present") {
          await act("/api/attendance", { registration_id: selected.registrationId, status: "present" });
        }
        const data = await act(`/api/certificates/${selected.registrationId}`);
        const ref = data?.reference_no || reference_no;
        const cert = buildCertPayload(ref, {
          source: "api",
          status: data?.status || "issued",
          qr: data?.qr || makeLocalQr(ref),
          verify_url: data?.verify_url || `/cert/${ref}`,
          issued_by: data?.issued_by || { name: draft.issuerName, role: draft.issuerRole, title: draft.issuerTitle, username: "admin" },
          ip_address: ip,
        });
        const next = [cert, ...loadLocalCerts().filter((c) => c.reference_no !== cert.reference_no)];
        saveLocalCerts(next);
        setLocalCerts(next);
        setPreview(cert);
        setNotice(`Certificate ${cert.reference_no} generated (${CERT_TEMPLATES.find((t) => t.id === templateId)?.label}).`);
        setPlayerKey("");
      } else {
        const cert = buildCertPayload(reference_no, {
          source: "local",
          playerId: selected?.playerId,
          ip_address: ip,
        });
        const next = [cert, ...loadLocalCerts()];
        saveLocalCerts(next);
        setLocalCerts(next);
        setPreview(cert);
        setNotice(`Certificate ${reference_no} generated (${CERT_TEMPLATES.find((t) => t.id === templateId)?.label}).`);
        setPlayerKey("");
      }
    } catch (err) {
      setError(err?.message || "Could not generate certificate.");
    } finally {
      setBusy(false);
    }
  }

  function openPrint(cert) {
    if (cert.source === "api" && printCertificate && !cert.template) {
      printCertificate(cert);
      return;
    }
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    const safe = (v) => String(v ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
    const tpl = cert.template || "classic";
    const border = tpl === "modern" ? "#123262" : tpl === "merit" ? "#8a6a12" : "#7a151a";
    const accent = tpl === "modern" ? "#0b4f8a" : tpl === "merit" ? "#b8860b" : "#7a151a";
    const title = safe(cert.cert_title || (tpl === "merit" ? "Certificate of Merit" : tpl === "modern" ? "Certificate of Appreciation" : "Certificate of Participation"));
    win.document.write(`<!doctype html><html><head><title>${safe(cert.reference_no)}</title>
      <style>
        body{font-family:Georgia,"Times New Roman",serif;color:#1a2b4a;margin:0;padding:28px;background:#efe6d4}
        .sheet{max-width:820px;margin:0 auto;background:linear-gradient(180deg,#fffdf8,#f7f0e4);border:14px double ${border};padding:36px 40px;text-align:center;position:relative}
        .logo{width:min(420px,85%);height:auto;margin:0 auto 8px;display:block;background:#fff;padding:10px 16px;border:1px solid #e6dcc8;border-radius:8px}
        .gov{letter-spacing:.14em;text-transform:uppercase;font-size:.78rem;color:${accent};font-weight:700;margin:0 0 6px}
        h1{margin:4px 0 18px;font-size:2rem;color:${accent}}
        .name{font-size:2rem;margin:14px 0;color:${accent};border-bottom:1px solid #c9b89a;display:inline-block;padding:0 18px 6px}
        .meta{display:flex;justify-content:center;flex-wrap:wrap;gap:28px;margin:18px 0;font-size:.95rem}
        .signs{display:flex;justify-content:space-between;align-items:flex-end;margin-top:28px;gap:12px}
        .signs div{flex:1} .seal{width:90px;height:90px;border:3px solid ${accent};border-radius:50%;display:grid;place-content:center;margin:0 auto;color:${accent};font-weight:700}
      </style></head><body><div class="sheet">
      <img class="logo" src="${window.location.origin}/saap-logo.png" alt="SAAP" />
      <p class="gov">Government of Andhra Pradesh</p>
      <h1>${title}</h1>
      <p>${safe(cert.intro || "This is to certify that")}</p>
      <p class="name">${safe(cert.student)}</p>
      <p>${safe(cert.body || "has successfully participated in")} <em>${safe(cert.event || cert.title)}</em>${cert.sport ? ` · <strong>${safe(cert.sport)}</strong>` : ""}${cert.district ? ` · <strong>${safe(cert.district)}</strong>` : ""}${cert.venue ? ` · Venue: <strong>${safe(cert.venue)}</strong>` : ""}.</p>
      <div class="meta"><span>Certificate No. <strong>${safe(cert.reference_no)}</strong></span><span>Date <strong>${safe(cert.issued_on_label || formatIssuedOn(cert.issued_at))}</strong></span><span>Issued by <strong>${safe(cert.issued_by_name || cert.issued_by?.name || "—")}</strong></span></div>
      <div class="signs">
        <div><img src="${safe(cert.qr || makeLocalQr(cert.reference_no))}" width="100" height="100" alt="QR" /><br><small>Scan to verify</small></div>
        <div class="seal"><span>SAAP</span></div>
        <div><strong>${safe(cert.issued_by_name || cert.issued_by?.name || "Authorised Officer")}</strong><br><small>${safe(cert.issued_by_role || "Authorised by")}</small></div>
      </div>
      </div></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="cert-desk">
      <p className="muted">
        Choose a template, edit any certificate field, then generate. The QR still opens the public verify page.
      </p>

      <section className="cert-form-card">
        <h3>Generate certificate</h3>
        <div className="cert-form-grid">
          <label>
            Event
            <select value={eventKey} onChange={(e) => { setEventKey(e.target.value); setSport(""); setPlayerKey(""); }}>
              <option value="">Select event</option>
              {events.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Sport
            <select value={sport} onChange={(e) => { setSport(e.target.value); setPlayerKey(""); }} disabled={!eventKey}>
              <option value="">Select sport</option>
              {sports.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label>
            Player
            <select value={playerKey} onChange={(e) => setPlayerKey(e.target.value)} disabled={!eventKey || !sport}>
              <option value="">Select player</option>
              {players.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.student}{row.district ? ` · ${row.district}` : ""}{row.participation === "present" ? " · verified" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cert-template-pick" role="radiogroup" aria-label="Certificate template">
          <p className="cert-template-pick-label">Template</p>
          <div className="cert-template-pick-grid">
            {CERT_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={`cert-template-option${templateId === tpl.id ? " is-on" : ""}`}
                onClick={() => setTemplateId(tpl.id)}
                aria-pressed={templateId === tpl.id}
              >
                <strong>{tpl.label}</strong>
                <span>{tpl.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cert-edit-grid">
          <label>
            Certificate heading
            <input value={draft.title} onChange={(e) => setField("title", e.target.value)} />
          </label>
          <label>
            Intro line
            <input value={draft.intro} onChange={(e) => setField("intro", e.target.value)} />
          </label>
          <label>
            Player name
            <input value={draft.student} onChange={(e) => setField("student", e.target.value)} />
          </label>
          <label>
            Event name
            <input value={draft.event} onChange={(e) => setField("event", e.target.value)} />
          </label>
          <label>
            Sport
            <input value={draft.sport} onChange={(e) => setField("sport", e.target.value)} />
          </label>
          <label>
            District
            <input value={draft.district} onChange={(e) => setField("district", e.target.value)} />
          </label>
          <label>
            Village
            <input value={draft.village} onChange={(e) => setField("village", e.target.value)} />
          </label>
          <label>
            Aadhaar
            <input value={draft.aadhaar} onChange={(e) => setField("aadhaar", e.target.value)} />
          </label>
          <label>
            Venue
            <input value={draft.venue} onChange={(e) => setField("venue", e.target.value)} />
          </label>
          <label>
            Date of issue
            <input type="date" value={draft.issuedOn} onChange={(e) => setField("issuedOn", e.target.value)} />
          </label>
          <label>
            Issuer name
            <input value={draft.issuerName} onChange={(e) => setField("issuerName", e.target.value)} />
          </label>
          <label>
            Issuer title (shown in brackets)
            <input value={draft.issuerTitle} onChange={(e) => setField("issuerTitle", e.target.value)} placeholder="Collector" />
          </label>
          <label>
            Issuer role
            <input value={draft.issuerRole} onChange={(e) => setField("issuerRole", e.target.value)} />
          </label>
          <label>
            Registered by
            <select value={draft.registerMethod} onChange={(e) => setField("registerMethod", e.target.value)}>
              <option value="aadhaar">Aadhaar OTP</option>
              <option value="biometric">Bio-Metric</option>
            </select>
          </label>
          <label>
            Biometric verified
            <select value={draft.biometricVerified} onChange={(e) => setField("biometricVerified", e.target.value)}>
              <option value="yes">Verified</option>
              <option value="no">Not verified</option>
              <option value="pending">Pending</option>
            </select>
          </label>
          <label>
            Certificate No. (optional)
            <input value={draft.reference_no} onChange={(e) => setField("reference_no", e.target.value)} placeholder="Auto if blank" />
          </label>
          <label className="cert-edit-wide">
            Body text
            <textarea rows={3} value={draft.body} onChange={(e) => setField("body", e.target.value)} />
          </label>
        </div>

        {pool.length === 0 && (
          <p className="admin-alert" role="status">
            No eligible players in the dropdown yet — you can still type every field above and generate.
          </p>
        )}
        <div className="cert-form-actions">
          <button type="button" className="saap-desk-primary" disabled={busy || !draft.student.trim() || !draft.event.trim()} onClick={generate}>
            {busy ? "Generating…" : "Generate certificate"}
          </button>
        </div>
        {notice && <p className="ok">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="cert-preview-wrap">
        <div className="cert-preview-head">
          <h3>Live preview</h3>
          <p className="muted">Edits update this template instantly before you generate.</p>
        </div>
        <CertificateTemplate cert={preview || liveCert} issuerName={(preview || liveCert).issued_by_name} templateId={(preview || liveCert).template || templateId} />
        {preview && (
          <>
            <div className="row-actions" style={{ marginTop: 8 }}>
              <button type="button" className="saap-desk-ghost" onClick={() => openPrint(preview)}>Download / print</button>
              <Link className="saap-desk-ghost cert-link-btn" to={preview.verify_url || `/cert/${preview.reference_no}`} target="_blank" rel="noreferrer">
                Open verify page
              </Link>
            </div>
            <CertificateVerifyPanel cert={preview} issuerName={preview.issued_by_name || profile?.name} />
          </>
        )}
      </section>

      <section className="cert-issued">
        <h3>Issued certificates</h3>
        <div className="saap-desk-filterbar is-plain">
          <input value={certQuery} onChange={(e) => setCertQuery(e.target.value)} placeholder="Search reference, student, sport, issuer..." aria-label="Filter certificates" />
        </div>
        <ul className="saap-desk-list">
          {issued.length === 0 && <li className="saap-desk-empty">No certificates yet.</li>}
          {issued.map((cert) => (
            <li key={`${cert.source}-${cert.reference_no}`}>
              <div>
                <strong>{cert.reference_no}</strong> · {cert.cert_title || cert.title || cert.event} · {cert.student} · {cert.sport || "Sport"}
                {cert.template ? <em className="cert-tpl-tag">{cert.template}</em> : null}
                <p className="muted">
                  Generated by {cert.issued_by_name || cert.issued_by?.name || "—"}
                  {cert.issued_at ? ` · ${new Date(cert.issued_at).toLocaleString()}` : ""}
                </p>
              </div>
              <span className="row-actions">
                <button type="button" className="saap-desk-ghost" onClick={() => { setPreview(cert); setTemplateId(cert.template || "classic"); }}>Preview</button>
                <button type="button" className="saap-desk-ghost" onClick={() => openPrint(cert)}>Download / print</button>
                <button type="button" className="saap-desk-primary" onClick={() => onOpenVerify?.(cert.reference_no)}>Verify</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export { loadLocalCerts, LOCAL_CERT_KEY, makeLocalQr, CertificateTemplate, CertificateVerifyPanel, CertificateBlockchainTrail };
