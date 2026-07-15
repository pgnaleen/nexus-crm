export const FUNNEL_STAGES = [
  "New Lead",
  "Qualified",
  "Discovery",
  "Proposal Sent",
  "Negotiation",
  "Evaluation",
  "Decision Pending",
  "Won",
  "Closed Lost",
  "Purchase Order Received",
  "Contract Signed",
  "Project Kickoff",
  "Delivery",
  "Completed",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export interface FunnelLead {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: FunnelStage;
  date: string;
  assignee: string;
}

export interface FunnelSource {
  id: string;
  label: string;
  leads: FunnelLead[];
}

export const FUNNEL_SOURCES: FunnelSource[] = [
  {
    id: "all",
    label: "All",
    leads: [
      { id: "a1", name: "Alice Monroe", company: "TechNova Inc.", value: 18500, stage: "New Lead", date: "2026-07-01", assignee: "Jordan Lee" },
      { id: "a2", name: "James Whitford", company: "NexGen Ventures", value: 85000, stage: "Proposal Sent", date: "2026-06-20", assignee: "Alex Tran" },
      { id: "a3", name: "Nadia Okonkwo", company: "BridgePoint Agency", value: 32000, stage: "Delivery", date: "2026-07-01", assignee: "Riley Soh" },
      { id: "a4", name: "Samira Farouk", company: "Direct Imports Co.", value: 5500, stage: "New Lead", date: "2026-07-10", assignee: "Morgan Kim" },
      { id: "a5", name: "Xander Bloom", company: "Word & Mouth LLC", value: 22000, stage: "Delivery", date: "2026-07-02", assignee: "Jordan Lee" },
      { id: "a6", name: "Yuki Tanaka", company: "Network Plus Japan", value: 38000, stage: "Project Kickoff", date: "2026-07-06", assignee: "Alex Tran" },
      { id: "a7", name: "Zoe Petrov", company: "Eastern Alliance", value: 7600, stage: "New Lead", date: "2026-07-11", assignee: "Riley Soh" },
      { id: "a8", name: "Aaron Mensah", company: "West Coast Refs", value: 11900, stage: "Qualified", date: "2026-07-05", assignee: "Morgan Kim" },
      { id: "a9", name: "Bella Swan", company: "Twilight Solutions", value: 45000, stage: "Discovery", date: "2026-07-12", assignee: "Jordan Lee" },
      { id: "a10", name: "Charlie Chaplin", company: "Silent Era Films", value: 12000, stage: "Negotiation", date: "2026-07-09", assignee: "Alex Tran" },
      { id: "a11", name: "Diana Prince", company: "Amazonian Tech", value: 95000, stage: "Purchase Order Received", date: "2026-06-15", assignee: "Riley Soh" },
      { id: "a12", name: "Evan Hansen", company: "Dear Evan Inc.", value: 8000, stage: "New Lead", date: "2026-07-14", assignee: "Morgan Kim" },
      { id: "a13", name: "Fiona Gallagher", company: "Shameless Co.", value: 25000, stage: "Discovery", date: "2026-07-10", assignee: "Jordan Lee" },
      { id: "a14", name: "George Costanza", company: "Vandelay Industries", value: 15000, stage: "Negotiation", date: "2026-07-01", assignee: "Alex Tran" },
      { id: "a15", name: "Harry Potter", company: "Hogwarts LLC", value: 60000, stage: "Contract Signed", date: "2026-07-16", assignee: "Riley Soh" },
      { id: "a16", name: "Indiana Jones", company: "Artifacts Co.", value: 33000, stage: "Closed Lost", date: "2026-05-12", assignee: "Morgan Kim" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    leads: [
      { id: "c1",  name: "Alice Monroe",    company: "TechNova Inc.",      value: 18500, stage: "New Lead",   date: "2026-07-01", assignee: "Jordan Lee"  },
      { id: "c2",  name: "Brian Patel",     company: "Skyline Corp",       value:  9200, stage: "Qualified",  date: "2026-07-03", assignee: "Morgan Kim"  },
      { id: "c3",  name: "Clara Zhang",     company: "Apex Systems",       value: 24000, stage: "Proposal Sent",   date: "2026-07-05", assignee: "Jordan Lee"  },
      { id: "c4",  name: "David Santos",    company: "BluePeak Ltd.",      value:  6750, stage: "Project Kickoff",        date: "2026-06-28", assignee: "Riley Soh"   },
      { id: "c5",  name: "Eva Müller",      company: "Crestline Group",    value: 11000, stage: "Decision Pending",     date: "2026-07-09", assignee: "Morgan Kim"  },
      { id: "c6",  name: "Frank Kim",       company: "Vertex Partners",    value: 15300, stage: "Delivery",   date: "2026-07-02", assignee: "Alex Tran"   },
      { id: "c7",  name: "Grace Osei",      company: "Orbis Solutions",    value:  8400, stage: "Completed",     date: "2026-06-20", assignee: "Jordan Lee"  },
      { id: "c8",  name: "Henry Ford",      company: "Ford Motor Co.",     value: 55000, stage: "Discovery",  date: "2026-07-12", assignee: "Morgan Kim"  },
      { id: "c9",  name: "Ivy Chen",        company: "Ivy League LLC",     value: 32000, stage: "Negotiation", date: "2026-07-08", assignee: "Riley Soh"   },
      { id: "c10", name: "Jack Black",      company: "School of Rock",     value: 41000, stage: "Purchase Order Received",  date: "2026-06-25", assignee: "Alex Tran"   },
      { id: "c11", name: "Kevin Hart",      company: "Laugh Out Loud",     value: 28000, stage: "Contract Signed", date: "2026-07-15", assignee: "Jordan Lee"  },
      { id: "c12", name: "Luna Lovegood",   company: "Quibbler Press",     value:  5000, stage: "Closed Lost",   date: "2026-04-10", assignee: "Riley Soh"   },
    ],
  },
  {
    id: "ceo",
    label: "CEO",
    leads: [
      { id: "e1",  name: "James Whitford",  company: "NexGen Ventures",    value: 85000, stage: "Proposal Sent",   date: "2026-06-20", assignee: "Alex Tran"   },
      { id: "e2",  name: "Sophia Reyes",    company: "Horizon Capital",    value: 120000, stage: "Project Kickoff",       date: "2026-07-02", assignee: "Alex Tran"   },
      { id: "e3",  name: "Lucas Bauer",     company: "Summit Holdings",    value: 47000, stage: "New Lead",   date: "2026-07-07", assignee: "Jordan Lee"  },
      { id: "e4",  name: "Mia Johansson",   company: "Nordic Capital AB",  value: 63000, stage: "Decision Pending",     date: "2026-07-04", assignee: "Morgan Kim"  },
      { id: "e5",  name: "Noah Fischer",    company: "Alpine Investments",  value: 91000, stage: "Delivery",  date: "2026-06-28", assignee: "Riley Soh"   },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    leads: [
      { id: "p1",  name: "Nadia Okonkwo",   company: "BridgePoint Agency", value: 32000, stage: "Delivery",   date: "2026-07-01", assignee: "Riley Soh"   },
      { id: "p2",  name: "Omar Haddad",     company: "Crosslink Solutions", value: 14500, stage: "New Lead",   date: "2026-07-08", assignee: "Morgan Kim"  },
      { id: "p3",  name: "Priya Nair",      company: "Unified Partners",   value: 21000, stage: "Qualified",   date: "2026-07-06", assignee: "Alex Tran"   },
      { id: "p4",  name: "Rafael Torres",   company: "Global Connect",     value:  8900, stage: "Completed",     date: "2026-06-25", assignee: "Riley Soh"   },
      { id: "p5",  name: "Sara Lindqvist",  company: "Nordlink Group",     value: 17600, stage: "Project Kickoff",        date: "2026-07-03", assignee: "Jordan Lee"  },
    ],
  },
  {
    id: "direct",
    label: "Direct",
    leads: [
      { id: "d1",  name: "Samira Farouk",   company: "Direct Imports Co.", value:  5500, stage: "New Lead",   date: "2026-07-10", assignee: "Morgan Kim"  },
      { id: "d2",  name: "Tom Erikson",     company: "Nordic Trade GmbH",  value: 13200, stage: "Qualified",  date: "2026-07-04", assignee: "Jordan Lee"  },
      { id: "d3",  name: "Una Walsh",       company: "Atlantic Goods",     value:  9800, stage: "Proposal Sent",   date: "2026-07-07", assignee: "Alex Tran"   },
      { id: "d4",  name: "Victor Chen",     company: "PacRim Exports",     value: 17400, stage: "Decision Pending",     date: "2026-06-30", assignee: "Riley Soh"   },
      { id: "d5",  name: "Wendy Forster",   company: "Mainland Supplies",  value:  4100, stage: "Completed",     date: "2026-06-22", assignee: "Morgan Kim"  },
    ],
  },
  {
    id: "referral",
    label: "Referral",
    leads: [
      { id: "r1",  name: "Xander Bloom",    company: "Word & Mouth LLC",   value: 22000, stage: "Delivery",   date: "2026-07-02", assignee: "Jordan Lee"  },
      { id: "r2",  name: "Yuki Tanaka",     company: "Network Plus Japan", value: 38000, stage: "Project Kickoff",        date: "2026-07-06", assignee: "Alex Tran"   },
      { id: "r3",  name: "Zoe Petrov",      company: "Eastern Alliance",   value:  7600, stage: "New Lead",   date: "2026-07-11", assignee: "Riley Soh"   },
      { id: "r4",  name: "Aaron Mensah",    company: "West Coast Refs",    value: 11900, stage: "Qualified",  date: "2026-07-05", assignee: "Morgan Kim"  },
    ],
  },
  {
    id: "social_media",
    label: "Social Media",
    leads: [
      { id: "s1", name: "Billie Eilish", company: "Darkroom", value: 150000, stage: "New Lead", date: "2026-07-14", assignee: "Jordan Lee" },
      { id: "s2", name: "Finneas", company: "O'Connell Bros", value: 75000, stage: "Discovery", date: "2026-07-12", assignee: "Alex Tran" },
    ],
  },
  {
    id: "events",
    label: "Events",
    leads: [
      { id: "v1", name: "Tony Stark", company: "Stark Industries", value: 500000, stage: "Proposal Sent", date: "2026-07-10", assignee: "Morgan Kim" },
      { id: "v2", name: "Bruce Wayne", company: "Wayne Enterprises", value: 450000, stage: "Negotiation", date: "2026-07-08", assignee: "Riley Soh" },
    ],
  },
  {
    id: "inbound",
    label: "Inbound Marketing",
    leads: [
      { id: "i1", name: "Clark Kent", company: "Daily Planet", value: 12000, stage: "Qualified", date: "2026-07-11", assignee: "Jordan Lee" },
      { id: "i2", name: "Lois Lane", company: "Daily Planet", value: 15000, stage: "New Lead", date: "2026-07-13", assignee: "Alex Tran" },
    ],
  }
];
