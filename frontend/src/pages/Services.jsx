import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PlayerRegistrationWizard } from "../components/SaapAuth";
import { DISCIPLINES, DISTRICTS, DSC_PDF, FACILITIES, NEWS } from "../data/content";
import { usePlatform } from "../context";

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

function ApplicationForm({ type, title, intro }) {
  const { submitApplication, user } = usePlatform();
  const [done, setDone] = useState(null);
  const [form, setForm] = useState({
    type,
    name: user?.name || "",
    phone: user?.phone || "",
    district: user?.district || DISTRICTS[0],
    sport: DISCIPLINES[0],
    age: "",
    organisation: "",
    note: "",
  });

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    const item = await submitApplication(form);
    setDone(item);
  }

  if (done) {
    return (
      <div className="panel-card success-box">
        <h2>Request received</h2>
        <p>{done.name}, your {done.type} request <strong>{done.id}</strong> is pending with the district officer.</p>
        <p>It is on the audit trail and the ledger{done.blockHash ? ` (${done.blockHash.slice(0, 12)}…)` : ""}.</p>
        <Link to="/dashboard">Track it on the dashboard</Link>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <p className="muted">{intro}</p>
      <label>Name<input required value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
      <label>Mobile<input required pattern="[0-9]{10,12}" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
      <label>District
        <select value={form.district} onChange={(e) => set("district", e.target.value)}>
          {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <label>Sport
        <select value={form.sport} onChange={(e) => set("sport", e.target.value)}>
          {DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      {type !== "pay" && <label>Age<input value={form.age} onChange={(e) => set("age", e.target.value)} /></label>}
      <label>{type === "pay" ? "Facility" : "School / academy"}
        {type === "pay" ? (
          <select value={form.organisation} onChange={(e) => set("organisation", e.target.value)} required>
            <option value="">Choose a venue</option>
            {FACILITIES.map((f) => <option key={f.name}>{f.name} · {f.district}</option>)}
          </select>
        ) : (
          <input required value={form.organisation} onChange={(e) => set("organisation", e.target.value)} />
        )}
      </label>
      <label>Note<textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} /></label>
      <button className="btn primary" type="submit">Submit</button>
    </form>
  );
}

export function Register() {
  const [params, setParams] = useSearchParams();
  const type = params.get("type") === "academy" ? "academy" : params.get("type") === "camp" ? "camp" : "player";
  const copy = {
    player: ["Player registration", "Aadhaar OTP verification, then player profile — same order as the SAAP portal."],
    academy: ["Academies registration", "State sports academies file recognition details. The public portal links this form from Latest News."],
    camp: ["Summer camp certificate request", "Ask for a Summer Camp 2026 certificate. Approval places it on the ledger."],
  }[type];

  if (type === "player") {
    return (
      <section className="player-reg-page">
        <PlayerRegistrationWizard />
      </section>
    );
  }

  return (
    <>
      <Hero kicker="Registrations" title={copy[0]} text={copy[1]} />
      <section className="wrap service-layout">
        <div className="chips">
          {[
            ["player", "Player"],
            ["academy", "Academy"],
            ["camp", "Summer camp"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={type === id ? "on" : ""} onClick={() => setParams({ type: id })}>{label}</button>
          ))}
        </div>
        <ApplicationForm key={type} type={type} title={copy[0]} intro="You will get an application ID immediately. Sign in as officer to approve a pending request." />
      </section>
    </>
  );
}

export function PayAndPlay() {
  return (
    <>
      <Hero kicker="Pay and Play" title="Request a ground or court." text="Choose a SAAP venue. The district officer confirms the slot. The request is audited and hashed." />
      <section className="wrap narrow">
        <ApplicationForm type="pay" title="Slot request" intro="Tell us the venue, sport, and the day you need in the note." />
      </section>
    </>
  );
}

export function Certificates() {
  const { state } = usePlatform();
  const [query, setQuery] = useState("");
  const rows = state.certificates.filter((c) => `${c.id} ${c.holder} ${c.title} ${c.district}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <Hero kicker="Certificates" title="Summer camp and registration certificates." text="Each certificate ID can be checked against the ledger. The seeded camp certificate is SAAP-CAMP-2026-0142." />
      <section className="wrap news-list">
        <input className="filter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search holder, district, or certificate ID" aria-label="Filter certificates" />
        {rows.map((c) => (
          <article key={c.id}>
            <div><span>{c.district}</span><time>{new Date(c.issuedAt).toLocaleDateString()}</time></div>
            <h2>{c.title}</h2>
            <p>{c.holder} · {c.id}</p>
            <Link to={`/certificates/${c.id}`}>Open certificate</Link>
          </article>
        ))}
        {rows.length === 0 && <p>No certificates yet. An approved player, academy, or camp request creates one.</p>}
      </section>
    </>
  );
}

export function CertificateView() {
  const { id } = useParams();
  const { findCertificate, verifyCertificateRecord } = usePlatform();
  const cert = findCertificate(decodeURIComponent(id));
  const [check, setCheck] = useState(null);
  useEffect(() => {
    if (!cert) return;
    verifyCertificateRecord(cert.id).then(setCheck);
  }, [cert, verifyCertificateRecord]);
  if (!cert) {
    return <section className="wrap prose"><h1>Certificate not found</h1><p>Check the ID, or verify it on the ledger.</p></section>;
  }
  return (
    <section className="wrap">
      <article className="certificate">
        <p>Sports Authority of Andhra Pradesh</p>
        <h1>{cert.title}</h1>
        <p className="holder">{cert.holder}</p>
        <p>{cert.district}</p>
        <p>ID {cert.id}</p>
        <p className="hash">Ledger {cert.blockHash}</p>
        <p className={check?.intact ? "ok" : "error"}>{check ? check.reason : "Checking the ledger block…"}</p>
        <div className="cta-row">
          <Link to={`/ledger?id=${cert.id}`}>Open the ledger</Link>
          <button className="btn ghost" type="button" onClick={() => window.print()}>Print</button>
        </div>
      </article>
    </section>
  );
}

export function Dsc() {
  return (
    <>
      <Hero kicker="Sports DSC 2025" title="Andhra Pradesh Sports Mega DSC." text="Schedule PDF and the final merit list entry published on the SAAP home page." />
      <section className="wrap card-3">
        <article className="panel-card">
          <h2>Schedule</h2>
          <a href={DSC_PDF} target="_blank" rel="noreferrer">Open the DSC schedule</a>
        </article>
        <article className="panel-card">
          <h2>Final merit list 2025</h2>
          <p>The merit list is published on the official portal under DSC Final merit list 2025.</p>
          <a href="https://sports.ap.gov.in/#/home/Home-dsc-merit-list" target="_blank" rel="noreferrer">Open on SAAP</a>
        </article>
        <article className="panel-card">
          <h2>Apply</h2>
          <a href="https://sportsdsc.apcfss.in" target="_blank" rel="noreferrer">sportsdsc.apcfss.in</a>
        </article>
      </section>
    </>
  );
}

export function League() {
  const rules = NEWS.find((n) => n.id === "league-rules");
  return (
    <>
      <Hero kicker="SAAP League" title="League registration and the 2026 rule book." text="Rules Book 2026 V1.3 is the document linked from Latest News." />
      <section className="wrap service-layout">
        <a className="btn primary" href={rules.href} target="_blank" rel="noreferrer">Open rules PDF</a>
        <ApplicationForm type="league" title="Team interest" intro="Name the team in the organisation field and the sport you will play." />
      </section>
    </>
  );
}

export function Amaravati() {
  return (
    <>
      <Hero kicker="Amaravati Championship" title="Register interest for the championship." text="The official portal carries a registration QR for the Amaravati Championship. This form records the same intent with an audit entry." />
      <section className="wrap narrow">
        <ApplicationForm type="championship" title="Championship interest" intro="Add your event and age category in the note." />
      </section>
    </>
  );
}
