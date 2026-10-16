import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ABOUT,
  APPROACHES,
  ATHLETES,
  CALENDAR_PDF,
  DISCIPLINES,
  DISTRICTS,
  FACILITIES,
  GALLERIES,
  HOME_PHOTOS,
  HOME_VIDEOS,
  photoFullUrl,
  youtubeEmbed,
  LEADERSHIP,
  LINKS,
  NEWS,
  OFFICE,
  PATHWAY,
  POLICY_PDF,
  SCHEMES,
} from "../data/content";

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

export function About() {
  return (
    <>
      <Hero kicker="About SAAP" title="Promoting sport across Andhra Pradesh since 1988." text="A statutory body under the Andhra Pradesh Sports Act, 2010." />
      <section className="wrap prose">
        {ABOUT.map((p) => <p key={p}>{p}</p>)}
        <p>The current policy frame is the Andhra Pradesh Sports Policy 2024–29, issued in G.O.Ms.No.18, Youth Advancement, Tourism & Culture (Sports & YS) Department, dated 10 December 2024. It replaces G.O.Ms.No.8 dated 24 May 2017 and stays in force for five years.</p>
        <Link className="btn primary" to="/policy">Open the policy</Link>
      </section>
    </>
  );
}

export function Organogram() {
  const steps = [
    "Hon’ble Chief Minister",
    "Hon’ble Minister for Transport, Youth & Sports",
    "Special Chief Secretary, YAT&C (Sports)",
    "Chairman, SAAP",
    "Vice Chairman & Managing Director, SAAP",
    "District Sports Authorities · Academies · Associations · Coaches",
  ];
  return (
    <>
      <Hero kicker="Organogram" title="How the sports administration sits together." />
      <section className="wrap org">
        {steps.map((step, i) => (
          <div key={step} className="org-step">
            <span>{String(i + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </div>
        ))}
        <div className="org-leaders">
          {LEADERSHIP.map((p) => (
            <article key={p.name} className={p.band === "state" ? "is-state" : "is-saap"}>
              <h3>{p.name}</h3>
              <p>{p.role}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function Policy() {
  return (
    <>
      <Hero
        kicker="G.O.Ms.No.18 · 10 December 2024"
        title="Andhra Pradesh Sports Policy 2024–29"
        text="Vision 2047 builds an inclusive sports ecosystem. Mission 2029 is to position Swarna Andhra Pradesh as the nation’s sports capital and a global centre for sports talent."
      />
      <section className="wrap">
        <div className="cta-row">
          <a className="btn primary" href={POLICY_PDF} target="_blank" rel="noreferrer">Official policy PDF</a>
          <Link className="btn ghost" to="/orders">Government order</Link>
        </div>
        <div className="approach-grid">
          {APPROACHES.map((a) => (
            <article key={a.n}>
              <span>{a.n}</span>
              <h2>{a.title}</h2>
              <p>{a.text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function SchemePage() {
  const { slug } = useParams();
  const scheme = SCHEMES.find((s) => s.slug === slug) || SCHEMES[0];
  return (
    <>
      <Hero kicker={scheme.group} title={scheme.name} text={scheme.summary} />
      <section className="wrap prose">
        {scheme.points.map((p) => <p key={p}>{p}</p>)}
        <div className="scheme-nav">
          {SCHEMES.map((s) => (
            <Link key={s.slug} to={`/schemes/${s.slug}`} className={s.slug === scheme.slug ? "on" : ""}>{s.name}</Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function Gallery() {
  const { slug } = useParams();
  const current = GALLERIES.find((g) => g.slug === slug) || GALLERIES[0];
  return (
    <>
      <Hero kicker="Gallery" title={current.title} text={current.text} />
      <section className="wrap">
        <div className="chips">
          {GALLERIES.map((g) => (
            <Link key={g.slug} to={`/gallery/${g.slug}`} className={g.slug === current.slug ? "on" : ""}>{g.title}</Link>
          ))}
        </div>
        {current.slug === "videos" ? (
          <div className="saap-gallery-videos">
            {HOME_VIDEOS.map((clip) => (
              <iframe key={clip.id} title={clip.title} src={youtubeEmbed(clip.id)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            ))}
          </div>
        ) : (
          <div className="page-gallery-grid">
            {HOME_PHOTOS.map((src) => (
              <a key={src} href={photoFullUrl(src)} target="_blank" rel="noreferrer">
                <img src={src} alt={current.title} loading="lazy" decoding="async" />
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function News() {
  return (
    <>
      <Hero kicker="Latest news" title="Notices, calendars, and recruitments." text="Each item opens the document published on the SAAP portal." />
      <section className="wrap news-list">
        {NEWS.map((item) => (
          <article key={item.id}>
            <div><span>{item.tag}</span><time>{item.date}</time></div>
            <h2>{item.title}</h2>
            {item.to ? <Link to={item.to}>Open</Link> : <a href={item.href} target="_blank" rel="noreferrer">Open document</a>}
          </article>
        ))}
      </section>
    </>
  );
}

export function Contact() {
  return (
    <>
      <Hero kicker="Contact" title="Head office and 26 district sports offices." />
      <section className="wrap contact-grid">
        <article className="panel-card">
          <h2>Head office</h2>
          <p>{OFFICE.address}</p>
          <p><a href={`tel:${OFFICE.phones[0].replace(/\s/g, "")}`}>{OFFICE.phones.join(", ")}</a></p>
          <p>{OFFICE.hours}</p>
        </article>
        <article>
          <h2>District offices</h2>
          <p className="muted">District sports authority contacts are listed under each district on the official portal. Call the head office to be connected. Names below match the SAAP contact page.</p>
          <ul className="districts">
            {DISTRICTS.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </article>
      </section>
    </>
  );
}

export function Facilities() {
  return (
    <>
      <Hero kicker="Sports facilities" title="Grounds, stadiums, and centres used by SAAP programmes." text="The public portal lists grounds and playfields across all districts, with 131 sports facilities and 244 coaches in the headline count." />
      <section className="wrap facility-grid">
        {FACILITIES.map((f) => (
          <article key={f.name}>
            <span>{f.kind}</span>
            <h2>{f.name}</h2>
            <p>{f.district}</p>
            <p>{f.note}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function Associations() {
  return (
    <>
      <Hero kicker="Associations" title="State sports association recognition and renewal." text="Recognition status for 2019–2026 is published as a live sheet. New and renewal filings are audited on this portal." />
      <section className="wrap prose">
        <a className="btn primary" href={NEWS[0].href} target="_blank" rel="noreferrer">Open the 2019–2026 status sheet</a>
        <p>Approach 8 of the Sports Policy asks for digital certificates, a federation database, village sports committees, statewide leagues, and a performance audit of associations.</p>
        <Link to="/register?type=academy">File an academy or association registration</Link>
      </section>
    </>
  );
}

export function CalendarPage() {
  return (
    <>
      <Hero kicker="Sports calendar" title="SAAP annual sports calendar 2026." />
      <section className="wrap prose">
        <p>The annual calendar and the January 2026 announcement PDF are published by SAAP. School Games for the academic year 2026–27 and యోగాంధ్ర 2026 sit alongside the league season.</p>
        <div className="cta-row">
          <a className="btn primary" href={CALENDAR_PDF} target="_blank" rel="noreferrer">Calendar announcement</a>
          <a className="btn ghost" href={NEWS.find((n) => n.id === "calendar").href} target="_blank" rel="noreferrer">Annual calendar 2026</a>
        </div>
      </section>
    </>
  );
}

export function Achievements() {
  return (
    <>
      <Hero kicker="Achievements" title="Athletes featured by SAAP." />
      <section className="wrap athlete-grid">
        {ATHLETES.map((a) => (
          <article key={a.name}><h2>{a.name}</h2><p>{a.sport}</p></article>
        ))}
      </section>
    </>
  );
}

export function Tournaments() {
  return (
    <>
      <Hero kicker="Tournaments" title="Championships on the SAAP calendar." />
      <section className="wrap card-3">
        <article className="panel-card"><h2>Amaravati Championship</h2><p>State championship registration window.</p><Link to="/amaravati">Register interest</Link></article>
        <article className="panel-card"><h2>SAAP League</h2><p>Rules Book 2026 V1.3.</p><Link to="/league">League desk</Link></article>
        <article className="panel-card"><h2>School Games 2026–27</h2><p>Academic year school games notification.</p><a href={NEWS.find((n) => n.id === "school-games").href} target="_blank" rel="noreferrer">Open PDF</a></article>
      </section>
    </>
  );
}

export function Recruitment() {
  const items = NEWS.filter((n) => n.tag === "Recruitment" || n.tag === "Jobs");
  return (
    <>
      <Hero kicker="Recruitment" title="Open notices from SAAP and related departments." />
      <section className="wrap news-list">
        {items.map((item) => (
          <article key={item.id}>
            <div><span>{item.tag}</span><time>{item.date}</time></div>
            <h2>{item.title}</h2>
            <a href={item.href} target="_blank" rel="noreferrer">Open notification</a>
          </article>
        ))}
      </section>
    </>
  );
}

export function Tenders() {
  return (
    <>
      <Hero kicker="Tenders" title="Works and procurement notices." text="SAAP publishes tenders on the official portal. This desk lists the notices captured from the public newsroom and points back to the source PDFs." />
      <section className="wrap prose">
        <p>Use Latest News for recruitment and scheme documents. Infrastructure works follow the Sports Policy approach on world-class facilities, including district centres and Kreeda Vikas Kendras.</p>
        <Link to="/news">Browse current documents</Link>
      </section>
    </>
  );
}

export function Orders() {
  return (
    <>
      <Hero kicker="Government orders" title="Sports Policy order now in force." />
      <section className="wrap prose">
        <p>G.O.Ms.No.18, YAT&C (Sports & YS) Department, dated 10 December 2024, approves the Andhra Pradesh Sports Policy 2024–29. The Vice Chairman and Managing Director, SAAP, Vijayawada, is asked to take necessary action. The portal file is dated 18 December 2024.</p>
        <a className="btn primary" href={POLICY_PDF} target="_blank" rel="noreferrer">Read the policy PDF</a>
      </section>
    </>
  );
}

export function Auction() {
  return (
    <>
      <Hero kicker="Open auction" title="Open auction notices." text="The official SAAP site keeps an Open Auction section for published lots. File a query if you need the current list from the head office." />
      <section className="wrap prose">
        <p>Call {OFFICE.phones.join(" or ")} on working days, or send a WhatsApp note through the help button. Queries are written to the audit trail.</p>
        <Link to="/contact">Contact the head office</Link>
      </section>
    </>
  );
}

export function Manual() {
  return (
    <>
      <Hero kicker="User manual" title="How to use this portal." />
      <section className="wrap prose">
        <ol>
          <li>Search or use the menus for schemes, news, gallery, and services.</li>
          <li>File a player, academy, camp, league, or Pay and Play request. You can do this without an account; signing in attaches it to you.</li>
          <li>A district officer or admin approves or returns the request from the dashboard.</li>
          <li>Approved player, academy, and camp requests mint a certificate. Verify the ID on the ledger.</li>
          <li>WhatsApp messages to SAAP, and officer notices to applicants, are stored in the audit trail and hashed.</li>
        </ol>
        <p>Demo sign-in uses the password <strong>saap123</strong> with usernames citizen, athlete, coach, officer, and admin.</p>
      </section>
    </>
  );
}

export function AppsPage() {
  return (
    <>
      <Hero kicker="Apps" title="Kreeda and the digital services around it." text="Sports Policy approach 9 asks for a state database, facility audit, sports certificates, and unique athlete IDs. Kreeda is that app." />
      <section className="wrap card-3">
        <article className="panel-card">
          <h2>Kreeda</h2>
          <p>Android build published by SAAP.</p>
          <a href="https://sportsapi.ap.gov.in/imgs/apk/SAAP.apk">Download APK</a>
        </article>
        <article className="panel-card">
          <h2>SAAP Leagues</h2>
          <Link to="/league">Register a team</Link>
        </article>
        <article className="panel-card">
          <h2>Amaravati Championship</h2>
          <Link to="/amaravati">Championship desk</Link>
        </article>
      </section>
    </>
  );
}

export function Training() {
  const [params] = useSearchParams();
  const sport = params.get("sport");
  return (
    <>
      <Hero kicker="Training and coaching" title={sport ? `${sport} coaching` : "From the first ground to a centre of excellence."} text="SAAP’s coaching ladder runs through physical literacy, adopted schools, regional academies, and centres of excellence." />
      <section className="wrap pathway">
        {PATHWAY.map((step, i) => (
          <article key={step.name}>
            <span>0{i + 1}</span>
            <h2>{step.name}</h2>
            <p>{step.text}</p>
          </article>
        ))}
      </section>
      <section className="wrap prose">
        <p>Day boarders and sports nurseries sit beside this ladder. {DISCIPLINES.length} disciplines are listed on the public catalogue, including {sport || "athletics, archery, badminton, and indigenous games"}.</p>
        <div className="cta-row">
          {SCHEMES.map((s) => <Link key={s.slug} to={`/schemes/${s.slug}`}>{s.name}</Link>)}
        </div>
      </section>
    </>
  );
}

const LEGAL = {
  copyright: {
    title: "Copyright",
    body: [
      "Material on the official SAAP website may be reused only with permission from the Centre for e-Governance or the authority that owns the site, and must not be distorted. The source has to be acknowledged. Third-party copyright is excluded.",
      "This recreation summarises public information and links to the original documents. It does not copy the official photo library.",
    ],
  },
  privacy: {
    title: "Privacy",
    body: [
      "The official portal states that it does not collect names or addresses merely because you visit, and that technical details such as browser, time, and downloaded documents may be recorded.",
      "On this portal, applications, messages, and the audit trail stay in your browser. They are not sent to a SAAP server.",
    ],
  },
  terms: {
    title: "Terms",
    body: [
      "The official website is designed and maintained by the Sports Authority of Andhra Pradesh. Content should not be treated as a legal opinion. Indian law and the courts of Andhra Pradesh govern the official terms.",
      "Links to other sites leave this portal. Those sites have their own terms.",
    ],
  },
  security: {
    title: "Security",
    body: [
      "Unauthorised attempts to change government systems are prohibited under the Information Technology Act, 2000.",
      "Role checks on this portal decide who may approve, issue certificates, read the full audit trail, or anchor a ledger note. Passwords in the demo accounts are for local use only.",
    ],
  },
  help: {
    title: "Help and screen reader access",
    body: [
      "The official site aims at WCAG 2.0 Level AA so assistive technologies can read it. This portal keeps a skip link, labelled fields, visible focus, and text buttons.",
      "Use search, the SAAP agent, or the manual if a page is hard to find. If a connection is slow, open the official PDF links once the page has loaded.",
    ],
  },
};

export function Legal() {
  const { slug } = useParams();
  const page = LEGAL[slug] || LEGAL.help;
  return (
    <>
      <Hero kicker="Portal note" title={page.title} />
      <section className="wrap prose">
        {page.body.map((p) => <p key={p}>{p}</p>)}
        <p>External references: {LINKS[0].label} and the SAAP portal at sports.ap.gov.in.</p>
      </section>
    </>
  );
}
