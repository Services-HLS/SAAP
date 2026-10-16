import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { OFFICE } from "../data/content";
import { usePlatform } from "../context";
import PlayLoader from "./PlayLoader";
import Widgets from "./Widgets";

const SITE = "https://sports.ap.gov.in";

const MENU = [
  { label: "Home", to: "/" },
  {
    label: "About Us",
    children: [
      { label: "About SAAP", to: "/about" },
      { label: "Organogram", to: "/organogram" },
    ],
  },
  {
    label: "Schemes",
    children: [
      { label: "Project Gaandiva", to: "/schemes/gaandiva" },
      { label: "Project Paanchajanya", to: "/schemes/paanchajanya" },
      { label: "Day Boarders", to: "/schemes/day-boarders" },
      { label: "Sports Nurseries", to: "/schemes/nurseries" },
      { label: "Khelo India", to: "/schemes/khelo-india" },
    ],
  },
  {
    label: "Gallery",
    children: [
      { label: "Photos", to: "/gallery/photos" },
      { label: "Videos", to: "/gallery/videos" },
      { label: "Press", to: "/gallery/press" },
      { label: "Association Gallery", to: "/gallery/associations" },
      { label: "SAAP activities", to: "/gallery/activities", fresh: true },
      { label: "summer coaching camp galery", to: "/gallery/summer", fresh: true },
    ],
  },
  {
    label: "Registrations",
    children: [
      { label: "Player Registration", to: "/register?type=player" },
      { label: "Student registration & rewards", to: "/platform", fresh: true },
      { label: "Academies Registration Form", to: "/register?type=academy" },
    ],
  },
  {
    label: "Certificates",
    children: [{ label: "Summer Camp Certificates", to: "/certificates", fresh: true }],
  },
  { label: "Associations", to: "/associations" },
  { label: "Sports Calender", href: "https://sportsapi.ap.gov.in/imgs/Announcements/20260112/AL77/U10000497PDF2026011213534739093_AL77_TP.pdf" },
  { label: "Contact", to: "/contact" },
  { label: "Amaravati championship", to: "/amaravati", fresh: true },
  { label: "DSC Final merit list 2025", to: "/dsc" },
  {
    label: "More",
    children: [
      { label: "Open Auction", to: "/open-auction" },
      { label: "RTI", href: "https://rti.gov.in/RTI%20Act,%202005%20(Amended)-English%20Version.pdf" },
      { label: "Tenders", to: "/tenders" },
      { label: "Go", to: "/orders" },
      { label: "Dr. Y.S.R. Sports School Kadapa", href: "https://apsportsschool.ap.gov.in" },
      { label: "User manual", to: "/manual" },
      { label: "Apps", to: "/apps" },
      { label: "Tournaments", to: "/tournaments" },
      { label: "Recruitment", to: "/recruitment" },
      { label: "SAAP League", to: "/league" },
      { label: "Achievements", to: "/achievements" },
      { label: "Facilities", to: "/facilities" },
      { label: "Ledger", to: "/ledger" },
      { label: "Audit trail", to: "/audit" },
      { label: "Registration platform", to: "/platform" },
    ],
  },
];

function ItemLink({ item, onNavigate }) {
  const badge = item.fresh ? <img src={`${SITE}/assets/images/newst-img1.png`} alt="" className="menu55-badge" width="30" height="30" /> : null;
  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        onClick={() => onNavigate?.()}
      >
        {badge}{item.label}
      </a>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={() => onNavigate?.()}
    >
      {badge}{item.label}
    </NavLink>
  );
}

function MenuList() {
  const location = useLocation();
  const [closed, setClosed] = useState(false);
  const ignoreUntil = useRef(0);

  function blurMenu() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function closeMenu() {
    ignoreUntil.current = Date.now() + 450;
    setClosed(true);
    blurMenu();
  }

  function releaseClose() {
    if (Date.now() < ignoreUntil.current) return;
    setClosed(false);
  }

  useEffect(() => {
    ignoreUntil.current = Date.now() + 450;
    setClosed(true);
    blurMenu();
  }, [location.pathname, location.search]);

  return (
    <ul
      className={`navigation${closed ? " nav-force-close" : ""}`}
      onMouseLeave={releaseClose}
    >
      {MENU.map((item) => (
        <li
          key={item.label}
          className={item.children ? "dropdown" : undefined}
          onMouseEnter={releaseClose}
        >
          {item.children ? (
            <a
              href="#menu"
              onClick={(e) => {
                e.preventDefault();
                releaseClose();
              }}
            >
              {item.label}
            </a>
          ) : (
            <ItemLink item={item} onNavigate={closeMenu} />
          )}
          {item.children && (
            <ul>
              {item.children.map((child) => (
                <li key={child.label}>
                  <ItemLink item={child} onNavigate={closeMenu} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Shell() {
  const { user, logout } = usePlatform();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [playing, setPlaying] = useState(false);
  const firstView = useRef(true);
  const [loaderKey, setLoaderKey] = useState(0);

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-visible", menu);
    return () => document.body.classList.remove("mobile-menu-visible");
  }, [menu]);

  useEffect(() => {
    setMenu(false);
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    setLoaderKey((k) => k + 1);
    setPlaying(true);
    const id = setTimeout(() => setPlaying(false), 1600);
    return () => clearTimeout(id);
  }, [location.pathname]);

  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <p className="demo-banner">Demonstration build for registration, rewards, and audit workflows. This is not the official Government of Andhra Pradesh website.</p>
      <header className="main-header header-style-two">
        <div className="top-nav">
          <div className="container-fluid">
            <div className="row justify-content-between align-items-center">
              <div className="col-xl-3 col-12 text-start">
                <div className="minister">
                  <img src={`${SITE}/assets/images/cm-chandrababu.png`} alt="" />
                  <div className="content">
                    <h4>Sri Nara Chandrababu Naidu</h4>
                    <p>Hon’ble Chief Minister,<br />Government of Andhra Pradesh</p>
                  </div>
                </div>
              </div>
              <div className="col-xl-6 col-12 text-center">
                <div className="logo">
                  <Link to="/"><img src="/saap-logo.png" alt="Sports Authority of Andhra Pradesh" className="img-fluid" /></Link>
                </div>
              </div>
              <div className="col-xl-3 col-12 text-end">
                <div className="minister justify-content-end">
                  <div className="content">
                    <h4>Sri Mandipalli Ramprasad Reddy</h4>
                    <p>Hon’ble Minister of Transport, Youth & Sports,<br />Government of Andhra Pradesh</p>
                  </div>
                  <img src={`${SITE}/assets/images/mandipalli-ramprasad.png`} alt="" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="header-lower">
          <div className="main-box">
            <div className="nav-outer">
              <nav className="nav main-menu" aria-label="Primary">
                <MenuList />
              </nav>
            </div>
            <div className="outer-box">
              <div className="btn-box">
                {user ? (
                  <>
                    <Link to="/dashboard" className="theme-btn btn-style-one text-white"><span className="btn-title">My Account</span></Link>
                    <button type="button" className="theme-btn btn-style-one text-white" onClick={logout}><span className="btn-title">Sign out</span></button>
                  </>
                ) : (
                  <Link to="/login" className="theme-btn btn-style-one text-white"><span className="btn-title">Login</span></Link>
                )}
              </div>
              <button type="button" className="mobile-nav-toggler" aria-label="Open menu" onClick={() => setMenu(true)}>
                <span className="fas fa-bars" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="mobile-menu">
        <div className="menu-backdrop" onClick={() => setMenu(false)} />
        <nav className="menu-box">
          <div className="upper-box">
            <div className="nav-logo"><img src={`${SITE}/assets/images/logo-sm.png`} alt="SAAP" /></div>
            <button type="button" className="close-btn" onClick={() => setMenu(false)} aria-label="Close menu">×</button>
          </div>
          <MenuList />
        </nav>
      </div>
      <main id="content" className={`page-surface${playing ? " is-transitioning" : ""}`} key={location.pathname}>
        <Outlet />
      </main>
      {playing && (
        <div className="play-overlay" key={loaderKey}>
          <PlayLoader label="Loading…" />
        </div>
      )}
      <footer>
        <div className="footer-tpl">
          <div className="container-fluid">
            <div className="row">
              <div className="col-xl-4 col-12">
                <div className="footer-link">
                  <h3 className="ft-heading">SAAP</h3>
                  <img src="/saap-logo.png" alt="" className="img-fluid" />
                  <p>Sports Authority of Andhra Pradesh (SAAP) was established in 1988 under The Andhra Pradesh Sports Authorities Act, 1988 and reconstituted in 1996 and 2010 for promoting sports in Andhra Pradesh.</p>
                  <p>{OFFICE.address}</p>
                  <p>{OFFICE.phones.join(", ")}</p>
                </div>
              </div>
              <div className="col-xl-5 col-12">
                <div className="footer-link">
                  <h3 className="ft-heading">Quick Links</h3>
                  <ul className="footer-modal">
                    <li><a href="https://www.ap.gov.in/" target="_blank" rel="noreferrer">AP State Portal</a></li>
                    <li><a href="https://sportsauthorityofindia.nic.in/sai/" target="_blank" rel="noreferrer">Sports Authority of India</a></li>
                    <li><a href="https://kheloindia.gov.in/" target="_blank" rel="noreferrer">Khelo India</a></li>
                    <li><a href="https://yas.gov.in/" target="_blank" rel="noreferrer">Youth Affairs and Sports</a></li>
                    <li><a href="https://nsrs.kheloindia.gov.in/#/home" target="_blank" rel="noreferrer">National Sports Repository System</a></li>
                  </ul>
                </div>
              </div>
              <div className="col-xl-3 col-12">
                <div className="footer-link">
                  <h3 className="ft-heading">Visitors</h3>
                  <p className="highlight-text">Last Updated : <strong className="text-white">{OFFICE.updated}</strong></p>
                  <p className="highlight-text">Visitors Count : <strong className="text-white">{OFFICE.visitors}</strong></p>
                </div>
              </div>
            </div>
            <div className="policy">
              <ul className="policy-links">
                <li><Link to="/legal/copyright">Copyright Policy</Link></li>
                <li><Link to="/legal/privacy">Privacy Policy</Link></li>
                <li><Link to="/legal/terms">Terms & Conditions</Link></li>
                <li><Link to="/legal/security">Security Policy</Link></li>
                <li><Link to="/legal/help">Help</Link></li>
              </ul>
            </div>
          </div>
          <div className="bottom-footer">
            <p>Copyright © 2024 Sports Authority of Andhra Pradesh. All Rights Reserved</p>
            <p className="tech-partner-note">Digital portal technology partner: Hithlaksh Solutions · Ask the AI BI agent for partner details</p>
          </div>
        </div>
      </footer>
      <Widgets />
    </>
  );
}
