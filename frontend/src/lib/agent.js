import { OFFICE, SCHEMES, APPROACHES } from "../data/content";

/** Technology partner — used when users ask who built / supports the portal. */
export const TECH_PARTNER = {
  name: "Hithlaksh Solutions",
  short: "Hithlaksh",
  role: "Technology partner for this SAAP digital registration, certificates, and audit demonstration portal",
  focus: [
    "Secure registration and OTP sandbox workflows",
    "Role-based access for students, department staff, operators, accountants, auditors and admins",
    "Certificate QR verification and hash-chain audit trail",
    "Conversational help agent and WhatsApp enquiry routing",
  ],
};

export function readPortalSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("saap-portal") || "{}");
    if (saved?.token && saved?.role) return saved;
  } catch {
    /* ignore */
  }
  return null;
}

const ROLE_LABELS = {
  student: "Player / student",
  department: "Department officer",
  operator: "Venue operator",
  accountant: "Accountant",
  admin: "Administrator",
  auditor: "Auditor",
  citizen: "Citizen",
  athlete: "Athlete",
  coach: "Coach",
  officer: "District officer",
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || "Guest";
}

const PUBLIC_TOPICS = [
  {
    test: /(hithlaksh|tech(nology)? partner|who built|who developed|portal vendor|software partner)/,
    reply: `${TECH_PARTNER.name} is the ${TECH_PARTNER.role}. They support ${TECH_PARTNER.focus.slice(0, 3).join("; ")}. For SAAP programmes and sports policy, ask about schemes, events, or certificates; for partner questions, ask about Hithlaksh.`,
    links: [{ label: "Contact SAAP", to: "/contact" }, { label: "Registration platform", to: "/platform" }],
  },
  {
    test: /(contact|phone|address|office|where|timing|hour)/,
    reply: `SAAP head office is at ${OFFICE.address}. Call ${OFFICE.phones.join(" or ")}. Working hours: ${OFFICE.hours}. Use the green WhatsApp button for the approved mobile ${OFFICE.phones[1]}.`,
    links: [{ label: "Contact", to: "/contact" }],
  },
  {
    test: /(gaandiva|gandiva)/,
    reply: "Project Gaandiva is the Centre of Excellence tier — elite athletics hub with grass-root spokes in schools. Eligibility and intake notices appear under Schemes and Latest News.",
    links: [{ label: "Open Gaandiva", to: "/schemes/gaandiva" }],
  },
  {
    test: /(paancha|pancha|academ)/,
    reply: "Project Paanchajanya is the regional academy tier for athletes targeting junior and senior nationals, with coaching and academic support.",
    links: [{ label: "Paanchajanya", to: "/schemes/paanchajanya" }, { label: "Register academy", to: "/register?type=academy" }],
  },
  {
    test: /(day board|nursery|nurseries)/,
    reply: "Day boarders train at a SAAP centre and return home daily. Sports nurseries start younger athletes (policy includes swimming and gymnastics, including ages 4–6).",
    links: [{ label: "Day boarders", to: "/schemes/day-boarders" }, { label: "Nurseries", to: "/schemes/nurseries" }],
  },
  {
    test: /(khelo|kadapa|kisce)/,
    reply: "Khelo India in AP includes the State Centre of Excellence at Dr YSR Sports School, Kadapa. Recruitment notices for KISCE appear under Recruitment / Latest News.",
    links: [{ label: "Khelo India", to: "/schemes/khelo-india" }, { label: "Recruitment", to: "/recruitment" }],
  },
  {
    test: /(policy|swarna|approach|2024)/,
    reply: `Andhra Pradesh Sports Policy 2024–29 (G.O.Ms.No.18) aims for Swarna Andhra Pradesh as the nation’s sports capital by 2029, organised as ${APPROACHES.length} approaches from Sports for All to sports tourism.`,
    links: [{ label: "Read the policy", to: "/policy" }],
  },
  {
    test: /(eligib|age group|under.?14|u-14|who can register)/,
    reply: "Event eligibility uses date of birth and the event age category (for example Under-14 covers ages 10–14), plus sport, district and category rules on each event card. Aadhaar verification is required before most event registrations.",
    links: [{ label: "Student platform", to: "/platform" }, { label: "Player register", to: "/register?type=player" }],
  },
  {
    test: /(event|tournament|championship|calendar|amaravati)/,
    reply: "Browse events on the student registration platform and Amaravati / league pages. Admin Events shows upcoming, live and completed meets with player check-in. Public calendar PDFs are linked from Sports Calendar in the menu.",
    links: [{ label: "Platform events", to: "/platform" }, { label: "Amaravati", to: "/amaravati" }],
  },
  {
    test: /(register|registration|player|enroll)/,
    reply: "Player registration starts from Registrations → Player Registration (Aadhaar OTP step). Event entries are filed after sign-in on the student platform. Filings are audited on the hash-chain ledger.",
    links: [{ label: "Register player", to: "/register?type=player" }, { label: "Platform login", to: "/platform" }],
  },
  {
    test: /(certificate|summer camp|verify|qr)/,
    reply: "Certificates are issued after approved registration and recorded participation. Each certificate has a reference ID and QR code for public verification on the ledger / verify page.",
    links: [{ label: "Certificates", to: "/certificates" }, { label: "Verify", to: "/ledger" }],
  },
  {
    test: /(whatsapp|message|sms|enquiry|support)/,
    reply: `Use the green WhatsApp button to open a chat with the approved SAAP number ${OFFICE.phones[1]}. You can consent to automated status updates after sending an enquiry. Officers can also send audited notices from the WhatsApp desk.`,
    links: [{ label: "WhatsApp desk", to: "/desk" }, { label: "Help", to: "/legal/help" }],
  },
  {
    test: /(navigate|menu|where is|how do i find|portal)/,
    reply: "Use the top menu for Schemes, Registrations, Certificates, Gallery and Contact. More → Registration platform opens the signed-in desk. The chat and WhatsApp buttons stay on the bottom-right on every public page.",
    links: [{ label: "Home", to: "/" }, { label: "User manual", to: "/manual" }],
  },
  {
    test: /(audit|trail|ledger|chain|hash)/,
    reply: "Sign-ins, filings, approvals, certificates and WhatsApp notices append to a local hash-chain audit trail. Tampering breaks verification. It is not an external government blockchain.",
    links: [{ label: "Audit trail", to: "/audit" }, { label: "Ledger", to: "/ledger" }],
  },
  {
    test: /(login|role|password|sign in|access|permission)/,
    reply: "Demo platform roles: student, department, operator, accountant, admin, auditor — password demo123. Portal desk demos also use officer / saap123. After login the agent answers with your role’s permissions only.",
    links: [{ label: "Platform login", to: "/platform" }, { label: "Portal login", to: "/login" }],
  },
  {
    test: /(dsc|merit|teacher)/,
    reply: "Sports Mega DSC 2025 schedule and merit list are linked from the DSC desk. Applications run on sportsdsc.apcfss.in.",
    links: [{ label: "DSC desk", to: "/dsc" }],
  },
  {
    test: /(league|rules)/,
    reply: "SAAP League uses Rules Book 2026. Read the PDF from news / league pages and file team interest on the league page.",
    links: [{ label: "League", to: "/league" }],
  },
  {
    test: /(pay|book|ground|play)/,
    reply: "Pay and Play lets you request a ground or court. The request is queued for the district officer and audited.",
    links: [{ label: "Book a slot", to: "/pay-and-play" }],
  },
];

const ROLE_TOPICS = {
  student: [
    {
      test: /(my (registration|event|certificate|status)|am i|did i|attendance)/,
      reply: "Ask “What is my registration status?” while signed in — the agent reads your student records from the registration service (events, attendance, certificates). You cannot see other players’ data.",
      links: [{ label: "Open platform", to: "/platform" }],
    },
    {
      test: /(reward|incentive|bank)/,
      reply: "Reward applications need a verified bank account on your profile. Track payment status on the player desk after department approval and accountant processing.",
      links: [{ label: "Player desk", to: "/platform" }],
    },
    {
      test: /(kit|inventory)/,
      reply: "Admin kit flow: add/restock stock → issue to a player → player acknowledges on Kit Acknowledgement → optional return restores stock. Players only acknowledge pending issues.",
      links: [{ label: "Player desk", to: "/platform" }],
    },
  ],
  admin: [
    {
      test: /(report|power bi|dashboard)/,
      reply: "Open Reports on the admin desk for the Power BI–style Andhra Pradesh sports events dashboard with filters and charts.",
      links: [{ label: "Admin platform", to: "/platform" }],
    },
    {
      test: /(event|verify|fingerprint|biometric|check-?in)/,
      reply: "Admin → Events lists upcoming, live and completed meets. Upcoming/live players can be verified with the fingerprint flow; completed events are locked.",
      links: [{ label: "Admin platform", to: "/platform" }],
    },
    {
      test: /(user|account|permission|role)/,
      reply: "Admins manage user accounts, audit anchors, kit inventory, certificates, rewards, grievances and reports. Ask “What can my role do?” for your live permission list.",
      links: [{ label: "Admin platform", to: "/platform" }],
    },
  ],
  department: [
    {
      test: /(approv|review|registration|district)/,
      reply: "Department officers review registrations inside their district, manage events, issue certificates and approve rewards. Use the staff desk after sign-in.",
      links: [{ label: "Staff platform", to: "/platform" }],
    },
  ],
  operator: [
    {
      test: /(biometric|attendance|fingerprint|check-?in)/,
      reply: "Operators record biometric attendance for approved registrations. Use Biometric check-in on the staff desk — sandbox only, no physical device is connected.",
      links: [{ label: "Operator platform", to: "/platform" }],
    },
  ],
  accountant: [
    {
      test: /(payment|reward|bank|pay)/,
      reply: "Accountants process approved reward payments and can read the audit trail. The agent will not approve payments for you — complete that in the Rewards workflow.",
      links: [{ label: "Accountant platform", to: "/platform" }],
    },
  ],
  auditor: [
    {
      test: /(audit|hash|chain|verify)/,
      reply: "Auditors have read-only access to the hash-chain audit log and can verify chain integrity. You cannot change registrations or payments.",
      links: [{ label: "Auditor platform", to: "/platform" }],
    },
  ],
  officer: [
    {
      test: /(approv|application|whatsapp)/,
      reply: "District officers approve portal applications and can send audited WhatsApp notices from the officer desk.",
      links: [{ label: "Dashboard", to: "/dashboard" }, { label: "WhatsApp desk", to: "/desk" }],
    },
  ],
};

export function suggestionsForRole(role) {
  if (!role) {
    return [
      "Where is the SAAP office?",
      "What is Project Gaandiva?",
      "How do I register as a player?",
      "How do I verify a certificate?",
      "Who is Hithlaksh Solutions?",
    ];
  }
  const byRole = {
    student: [
      "What is my registration status?",
      "How does event eligibility work?",
      "How do I get a certificate?",
      "How do rewards work?",
    ],
    admin: [
      "What can my role do?",
      "Where are event reports?",
      "How do I verify players at events?",
      "Who is Hithlaksh Solutions?",
    ],
    department: [
      "What can my role do?",
      "How do I approve registrations?",
      "How are certificates issued?",
    ],
    operator: [
      "How do I record biometric attendance?",
      "What can my role do?",
    ],
    accountant: [
      "How do reward payments work?",
      "What can my role do?",
    ],
    auditor: [
      "How do I verify the audit chain?",
      "What can my role do?",
    ],
    officer: [
      "How do I approve applications?",
      "How does WhatsApp desk work?",
    ],
  };
  return byRole[role] || [
    "What can my role do?",
    "How do I navigate the portal?",
    "Who is Hithlaksh Solutions?",
  ];
}

export function welcomeForRole(role, name) {
  if (!role) {
    return "I help with SAAP programmes, events, eligibility, certificates, policies and portal navigation. Sign in for answers tied to your account and role. Technology partner questions can mention Hithlaksh Solutions.";
  }
  const who = name ? `${name} (${roleLabel(role)})` : roleLabel(role);
  return `Signed in as ${who}. I answer with your role’s access only — programmes, events, eligibility, certificates and desk navigation. Ask “What can my role do?” for permissions.`;
}

export function answerQuestion(text, session = null) {
  const q = text.toLowerCase();
  const role = session?.role || null;

  if (role && ROLE_TOPICS[role]) {
    const hit = ROLE_TOPICS[role].find((t) => t.test.test(q));
    if (hit) return hit;
  }

  const publicHit = PUBLIC_TOPICS.find((t) => t.test.test(q));
  if (publicHit) return publicHit;

  const scheme = SCHEMES.find((s) => {
    const parts = s.name.toLowerCase().split(/\s+/);
    return parts.some((p) => p.length > 4 && q.includes(p));
  });
  if (scheme) {
    return {
      reply: scheme.summary,
      links: [{ label: scheme.name, to: `/schemes/${scheme.slug}` }],
    };
  }

  if (role) {
    return {
      reply: `I can help with programmes, events, eligibility, certificates, policies and ${roleLabel(role)} desk tasks. Ask about your registrations, permissions, or Hithlaksh Solutions for the technology partner.`,
      links: [
        { label: "Open platform", to: "/platform" },
        { label: "Schemes", to: "/schemes/gaandiva" },
      ],
    };
  }

  return {
    reply: "I can help with SAAP schemes, Sports Policy 2024–29, registration, eligibility, events, certificates, WhatsApp support, and Hithlaksh Solutions (technology partner). Sign in for role-based answers from your records.",
    links: [
      { label: "Schemes", to: "/schemes/gaandiva" },
      { label: "Policy", to: "/policy" },
      { label: "Sign in", to: "/platform" },
    ],
  };
}

/** @deprecated use suggestionsForRole */
export const SUGGESTIONS = suggestionsForRole(null);
