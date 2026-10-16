import { useEffect, useMemo, useState } from "react";
import {
  SAAP_EVENT_REPORTS,
  SAAP_REPORT_SOURCES,
  eventStatusLabel,
  formatInr,
  formatInrCompact,
} from "../data/saapReports";

const COLORS = ["#118DFF", "#12239E", "#E66C37", "#6B007B", "#E044A7", "#744EC2", "#D9B300", "#D64550", "#01B8AA", "#FD625E"];

function statusClass(status) {
  if (status === "completed") return "is-done";
  if (status === "live") return "is-live";
  return "is-next";
}

function PowerBiLoader({ label = "Loading your Power BI report…" }) {
  return (
    <div className="pbi-loader" role="status" aria-live="polite">
      <div className="pbi-loader-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" className="pbi-loader-logo">
          <rect x="8" y="28" width="10" height="28" rx="2" fill="#F2C811" className="pbi-bar b1" />
          <rect x="22" y="18" width="10" height="38" rx="2" fill="#F2C811" className="pbi-bar b2" />
          <rect x="36" y="8" width="10" height="48" rx="2" fill="#F2C811" className="pbi-bar b3" />
          <circle cx="52" cy="14" r="6" fill="#F2C811" className="pbi-dot" />
        </svg>
        <div className="pbi-loader-ring" />
      </div>
      <strong>Power BI</strong>
      <p>{label}</p>
      <div className="pbi-loader-dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  );
}

function BarChart({ series, labels, colors = COLORS }) {
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const groupCount = Math.max(labels.length, 1);
  const barSlots = Math.max(series.length, 1);
  const chartW = Math.max(320, groupCount * 72);
  const chartH = 168;
  const padL = 40;
  const padB = 28;
  const padT = 10;
  const padR = 12;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const groupW = innerW / groupCount;
  const barW = Math.min(20, (groupW * 0.72) / barSlots);

  return (
    <div className="pbi-viz">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={chartW - padR} y1={y} y2={y} className="pbi-grid-line" />
              <text x={padL - 8} y={y + 3} className="pbi-axis" textAnchor="end">{Math.round(max * t).toLocaleString("en-IN")}</text>
            </g>
          );
        })}
        {labels.map((label, i) => {
          const gx = padL + i * groupW + groupW / 2;
          return (
            <g key={`${label}-${i}`}>
              {series.map((s, si) => {
                const val = s.values[i] || 0;
                const h = (val / max) * innerH;
                const x = gx - (barSlots * barW) / 2 + si * barW;
                const y = padT + innerH - h;
                return (
                  <rect key={s.name} x={x} y={y} width={Math.max(barW - 3, 4)} height={Math.max(h, 0)} rx="2" fill={colors[si % colors.length]}>
                    <title>{`${s.name} · ${label}: ${val.toLocaleString("en-IN")}`}</title>
                  </rect>
                );
              })}
              <text x={gx} y={chartH - 12} className="pbi-axis" textAnchor="middle">{label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HorizontalBars({ items, color = "#118DFF" }) {
  const max = Math.max(...items.map((i) => i.value || 0), 1);
  const rowH = 24;
  const h = Math.max(140, items.length * rowH + 8);
  const width = 480;
  const labelW = 108;
  return (
    <div className="pbi-viz">
      <svg viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="xMidYMid meet" role="img">
        {items.map((item, i) => {
          const y = 10 + i * rowH;
          const w = ((item.value || 0) / max) * (width - labelW - 78);
          return (
            <g key={item.label}>
              <text x={labelW - 8} y={y + 14} className="pbi-axis" textAnchor="end">{item.label}</text>
              <rect x={labelW} y={y + 4} width={Math.max(w, 3)} height={16} rx="2" fill={color} />
              <text x={labelW + w + 8} y={y + 16} className="pbi-axis">{(item.value || 0).toLocaleString("en-IN")}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ slices }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const size = 160;
  const r = 54;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -Math.PI / 2;
  const arcs = slices.map((slice, i) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { ...slice, d, color: COLORS[i % COLORS.length] };
  });
  return (
    <div className="pbi-donut-wrap">
      <div className="pbi-viz pbi-viz-donut">
        <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" role="img">
          {arcs.map((a) => (
            <path key={a.label} d={a.d} fill={a.color}>
              <title>{`${a.label}: ${a.value}`}</title>
            </path>
          ))}
          <circle cx={cx} cy={cy} r="30" fill="#fff" />
          <text x={cx} y={cy - 2} className="pbi-donut-total" textAnchor="middle">{total}</text>
          <text x={cx} y={cy + 12} className="pbi-donut-sub" textAnchor="middle">events</text>
        </svg>
      </div>
      <ul className="pbi-legend">
        {arcs.map((a) => (
          <li key={a.label}><span style={{ background: a.color }} />{a.label}<b>{a.value}</b></li>
        ))}
      </ul>
    </div>
  );
}

function LineChart({ points, color = "#E66C37" }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = Math.max(320, points.length * 72);
  const height = 168;
  const padL = 40;
  const padB = 28;
  const padT = 12;
  const padR = 12;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const coords = points.map((p, i) => {
    const x = padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const y = padT + innerH - (p.value / max) * innerH;
    return { ...p, x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area = `${path} L ${coords[coords.length - 1]?.x || padL} ${padT + innerH} L ${coords[0]?.x || padL} ${padT + innerH} Z`;
  return (
    <div className="pbi-viz">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} className="pbi-grid-line" />
              <text x={padL - 8} y={y + 3} className="pbi-axis" textAnchor="end">{Math.round(max * t / 100000) / 10}L</text>
            </g>
          );
        })}
        <path d={area} fill={color} opacity="0.15" />
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        {coords.map((c) => (
          <g key={c.label}>
            <circle cx={c.x} cy={c.y} r="5" fill={color} stroke="#fff" strokeWidth="2" />
            <text x={c.x} y={height - 14} className="pbi-axis" textAnchor="middle">{c.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AdminReportsPanel({ reports, events = [], downloadReport, onClose }) {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("all");
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.documentElement.classList.add("saap-desk-mode");
    document.body.classList.add("saap-desk-mode");
  }, []);

  useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => setLoading(false), 1400);
    return () => clearTimeout(id);
  }, [year, sport, status, query]);

  const years = useMemo(
    () => [...new Set(SAAP_EVENT_REPORTS.map((row) => row.year))].sort((a, b) => b - a),
    [],
  );
  const sports = useMemo(() => {
    const set = new Set();
    SAAP_EVENT_REPORTS.forEach((row) => {
      row.sports.forEach((s) => set.add(s));
      if (row.sport) set.add(row.sport);
    });
    return [...set].sort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SAAP_EVENT_REPORTS.filter((row) => {
      if (year !== "all" && String(row.year) !== String(year)) return false;
      if (status !== "all" && row.status !== status) return false;
      if (sport !== "all" && !(row.sport === sport || row.sports.includes(sport))) return false;
      if (!q) return true;
      return `${row.name} ${row.venue} ${row.district} ${row.organisedBy} ${row.conductedBy} ${row.sports.join(" ")}`
        .toLowerCase()
        .includes(q);
    }).sort((a, b) => String(b.start).localeCompare(String(a.start)));
  }, [year, sport, status, query]);

  const totals = useMemo(() => {
    const conducted = filtered.filter((r) => r.status === "completed").length;
    const live = filtered.filter((r) => r.status === "live").length;
    const upcoming = filtered.filter((r) => r.status === "upcoming").length;
    const cost = filtered.reduce((sum, row) => sum + (row.costInr || 0), 0);
    const registered = filtered.reduce((sum, row) => sum + (row.registered || 0), 0);
    const participated = filtered.reduce((sum, row) => sum + (row.participated || 0), 0);
    const games = new Set();
    filtered.forEach((row) => row.sports.forEach((s) => games.add(s)));
    return { events: filtered.length, conducted, live, upcoming, cost, registered, participated, games: games.size };
  }, [filtered]);

  const byYear = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const bucket = map.get(row.year) || { year: row.year, conducted: 0, live: 0, upcoming: 0, cost: 0, registered: 0, participated: 0 };
      if (row.status === "completed") bucket.conducted += 1;
      if (row.status === "live") bucket.live += 1;
      if (row.status === "upcoming") bucket.upcoming += 1;
      bucket.cost += row.costInr || 0;
      bucket.registered += row.registered || 0;
      bucket.participated += row.participated || 0;
      map.set(row.year, bucket);
    });
    return [...map.values()].sort((a, b) => a.year - b.year);
  }, [filtered]);

  const bySport = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      row.sports.forEach((sportName) => {
        const bucket = map.get(sportName) || { sport: sportName, events: 0, registered: 0, participated: 0, cost: 0 };
        bucket.events += 1;
        bucket.registered += row.registered || 0;
        bucket.participated += row.participated || 0;
        bucket.cost += Math.round((row.costInr || 0) / Math.max(row.sports.length, 1));
        map.set(sportName, bucket);
      });
    });
    return [...map.values()].sort((a, b) => b.registered - a.registered).slice(0, 8);
  }, [filtered]);

  const yearLabels = byYear.map((r) => String(r.year));
  const playersSeries = [
    { name: "Registered", values: byYear.map((r) => r.registered) },
    { name: "Participated", values: byYear.map((r) => r.participated) },
  ];
  const eventsSeries = [
    { name: "Conducted", values: byYear.map((r) => r.conducted) },
    { name: "Live", values: byYear.map((r) => r.live) },
    { name: "Upcoming", values: byYear.map((r) => r.upcoming) },
  ];
  const costPoints = byYear.map((r) => ({ label: String(r.year), value: r.cost }));
  const statusSlices = [
    { label: "Conducted", value: totals.conducted },
    { label: "Live", value: totals.live },
    { label: "Upcoming", value: totals.upcoming },
  ].filter((s) => s.value > 0);

  const kpis = [
    { label: "Total events", value: totals.events, tone: "blue" },
    { label: "Conducted", value: totals.conducted, tone: "teal" },
    { label: "Live now", value: totals.live, tone: "amber" },
    { label: "Upcoming", value: totals.upcoming, tone: "purple" },
    { label: "Sports / games", value: totals.games, tone: "pink" },
    { label: "Registered", value: totals.registered.toLocaleString("en-IN"), tone: "cyan" },
    { label: "Participated", value: totals.participated.toLocaleString("en-IN"), tone: "green" },
    { label: "Indicative cost", value: formatInrCompact(totals.cost), tone: "yellow" },
  ];

  return (
    <div className="pbi-shell">
      <div className="pbi-chrome">
        <div className="pbi-chrome-brand">
          <span className="pbi-chrome-logo" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="22" height="22">
              <rect x="2" y="12" width="5" height="12" rx="1" fill="#F2C811" />
              <rect x="9" y="8" width="5" height="16" rx="1" fill="#F2C811" />
              <rect x="16" y="3" width="5" height="21" rx="1" fill="#F2C811" />
              <circle cx="24" cy="6" r="3" fill="#F2C811" />
            </svg>
          </span>
          <div>
            <strong>Power BI</strong>
            <em>SAAP Andhra Pradesh Sports Report</em>
          </div>
        </div>
        <div className="pbi-chrome-actions">
          {downloadReport && <button type="button" className="pbi-btn" onClick={downloadReport}>Export</button>}
          {onClose && <button type="button" className="pbi-btn ghost" onClick={onClose}>Close</button>}
        </div>
      </div>

      {loading && <PowerBiLoader />}

      <div className={`pbi-workspace${loading ? " is-loading" : ""}`}>
        <aside className="pbi-filters-pane" aria-label="Filters">
          <h3>Filters</h3>
          <label>
            Year
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="all">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label>
            Sport / game
            <select value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="all">All sports</option>
              {sports.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="completed">Conducted</option>
              <option value="live">Live / ongoing</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </label>
          <label>
            Search
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Event, venue…" />
          </label>
          <div className="pbi-filter-note">
            <p>Slicers update all visuals on this page.</p>
            <p>Data: sports.ap.gov.in + public AP press coverage.</p>
          </div>
        </aside>

        <main className="pbi-canvas">
          <header className="pbi-canvas-title">
            <h1>Andhra Pradesh Sports Events Dashboard</h1>
            <p>Conducted, live and upcoming events · registrations · participation · organisers · indicative cost</p>
          </header>

          <section className="pbi-kpi-row">
            {kpis.map((kpi) => (
              <article key={kpi.label} className={`pbi-kpi tone-${kpi.tone}`}>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
              </article>
            ))}
          </section>

          <section className="pbi-grid">
            <article className="pbi-card r1c1">
              <div className="pbi-card-head">
                <h3>Players registered vs participated</h3>
                <div className="pbi-legend-inline">
                  <span><i style={{ background: COLORS[0] }} />Registered</span>
                  <span><i style={{ background: COLORS[1] }} />Participated</span>
                </div>
              </div>
              {byYear.length ? <BarChart labels={yearLabels} series={playersSeries} colors={[COLORS[0], COLORS[1]]} /> : <p className="pbi-empty">No data</p>}
            </article>

            <article className="pbi-card r1c2">
              <div className="pbi-card-head"><h3>Event status mix</h3></div>
              {statusSlices.length ? <DonutChart slices={statusSlices} /> : <p className="pbi-empty">No data</p>}
            </article>

            <article className="pbi-card r2c1">
              <div className="pbi-card-head">
                <h3>Events by year</h3>
                <div className="pbi-legend-inline">
                  <span><i style={{ background: COLORS[2] }} />Conducted</span>
                  <span><i style={{ background: COLORS[3] }} />Live</span>
                  <span><i style={{ background: COLORS[4] }} />Upcoming</span>
                </div>
              </div>
              {byYear.length ? <BarChart labels={yearLabels} series={eventsSeries} colors={[COLORS[2], COLORS[3], COLORS[4]]} /> : <p className="pbi-empty">No data</p>}
            </article>

            <article className="pbi-card r2c2">
              <div className="pbi-card-head"><h3>Indicative cost by year (₹ Lakh)</h3></div>
              {costPoints.length ? <LineChart points={costPoints} /> : <p className="pbi-empty">No data</p>}
            </article>

            <article className="pbi-card r3c1">
              <div className="pbi-card-head"><h3>Top sports by registrations</h3></div>
              {bySport.length ? <HorizontalBars items={bySport.map((r) => ({ label: r.sport, value: r.registered }))} color="#744EC2" /> : <p className="pbi-empty">No data</p>}
            </article>

            <article className="pbi-card r3c2">
              <div className="pbi-card-head"><h3>Top sports by cost share</h3></div>
              {bySport.length ? <HorizontalBars items={bySport.map((r) => ({ label: r.sport, value: r.cost }))} color="#D9B300" /> : <p className="pbi-empty">No data</p>}
            </article>

            <article className="pbi-card r4c1">
              <div className="pbi-card-head"><h3>Live portal snapshot</h3></div>
              <ul className="pbi-live-list">
                <li><span>Students</span><b>{reports?.students ?? "—"}</b></li>
                <li><span>Aadhaar verified</span><b>{reports?.verified_students ?? "—"}</b></li>
                <li><span>Pending regs</span><b>{reports?.registrations?.pending ?? "—"}</b></li>
                <li><span>Participated</span><b>{reports?.participated ?? "—"}</b></li>
                <li><span>Certificates</span><b>{reports?.certificates ?? "—"}</b></li>
                <li><span>Events listed</span><b>{events.length}</b></li>
              </ul>
            </article>

            <article className="pbi-card r4c2">
              <div className="pbi-card-head"><h3>Year summary</h3></div>
              <div className="pbi-table-wrap">
                <table className="pbi-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Conducted</th>
                      <th>Live</th>
                      <th>Upcoming</th>
                      <th>Registered</th>
                      <th>Participated</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...byYear].reverse().map((row) => (
                      <tr key={row.year}>
                        <td><strong>{row.year}</strong></td>
                        <td>{row.conducted}</td>
                        <td>{row.live}</td>
                        <td>{row.upcoming}</td>
                        <td>{row.registered.toLocaleString("en-IN")}</td>
                        <td>{row.participated.toLocaleString("en-IN")}</td>
                        <td>{formatInr(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="pbi-card pbi-detail-block">
            <div className="pbi-card-head"><h3>Event details</h3></div>
            <div className="pbi-event-grid">
              {filtered.length === 0 && <p className="pbi-empty">No events match filters.</p>}
              {filtered.map((row) => (
                <article key={row.id} className="pbi-event-card">
                  <div className="pbi-event-top">
                    <span className={`admin-report-pill ${statusClass(row.status)}`}>{eventStatusLabel(row.status)}</span>
                    <em>{row.year}</em>
                  </div>
                  <h4>{row.name}</h4>
                  <p>{row.sports.join(" · ")}</p>
                  <p className="pbi-muted">{row.venue} · {row.district}</p>
                  <p className="pbi-muted"><strong>Organised by:</strong> {row.organisedBy}</p>
                  <p className="pbi-muted"><strong>Conducted by:</strong> {row.conductedBy}</p>
                  <div className="pbi-event-stats">
                    <span>Reg {row.registered.toLocaleString("en-IN")}</span>
                    <span>Part {row.participated.toLocaleString("en-IN")}</span>
                    <span>{formatInr(row.costInr)}</span>
                  </div>
                  <p className="pbi-source">{row.source}</p>
                </article>
              ))}
            </div>
          </section>

          <footer className="pbi-foot">
            <p>Sources: {SAAP_REPORT_SOURCES.map((s) => s.label).join(" · ")}</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
