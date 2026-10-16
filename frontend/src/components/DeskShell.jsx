import { useEffect, useRef, useState } from "react";
import DeskIcon from "./DeskIcon";

export default function DeskShell({
  brandTitle = "SAAP",
  brandSubtitle = "DESK",
  userName = "User",
  roleLabel = "",
  title = "Sports Authority of Andhra Pradesh",
  sections = [],
  activeId,
  onNavigate,
  onSignOut,
  notice,
  error,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bodyRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add("saap-desk-mode");
    document.body.classList.add("saap-desk-mode");
    return () => {
      document.documentElement.classList.remove("saap-desk-mode");
      document.body.classList.remove("saap-desk-mode");
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
      bodyRef.current.scrollLeft = 0;
    }
  }, [activeId, title]);

  return (
    <div className={`saap-desk app-desk${sidebarOpen ? "" : " is-collapsed"}`}>
      <aside className="saap-desk-sidebar" aria-label="Application navigation">
        <div className="saap-desk-brand">
          <img src="/saap-logo.png" alt="Sports Authority of Andhra Pradesh" />
          <div>
            <strong>{brandTitle}</strong>
            <span>{brandSubtitle}</span>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.label} className="saap-desk-nav-block">
            <p className="saap-desk-section">{section.label}</p>
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`saap-desk-link${activeId === item.id ? " is-on" : ""}`}
                onClick={() => onNavigate(item.id)}
              >
                <DeskIcon name={item.icon || "file"} />
                <span className="saap-desk-link-text">{item.label}</span>
                {item.badge != null && item.badge !== "" && <em className="saap-desk-badge">{item.badge}</em>}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className="saap-desk-main">
        <header className="saap-desk-top">
          <div className="saap-desk-top-left">
            <button type="button" className="saap-desk-burger" aria-label="Toggle menu" onClick={() => setSidebarOpen((v) => !v)}>
              <DeskIcon name="menu" />
            </button>
            <h1>{title}</h1>
          </div>
          <div className="saap-desk-top-right">
            <div className="saap-desk-user">
              <span className="saap-desk-avatar" aria-hidden="true"><DeskIcon name="user" /></span>
              <div className="saap-desk-user-meta">
                <strong>{userName}</strong>
                {roleLabel && <span>{roleLabel}</span>}
              </div>
              <button type="button" className="saap-desk-signout" onClick={onSignOut}>Sign out</button>
            </div>
          </div>
        </header>

        <div className="saap-desk-body" ref={bodyRef}>
          {notice && <p className="ok saap-desk-flash">{notice}</p>}
          {error && <p className="error saap-desk-flash" role="alert">{error}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
