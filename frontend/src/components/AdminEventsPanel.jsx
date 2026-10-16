import { useEffect, useMemo, useState } from "react";
import {
  SAAP_EVENT_REPORTS,
  eventStatusLabel,
  formatInr,
} from "../data/saapReports";
import {
  buildEventPlayers,
  loadVerifyMap,
  saveVerifyMap,
} from "../data/saapEventPlayers";
import DeskIcon from "./DeskIcon";

const TABS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "live", label: "Live" },
  { id: "completed", label: "Completed" },
];

function statusTone(status) {
  if (status === "completed") return "is-done";
  if (status === "live") return "is-live";
  return "is-next";
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function FingerprintScan({ player, onVerify, onCancel, busy }) {
  return (
    <div className="evt-fp-panel" role="dialog" aria-modal="true" aria-labelledby="evt-fp-title">
      <div className="evt-fp-card">
        <div className="evt-fp-player">
          <span className="evt-avatar" aria-hidden="true">{initials(player.name)}</span>
          <div>
            <strong>{player.name}</strong>
            <em>{player.sport} · {player.aadhaar}</em>
          </div>
        </div>

        <h3 id="evt-fp-title">Fingerprint check-in</h3>
        <p className="evt-fp-sub">Place finger on the scanner. When the match completes, confirm below.</p>

        <div className="evt-fp-stage" aria-hidden="true">
          <div className="evt-fp-pulse" />
          <div className="evt-fp-pulse is-delay" />
          <svg className="evt-fp-icon" viewBox="0 0 24 24" width="92" height="92">
            <path
              fill="currentColor"
              d="M12 2a7 7 0 0 1 7 7v1h-2V9a5 5 0 0 0-10 0v6a3 3 0 0 0 6 0v-4a1 1 0 0 0-2 0v4a1 1 0 0 1-2 0V9a3 3 0 0 1 6 0v4h2V9a5 5 0 0 0-10 0v6a5 5 0 0 0 10 0v-1h2v1a7 7 0 0 1-14 0V9a7 7 0 0 1 7-7z"
            />
          </svg>
          <div className="evt-fp-scanline" />
        </div>

        <p className="evt-fp-hint">Scanning… matching Aadhaar biometric template</p>

        <div className="evt-fp-actions">
          <button type="button" className="evt-btn-verify" disabled={busy} onClick={onVerify}>
            <DeskIcon name="check" /> Verified
          </button>
          <button type="button" className="evt-btn-ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminEventsPanel() {
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [sportFilter, setSportFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [verifyMap, setVerifyMap] = useState(() => loadVerifyMap());
  const [scanning, setScanning] = useState(null);
  const [busy, setBusy] = useState(false);

  const events = useMemo(() => {
    const rows = [...SAAP_EVENT_REPORTS].sort((a, b) => String(b.start).localeCompare(String(a.start)));
    if (tab === "all") return rows;
    return rows.filter((e) => e.status === tab);
  }, [tab]);

  const selected = useMemo(
    () => SAAP_EVENT_REPORTS.find((e) => e.id === selectedId) || null,
    [selectedId],
  );

  const roster = useMemo(() => (selected ? buildEventPlayers(selected) : []), [selected]);

  const sportsInEvent = useMemo(() => {
    const set = new Set(roster.map((p) => p.sport));
    return [...set].sort();
  }, [roster]);

  const enriched = useMemo(() => roster.map((p) => {
    const override = verifyMap[p.id];
    const verified = override === true || (override !== false && p.defaultVerified);
    return { ...p, verified };
  }), [roster, verifyMap]);

  const players = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((p) => {
      if (sportFilter !== "all" && p.sport !== sportFilter) return false;
      if (!q) return true;
      return `${p.name} ${p.aadhaar} ${p.village} ${p.mandal} ${p.district} ${p.sport} ${p.registrationNo}`
        .toLowerCase()
        .includes(q);
    });
  }, [enriched, sportFilter, query]);

  const verifiedCount = enriched.filter((p) => p.verified).length;
  const pendingCount = enriched.length - verifiedCount;

  useEffect(() => {
    setSportFilter("all");
    setQuery("");
    setScanning(null);
  }, [selectedId]);

  function markVerified(playerId) {
    setBusy(true);
    window.setTimeout(() => {
      setVerifyMap((prev) => {
        const next = { ...prev, [playerId]: true };
        saveVerifyMap(next);
        return next;
      });
      setScanning(null);
      setBusy(false);
    }, 450);
  }

  function canVerify(event) {
    return event && (event.status === "upcoming" || event.status === "live");
  }

  const counts = useMemo(() => ({
    all: SAAP_EVENT_REPORTS.length,
    upcoming: SAAP_EVENT_REPORTS.filter((e) => e.status === "upcoming").length,
    live: SAAP_EVENT_REPORTS.filter((e) => e.status === "live").length,
    completed: SAAP_EVENT_REPORTS.filter((e) => e.status === "completed").length,
  }), []);

  return (
    <div className="evt-desk">
      {!selected && (
        <>
          <header className="evt-intro">
            <div>
              <h3>SAAP event desk</h3>
              <p>Open an event to review registered players and run biometric verification.</p>
            </div>
            <div className="evt-intro-stats">
              <span><b>{counts.upcoming}</b> upcoming</span>
              <span><b>{counts.live}</b> live</span>
              <span><b>{counts.completed}</b> completed</span>
            </div>
          </header>

          <div className="evt-tabs" role="tablist" aria-label="Event status">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? "is-on" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                <em>{counts[t.id]}</em>
              </button>
            ))}
          </div>

          <div className="evt-list">
            {events.length === 0 && <p className="saap-desk-empty">No events in this status.</p>}
            {events.map((event) => (
              <button
                key={event.id}
                type="button"
                className={`evt-card tone-${event.status}`}
                onClick={() => setSelectedId(event.id)}
              >
                <div className="evt-card-top">
                  <span className={`evt-pill ${statusTone(event.status)}`}>{eventStatusLabel(event.status)}</span>
                  <em>{event.year}</em>
                </div>
                <strong>{event.name}</strong>
                <p className="evt-card-sports">{event.sports.slice(0, 3).join(" · ")}{event.sports.length > 3 ? ` +${event.sports.length - 3}` : ""}</p>
                <p className="evt-card-meta"><DeskIcon name="event" /> {event.venue}</p>
                <p className="evt-card-meta">{event.district} · {event.start}{event.end && event.end !== event.start ? ` → ${event.end}` : ""}</p>
                <div className="evt-card-stats">
                  <span><b>{event.registered.toLocaleString("en-IN")}</b> registered</span>
                  <span><b>{event.participated.toLocaleString("en-IN")}</b> participated</span>
                  <span><b>{formatInr(event.costInr)}</b></span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && (
        <div className="evt-detail">
          <section className={`evt-hero tone-${selected.status}`}>
            <div className="evt-hero-top">
              <button type="button" className="evt-back" onClick={() => setSelectedId(null)}>
                ← All events
              </button>
              <span className={`evt-pill ${statusTone(selected.status)}`}>{eventStatusLabel(selected.status)}</span>
            </div>
            <h3>{selected.name}</h3>
            <p className="evt-hero-meta">
              {selected.venue} · {selected.district} · {selected.start}
              {selected.end && selected.end !== selected.start ? ` → ${selected.end}` : ""}
            </p>
            <p className="evt-hero-org">
              Organised by {selected.organisedBy}
              <br />
              Conducted by {selected.conductedBy}
            </p>
            <div className="evt-kpi-row">
              <article>
                <span>Registered (sample)</span>
                <strong>{roster.length}</strong>
              </article>
              <article>
                <span>Verified</span>
                <strong>{verifiedCount}</strong>
              </article>
              <article>
                <span>Pending</span>
                <strong>{pendingCount}</strong>
              </article>
              <article>
                <span>Sports</span>
                <strong>{sportsInEvent.length}</strong>
              </article>
            </div>
            {selected.status === "completed" && (
              <p className="evt-banner is-lock">Verification locked · participated players are Verified; others stay Not verified</p>
            )}
            {selected.status === "live" && (
              <p className="evt-banner is-live">Live check-in · participated players Verified · remaining can still be verified</p>
            )}
            {selected.status === "upcoming" && (
              <p className="evt-banner is-next">Upcoming · tap fingerprint on a player, then confirm with Verified</p>
            )}
          </section>

          <div className="evt-toolbar">
            <label>
              Sport
              <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}>
                <option value="all">All sports</option>
                {sportsInEvent.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="evt-search">
              Search
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, Aadhaar, village…"
              />
            </label>
            <p className="evt-result-count">{players.length} player{players.length === 1 ? "" : "s"}</p>
          </div>

          <div className="evt-player-grid">
            {players.length === 0 && <p className="saap-desk-empty">No players match filters.</p>}
            {players.map((player) => (
              <article key={player.id} className={`evt-player ${player.verified ? "is-ok" : "is-wait"}`}>
                <div className="evt-player-top">
                  <span className="evt-avatar" aria-hidden="true">{initials(player.name)}</span>
                  <div className="evt-player-id">
                    <strong>{player.name}</strong>
                    <em>{player.sport} · {player.ageGroup} · {player.gender}</em>
                  </div>
                  {player.verified
                    ? <span className="evt-status is-ok">Verified</span>
                    : <span className="evt-status is-wait">Not verified</span>}
                </div>

                <dl className="evt-player-dl">
                  <div><dt>Aadhaar</dt><dd className="evt-mono">{player.aadhaar}</dd></div>
                  <div><dt>Village</dt><dd>{player.village}</dd></div>
                  <div><dt>Mandal</dt><dd>{player.mandal}</dd></div>
                  <div><dt>District</dt><dd>{player.district}</dd></div>
                  <div><dt>Reg. no.</dt><dd className="evt-mono">{player.registrationNo}</dd></div>
                  <div><dt>Category</dt><dd>{player.category}</dd></div>
                </dl>

                <div className="evt-player-actions">
                  {player.verified ? (
                    <span className="evt-verified-mark"><DeskIcon name="check" /> Biometric verified</span>
                  ) : canVerify(selected) ? (
                    <button
                      type="button"
                      className="evt-fp-cta"
                      onClick={() => setScanning(player)}
                    >
                      <DeskIcon name="fingerprint" />
                      Verify with fingerprint
                    </button>
                  ) : (
                    <span className="evt-locked-note">Verification closed for completed events</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {scanning && (
        <FingerprintScan
          player={scanning}
          busy={busy}
          onCancel={() => setScanning(null)}
          onVerify={() => markVerified(scanning.id)}
        />
      )}
    </div>
  );
}
