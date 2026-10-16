/**
 * Demo player rosters for SAAP admin Events desk.
 * Sample sizes stay UI-friendly while reflecting registered / participated ratios.
 */

const FIRST = [
  "Ananya", "Bhavani", "Chaitanya", "Divya", "Eswar", "Fathima", "Ganesh", "Harika",
  "Ishaan", "Jyothi", "Karthik", "Lavanya", "Manoj", "Nandini", "Omkar", "Priya",
  "Ravi", "Sneha", "Teja", "Usha", "Venkatesh", "Yashwanth", "Asha", "Bharath",
];

const LAST = [
  "Reddy", "Naidu", "Raju", "Rao", "Sharma", "Varma", "Singh", "Patel",
  "Chowdary", "Dasari", "Kandula", "Mekala", "Pothineni", "Yadav", "Begum", "Khan",
];

const VILLAGES = [
  { village: "Gannavaram", mandal: "Gannavaram", district: "Krishna" },
  { village: "Tadepalli", mandal: "Tadepalli", district: "Guntur" },
  { village: "Madhurawada", mandal: "Visakhapatnam Rural", district: "Visakhapatnam" },
  { village: "Renigunta", mandal: "Renigunta", district: "Tirupati" },
  { village: "Peddapuram", mandal: "Peddapuram", district: "Kakinada" },
  { village: "Nuzvid", mandal: "Nuzvid", district: "Eluru" },
  { village: "Proddatur", mandal: "Proddatur", district: "YSR Kadapa" },
  { village: "Adoni", mandal: "Adoni", district: "Kurnool" },
  { village: "Anakapalle", mandal: "Anakapalle", district: "Anakapalli" },
  { village: "Chirala", mandal: "Chirala", district: "Bapatla" },
  { village: "Srikalahasti", mandal: "Srikalahasti", district: "Tirupati" },
  { village: "Machilipatnam", mandal: "Machilipatnam", district: "Krishna" },
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(seed, list) {
  return list[seed % list.length];
}

function maskAadhaar(seed) {
  const last4 = String(1000 + (seed % 9000));
  return `XXXX-XXXX-${last4}`;
}

function sampleSize(registered) {
  if (!registered || registered <= 0) return 8;
  return Math.min(14, Math.max(6, Math.round(Math.min(registered, 40) / 3) + 4));
}

/**
 * Build a stable demo roster for one SAAP report event.
 * @param {object} event SAAP_EVENT_REPORTS row
 */
export function buildEventPlayers(event) {
  const count = sampleSize(event.registered);
  const sports = event.sports?.length ? event.sports : [event.sport || "General"];
  const participatedTarget = event.status === "upcoming"
    ? 0
    : Math.min(
      count,
      Math.max(0, Math.round(count * ((event.participated || 0) / Math.max(event.registered || 1, 1)))),
    );

  const players = [];
  for (let i = 0; i < count; i += 1) {
    const seed = hash(`${event.id}:${i}`);
    const place = pick(seed, VILLAGES);
    const sport = sports[i % sports.length];
    const participated = i < participatedTarget;
    players.push({
      id: `${event.id}-p${i + 1}`,
      name: `${pick(seed, FIRST)} ${pick(seed >>> 8, LAST)}`,
      aadhaar: maskAadhaar(seed >>> 4),
      sport,
      village: place.village,
      mandal: place.mandal,
      district: event.district?.includes("All") || event.district?.includes("Statewide") || event.district?.includes("Multi")
        ? place.district
        : (event.district || place.district),
      phone: `9${String(100000000 + (seed % 899999999)).slice(0, 9)}`,
      ageGroup: pick(seed >>> 12, ["U-14", "U-17", "U-19", "Senior"]),
      gender: seed % 2 === 0 ? "Male" : "Female",
      category: pick(seed >>> 16, ["General", "OBC", "SC", "ST"]),
      registrationNo: `SAAP-${event.year}-${String(1000 + i).slice(-4)}`,
      participated,
      /** Default biometric status before admin overrides */
      defaultVerified: event.status === "upcoming" ? false : participated,
    });
  }
  return players;
}

export const VERIFY_STORAGE_KEY = "saap-admin-event-player-verify";

export function loadVerifyMap() {
  try {
    const raw = localStorage.getItem(VERIFY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveVerifyMap(map) {
  try {
    localStorage.setItem(VERIFY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}
