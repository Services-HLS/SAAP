import { useMemo, useState } from "react";

const LOW_STOCK = 5;

const FLOW_STEPS = [
  { n: 1, title: "Stock", text: "Add or restock" },
  { n: 2, title: "Issue", text: "Assign to player" },
  { n: 3, title: "Acknowledge", text: "Player confirms" },
  { n: 4, title: "Return", text: "Restore stock" },
];

export default function AdminKitsPanel({
  inventory = { items: [], acknowledgements: [] },
  registrations = [],
  act,
  issueStudent,
  setIssueStudent,
  itemId,
  setItemId,
  newItem,
  setNewItem,
}) {
  const [kitFilter, setKitFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [issueQty, setIssueQty] = useState("1");
  const [restockQty, setRestockQty] = useState("5");
  const [restockItemId, setRestockItemId] = useState("");
  const [busy, setBusy] = useState("");

  const items = inventory.items || [];
  const acks = inventory.acknowledgements || [];

  const students = useMemo(() => {
    const map = new Map();
    for (const row of registrations || []) {
      if (!row.student_id || map.has(row.student_id)) continue;
      map.set(row.student_id, {
        id: row.student_id,
        label: `${row.student || `Player #${row.student_id}`}${row.district ? ` · ${row.district}` : ""}`,
      });
    }
    return [...map.values()];
  }, [registrations]);

  const lowStockItems = items.filter((item) => Number(item.stock) <= LOW_STOCK);
  const pendingAcks = acks.filter((a) => a.status === "pending");
  const acknowledged = acks.filter((a) => a.status === "acknowledged");
  const returned = acks.filter((a) => a.status === "returned");
  const totalStock = items.reduce((sum, item) => sum + Number(item.stock || 0), 0);

  const filteredKits = useMemo(() => {
    const q = kitFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.name}`.toLowerCase().includes(q));
  }, [items, kitFilter]);

  const filteredAcks = useMemo(() => {
    if (statusFilter === "all") return acks;
    return acks.filter((a) => a.status === statusFilter);
  }, [acks, statusFilter]);

  const selectedItemId = Number(itemId || items[0]?.id || 0);
  const restockTarget = Number(restockItemId || items[0]?.id || 0);
  const activeStep = items.length === 0 ? 1 : pendingAcks.length > 0 ? 3 : acknowledged.length > 0 ? 4 : 2;

  async function run(key, fn) {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="kit-desk">
      <header className="kit-intro">
        <div>
          <h3>Inventory of Kits</h3>
          <p>Add stock, issue to players, track acknowledgement, and record returns that restore inventory.</p>
        </div>
        <div className="kit-intro-stats" aria-label="Kit summary">
          <span><b>{items.length}</b> items</span>
          <span><b>{totalStock}</b> in stock</span>
          <span className={lowStockItems.length ? "is-warn" : ""}><b>{lowStockItems.length}</b> low</span>
          <span><b>{pendingAcks.length}</b> pending</span>
        </div>
      </header>

      <ol className="kit-flow" aria-label="Kit inventory workflow">
        {FLOW_STEPS.map((step, i) => (
          <li key={step.n} className={step.n === activeStep ? "is-active" : step.n < activeStep ? "is-done" : ""}>
            <span>{step.n}</span>
            <div>
              <strong>{step.title}</strong>
              <em>{step.text}</em>
            </div>
            {i < FLOW_STEPS.length - 1 && <i className="kit-flow-arrow" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {lowStockItems.length > 0 && (
        <p className="kit-alert" role="status">
          Low stock (≤ {LOW_STOCK}): {lowStockItems.map((item) => `${item.name} (${item.stock})`).join(" · ")}
        </p>
      )}

      <div className="kit-work-grid">
        <section className="kit-panel">
          <div className="kit-panel-head">
            <div>
              <em>Step 1</em>
              <h3>Kit stock</h3>
            </div>
            <input
              className="kit-search"
              value={kitFilter}
              onChange={(e) => setKitFilter(e.target.value)}
              placeholder="Search kits…"
              aria-label="Filter kits"
            />
          </div>

          <div className="kit-stock-list">
            {filteredKits.length === 0 && (
              <p className="kit-empty">No kit items yet. Add the first item below.</p>
            )}
            {filteredKits.map((item) => {
              const low = Number(item.stock) <= LOW_STOCK;
              return (
                <article key={item.id} className={`kit-stock-card${low ? " is-low" : ""}`}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{low ? "Needs restock" : "Stock healthy"}</span>
                  </div>
                  <b>{item.stock}</b>
                </article>
              );
            })}
          </div>

          <div className="kit-form-stack">
            <form
              className="kit-form"
              onSubmit={(e) => {
                e.preventDefault();
                run("add", async () => {
                  await act("/api/inventory/items", { name: newItem.name, stock: Number(newItem.stock) });
                  setNewItem({ name: "", stock: "10" });
                });
              }}
            >
              <p className="kit-form-title">Add new item</p>
              <div className="kit-form-row">
                <label>
                  Kit name
                  <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Track suit" required />
                </label>
                <label className="kit-field-sm">
                  Opening stock
                  <input type="number" min="0" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })} required />
                </label>
                <button className="kit-btn kit-btn-primary" type="submit" disabled={busy === "add"}>
                  {busy === "add" ? "Adding…" : "Add item"}
                </button>
              </div>
            </form>

            {items.length > 0 && (
              <form
                className="kit-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  run("restock", async () => {
                    await act(`/api/inventory/items/${restockTarget}/restock`, { quantity: Number(restockQty) });
                    setRestockQty("5");
                  });
                }}
              >
                <p className="kit-form-title">Restock existing</p>
                <div className="kit-form-row">
                  <label>
                    Item
                    <select value={restockTarget || ""} onChange={(e) => setRestockItemId(e.target.value)}>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.stock})</option>
                      ))}
                    </select>
                  </label>
                  <label className="kit-field-sm">
                    Add qty
                    <input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} required />
                  </label>
                  <button className="kit-btn kit-btn-ghost" type="submit" disabled={busy === "restock"}>
                    {busy === "restock" ? "Updating…" : "Restock"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="kit-panel">
          <div className="kit-panel-head">
            <div>
              <em>Step 2</em>
              <h3>Issue to player</h3>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="kit-empty">Add a kit item first, then issue it here.</p>
          ) : (
            <form
              className="kit-form kit-issue-form"
              onSubmit={(e) => {
                e.preventDefault();
                run("issue", async () => {
                  await act("/api/inventory/issue", {
                    item_id: selectedItemId,
                    student_id: Number(issueStudent),
                    quantity: Number(issueQty) || 1,
                  });
                });
              }}
            >
              <label>
                Kit item
                <select value={selectedItemId || ""} onChange={(e) => setItemId(e.target.value)}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id} disabled={item.stock < 1}>
                      {item.name} — {item.stock} available
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Player
                {students.length > 0 ? (
                  <select value={issueStudent} onChange={(e) => setIssueStudent(e.target.value)} required>
                    <option value="">Select registered player</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.label} (#{s.id})</option>
                    ))}
                  </select>
                ) : (
                  <input value={issueStudent} onChange={(e) => setIssueStudent(e.target.value)} placeholder="Student id" required />
                )}
              </label>
              <label className="kit-field-sm">
                Quantity
                <input type="number" min="1" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} required />
              </label>
              <button className="kit-btn kit-btn-primary kit-btn-wide" type="submit" disabled={busy === "issue" || !selectedItemId}>
                {busy === "issue" ? "Issuing…" : "Issue kit"}
              </button>
              <p className="kit-hint">Stock drops immediately. The player must acknowledge receipt on their desk.</p>
            </form>
          )}

          <div className="kit-mini-kpis">
            <article><span>Acknowledged</span><b>{acknowledged.length}</b></article>
            <article><span>Returned</span><b>{returned.length}</b></article>
            <article><span>Pending</span><b>{pendingAcks.length}</b></article>
          </div>
        </section>
      </div>

      <section className="kit-panel kit-records">
        <div className="kit-panel-head">
          <div>
            <em>Steps 3–4</em>
            <h3>Issue & return records</h3>
          </div>
          <div className="kit-status-filters" role="group" aria-label="Filter by status">
            {[
              ["all", "All", acks.length],
              ["pending", "Pending", pendingAcks.length],
              ["acknowledged", "Acknowledged", acknowledged.length],
              ["returned", "Returned", returned.length],
            ].map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                className={statusFilter === id ? "on" : ""}
                onClick={() => setStatusFilter(id)}
              >
                {label} <em>{count}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="kit-table-wrap">
          <table className="kit-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Player</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAcks.length === 0 && (
                <tr><td colSpan={6} className="kit-empty-cell">No records for this filter.</td></tr>
              )}
              {filteredAcks.map((ack) => (
                <tr key={ack.id}>
                  <td><strong>{ack.item}</strong></td>
                  <td>
                    <span className="kit-player">{ack.student}</span>
                    <small>#{ack.student_id}</small>
                  </td>
                  <td>{ack.quantity}</td>
                  <td><em className={`kit-status is-${ack.status}`}>{ack.status}</em></td>
                  <td>{ack.issued_at ? String(ack.issued_at).slice(0, 10) : "—"}</td>
                  <td>
                    {ack.status === "acknowledged" ? (
                      <button
                        type="button"
                        className="kit-btn kit-btn-ghost kit-btn-sm"
                        disabled={busy === `ret-${ack.id}`}
                        onClick={() => run(`ret-${ack.id}`, () => act(`/api/inventory/ack/${ack.id}/return`))}
                      >
                        {busy === `ret-${ack.id}` ? "…" : "Mark returned"}
                      </button>
                    ) : ack.status === "pending" ? (
                      <span className="kit-wait">Waiting for player</span>
                    ) : (
                      <span className="kit-wait">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
