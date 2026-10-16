const KEY = "saap-portal-v1";

export const ROLES = {
  citizen: "Citizen",
  athlete: "Athlete",
  coach: "Coach",
  officer: "District officer",
  admin: "SAAP admin",
};

const PERMISSIONS = {
  citizen: ["register", "book", "chat"],
  athlete: ["register", "book", "chat", "certificate.own"],
  coach: ["register", "book", "chat", "training.view"],
  officer: ["register", "book", "chat", "approve", "certificate.issue", "audit.read", "whatsapp.send", "ledger.read"],
  admin: ["register", "book", "chat", "approve", "certificate.issue", "audit.read", "whatsapp.send", "ledger.read", "users.manage", "ledger.anchor"],
};

export function can(role, action) {
  return (PERMISSIONS[role] || []).includes(action);
}

const USERS = [
  { id: "u-citizen", name: "Lalitha Rao", username: "citizen", password: "saap123", role: "citizen", district: "NTR", phone: "9000000001" },
  { id: "u-athlete", name: "Arjun Reddy", username: "athlete", password: "saap123", role: "athlete", district: "Guntur", phone: "9000000002" },
  { id: "u-coach", name: "Coach Meena", username: "coach", password: "saap123", role: "coach", district: "Visakhapatnam", phone: "9000000003" },
  { id: "u-officer", name: "DSA Officer Krishna", username: "officer", password: "saap123", role: "officer", district: "Krishna", phone: "9000000004" },
  { id: "u-admin", name: "SAAP Administrator", username: "admin", password: "saap123", role: "admin", district: "NTR", phone: "8977611399" },
];

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonical(block) {
  return JSON.stringify({
    index: block.index,
    time: block.time,
    actor: block.actor,
    action: block.action,
    payload: block.payload,
    prev: block.prev,
  });
}

async function makeBlock(index, actor, action, payload, prev) {
  const time = new Date().toISOString();
  const draft = { index, time, actor, action, payload, prev };
  const hash = await sha256(canonical(draft));
  return { ...draft, hash };
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

async function freshState() {
  const genesis = await makeBlock(0, "system", "GENESIS", { note: "SAAP records ledger opened for this portal" }, "0".repeat(64));
  const samplePayload = {
    certificateId: "SAAP-CAMP-2026-0142",
    holder: "Arjun Reddy",
    title: "Summer Coaching Camp 2026 — Athletics",
    district: "Guntur",
  };
  const sample = await makeBlock(1, "SAAP Administrator", "CERTIFICATE", samplePayload, genesis.hash);
  return {
    users: USERS,
    session: null,
    audit: [
      {
        id: uid("aud"),
        time: sample.time,
        actor: "SAAP Administrator",
        role: "admin",
        action: "CERTIFICATE_ISSUED",
        detail: "Seeded summer camp certificate SAAP-CAMP-2026-0142 for Arjun Reddy",
      },
    ],
    chain: [genesis, sample],
    applications: [
      {
        id: "app-seed-1",
        type: "player",
        status: "approved",
        name: "Arjun Reddy",
        phone: "9000000002",
        district: "Guntur",
        sport: "Athletics",
        age: "17",
        organisation: "Zilla Parishad High School",
        note: "District trials, 2026",
        createdBy: "athlete",
        createdAt: sample.time,
      },
    ],
    certificates: [
      {
        id: "SAAP-CAMP-2026-0142",
        holder: "Arjun Reddy",
        title: "Summer Coaching Camp 2026 — Athletics",
        district: "Guntur",
        issuedAt: sample.time,
        blockHash: sample.hash,
        owner: "athlete",
      },
    ],
    messages: [],
  };
}

let memory = null;
let boot = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(memory));
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(memory));
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initPlatform() {
  if (memory) return Promise.resolve(memory);
  if (!boot) {
    boot = (async () => {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        try {
          memory = JSON.parse(raw);
          if (!memory.chain?.length) throw new Error("empty");
          emit();
          return memory;
        } catch {
          localStorage.removeItem(KEY);
        }
      }
      memory = await freshState();
      persist();
      return memory;
    })();
  }
  return boot;
}

export function getState() {
  return memory;
}

export function currentUser() {
  if (!memory?.session) return null;
  return memory.users.find((u) => u.id === memory.session) || null;
}

function audit(action, detail, actorUser) {
  const actor = actorUser || currentUser();
  memory.audit.unshift({
    id: uid("aud"),
    time: new Date().toISOString(),
    actor: actor?.name || "Guest",
    role: actor?.role || "public",
    action,
    detail,
  });
}

async function appendBlock(action, payload, actorUser) {
  const actor = actorUser || currentUser();
  const prev = memory.chain[memory.chain.length - 1];
  const block = await makeBlock(prev.index + 1, actor?.name || "Guest", action, payload, prev.hash);
  memory.chain.push(block);
  return block;
}

export async function login(username, password) {
  const user = memory.users.find((u) => u.username === username.trim() && u.password === password);
  if (!user) {
    audit("LOGIN_FAILED", `Unknown or wrong password for “${username.trim() || "blank"}”`, { name: "Guest", role: "public" });
    persist();
    throw new Error("Those details do not match a portal account.");
  }
  memory.session = user.id;
  audit("LOGIN", `${user.name} signed in as ${ROLES[user.role]}`, user);
  persist();
  return user;
}

export function logout() {
  const user = currentUser();
  if (user) audit("LOGOUT", `${user.name} signed out`, user);
  memory.session = null;
  persist();
}

export async function submitApplication(form) {
  const user = currentUser();
  const item = {
    id: uid("app"),
    status: "pending",
    createdAt: new Date().toISOString(),
    createdBy: user?.username || "guest",
    ...form,
  };
  memory.applications.unshift(item);
  audit("APPLICATION", `${item.type} application ${item.id} filed by ${item.name}`, user);
  const block = await appendBlock("APPLICATION", { id: item.id, type: item.type, name: item.name, district: item.district, sport: item.sport }, user);
  item.blockHash = block.hash;
  persist();
  return item;
}

export async function decideApplication(id, decision, reason) {
  const user = currentUser();
  if (!user || !can(user.role, "approve")) throw new Error("Only a district officer or admin can decide applications.");
  const item = memory.applications.find((a) => a.id === id);
  if (!item || item.status !== "pending") throw new Error("That application is not waiting for a decision.");
  item.status = decision;
  item.decidedBy = user.name;
  item.decidedAt = new Date().toISOString();
  item.reason = reason || "";
  audit("DECISION", `${user.name} ${decision} ${item.id} (${item.name})`, user);
  let certificate = null;
  if (decision === "approved" && (item.type === "player" || item.type === "academy" || item.type === "camp")) {
    certificate = {
      id: `SAAP-${item.type.slice(0, 3).toUpperCase()}-${new Date().getFullYear()}-${String(memory.certificates.length + 1).padStart(4, "0")}`,
      holder: item.name,
      title:
        item.type === "academy"
          ? `State Sports Academy recognition — ${item.sport}`
          : item.type === "camp"
            ? `Summer Coaching Camp — ${item.sport}`
            : `Player registration — ${item.sport}`,
      district: item.district,
      issuedAt: new Date().toISOString(),
      owner: item.createdBy,
    };
    const block = await appendBlock("CERTIFICATE", { certificateId: certificate.id, holder: certificate.holder, title: certificate.title, district: certificate.district }, user);
    certificate.blockHash = block.hash;
    memory.certificates.unshift(certificate);
    item.certificateId = certificate.id;
  } else {
    await appendBlock("DECISION", { id: item.id, decision, name: item.name }, user);
  }
  persist();
  return { item, certificate };
}

export async function sendWhatsApp({ to, name, body, relatedId }) {
  const user = currentUser();
  const message = {
    id: uid("msg"),
    time: new Date().toISOString(),
    from: user?.name || "Citizen",
    to,
    name,
    body,
    relatedId: relatedId || "",
  };
  memory.messages.unshift(message);
  audit("WHATSAPP", `WhatsApp to ${name || to}: ${body.slice(0, 140)}`, user);
  const block = await appendBlock("WHATSAPP", { to, name, body, relatedId: relatedId || "" }, user);
  message.blockHash = block.hash;
  persist();
  const phone = String(to).replace(/\D/g, "");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
  return { message, url };
}

export async function anchorNote(note) {
  const user = currentUser();
  if (!user || !can(user.role, "ledger.anchor")) throw new Error("Only an admin can anchor a ledger note.");
  audit("LEDGER_NOTE", note, user);
  await appendBlock("NOTE", { note }, user);
  persist();
}

export async function verifyChain(chain = memory.chain) {
  const issues = [];
  for (let i = 0; i < chain.length; i += 1) {
    const block = chain[i];
    const expected = await sha256(canonical(block));
    if (expected !== block.hash) issues.push(`Block ${block.index} hash does not match its contents.`);
    if (i === 0 && block.prev !== "0".repeat(64)) issues.push("Genesis block is not linked to the zero hash.");
    if (i > 0 && block.prev !== chain[i - 1].hash) issues.push(`Block ${block.index} does not point at the previous block.`);
    if (block.index !== i) issues.push(`Block index ${block.index} is out of order.`);
  }
  return { ok: issues.length === 0, issues, length: chain.length };
}

export function findCertificate(id) {
  return memory.certificates.find((c) => c.id.toLowerCase() === id.trim().toLowerCase()) || null;
}

export async function verifyCertificateRecord(id) {
  const cert = findCertificate(id);
  if (!cert) return { found: false, intact: false, reason: "No certificate uses that ID." };
  const block = (memory.chain || []).find((item) => item.hash === cert.blockHash && item.action === "CERTIFICATE");
  if (!block) return { found: true, intact: false, cert, reason: "The certificate is stored, but no ledger block carries its hash." };
  const expected = await sha256(canonical(block));
  const payloadOk = block.payload?.certificateId === cert.id && block.payload?.holder === cert.holder && block.payload?.title === cert.title;
  const intact = expected === block.hash && payloadOk;
  return {
    found: true,
    intact,
    cert,
    reason: intact
      ? "The certificate fields match a ledger block, and that block’s hash still matches its contents."
      : "The certificate record does not match the ledger block.",
  };
}

export async function resetDemo() {
  memory = await freshState();
  persist();
}
