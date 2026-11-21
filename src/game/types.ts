export type Gender = "f" | "m";
export type GroupType = "girl" | "boy" | "mixed";
export type AttrKey = "VOC" | "DAN" | "RAP" | "VIS" | "VAR" | "ACT" | "STA";
export type Coach = "basic" | "mid" | "high";
export type MemberStatus = "trainee" | "active" | "injured" | "military" | "left";
export type Scale = "single" | "mini" | "full";
export type Genre = "pop" | "hiphop" | "ballad" | "dance" | "rnb";
export type StageId = "concept" | "record" | "choreo" | "mv" | "promo" | "done";
export type Phase = "play" | "event" | "restructure" | "report";

export type Attrs = Record<AttrKey, number>;

export type Member = {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  groupId: string | null;
  attr: Attrs;
  energy: number;
  energyMax: number;
  mood: number;
  fame: number;
  loyal: number;
  tal: number;
  pot: number;
  amb: number;
  positions: string[];
  status: MemberStatus;
  injuryLeft: number;
  militaryLeft: number;
  militaryHandled: boolean;
  delayMilitary: boolean;
  contractLeft: number;
  salary: number;
  restStreak: number;
  examined: boolean;
  weeksIn: number;
  cutOverride: number | null;
  soloDue: number;
  prof: { stage: number; camera: number; express: number };
  visBorn?: number;
  visOps?: number;
  disfigured?: boolean;
  surgeryRest?: number;
  surgeryCd?: number;
};

export type Scout = {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  attr: Attrs;
  tal: number;
  pot: number;
  amb: number;
  loyal: number;
  examined: boolean;
  expires: number;
  signCost: number;
  track?: "trainee" | "veteran";
};

export type Group = {
  id: string;
  name: string;
  type: GroupType;
  debuted: boolean;
  debutWeek: number | null;
  known: number;
  fandom: number;
  heat: number;
  cohesionBuff: number;
  centerId: string | null;
  centerCd: number;
  teamWeeks: number;
  lastCamp: number;
  lastRelease: number | null;
  nuguLeft: number;
  renewed: boolean;
  layers: { casual: number; regular: number; core: number; hardcore: number };
  cpFans: number;
  pausedLeft: number;
  conflicts: string[];
  aff: Record<string, number>;
  exposureWeek: number;
};

export type Ship = {
  id: string;
  groupId: string;
  a: string;
  b: string;
  kind: "official" | "fan";
  heat: number;
  sugar: number;
  weeks: number;
  active: boolean;
  secondary: boolean;
  planned: string | null;
  snsStreak: number;
  cd: Record<string, number>;
};

export type Offer = {
  id: string;
  type: string;
  title: string;
  weeks: number;
  pay: number;
  exposure: number;
  energy: number;
  mood: number;
  scope: "member" | "group";
  blocksTeam: boolean;
  attr?: AttrKey;
  altAttr?: AttrKey;
  min?: number;
  known?: number;
  fandom?: number;
  charting?: boolean;
  sta?: number;
  tier: number;
  aiName: string;
  aiKnown: number;
  aiQuote: number;
  client: string;
  special?: "concert" | "tour";
};

export type Bid = {
  id: string;
  offerId: string;
  groupId: string;
  memberIds: string[];
  quote: number;
  deposit: number;
};

export type Gig = {
  id: string;
  type: string;
  title: string;
  groupId: string;
  memberIds: string[];
  left: number;
  total: number;
  payPerWeek: number;
  exposure: number;
  energy: number;
  mood: number;
  client: string;
  scope: "member" | "group";
  blocksTeam: boolean;
  special?: "concert" | "tour";
  gateMin?: number;
  gateAttr?: AttrKey;
};

export type Project = {
  id: string;
  groupId: string;
  title: string;
  scale: Scale;
  genre: Genre;
  stage: StageId;
  stageLeft: number;
  budgetTier: 0 | 1 | 2 | 3;
  spent: number;
  stalled: boolean;
  released: boolean;
  releaseWeek: number | null;
  q: number;
  promo: number;
  sales: number[];
  saleIdx: number;
  music: number;
  streamLeft: number;
  streamMul: number;
  failed: boolean;
};

export type AIGroup = {
  id: string;
  name: string;
  type: GroupType;
  fandom: number;
  known: number;
  music: number;
  sales: number;
  topic: number;
  debutWeeks: number;
  comebackIn: number;
  baseMusic: number;
  topStreak: number;
  momentum: boolean;
};

export type ChartRow = {
  id: string;
  name: string;
  score: number;
  player: boolean;
  fandom: number;
  prev: number;
};

export type Charts = {
  music: ChartRow[];
  sales: ChartRow[];
  topic: ChartRow[];
  rookie: ChartRow[];
};

export type Effect = {
  cash?: number;
  rep?: number;
  heat?: number;
  fandomPct?: number;
  known?: number;
  loyal?: number;
  mood?: number;
  network?: number;
  cohesionBuff?: number;
  sugar?: number;
  shipHeat?: number;
};

export type EventOption = {
  label: string;
  detail: string;
  effects: Effect;
  delay?: number;
  special?: string;
  needAp?: number;
  danger?: boolean;
};

export type LiveEvent = {
  uid: string;
  id: string;
  title: string;
  category: string;
  text: string;
  options: EventOption[];
  groupId?: string;
  memberId?: string;
  memberId2?: string;
  shipId?: string;
  demand?: string;
};

export type Pending = {
  week: number;
  effect: Effect;
  special?: string;
  source: string;
  groupId?: string;
  memberId?: string;
  memberId2?: string;
  shipId?: string;
};

export type ReportLine = {
  stage: string;
  title: string;
  delta: string;
  tone: "good" | "bad" | "neutral";
  detail: string;
};

export type WeekReport = {
  week: number;
  headline: string;
  lines: ReportLine[];
};

export type LogItem = {
  week: number;
  title: string;
  choice?: string;
};

export type Game = {
  version: 1;
  seed: number;
  rng: number;
  week: number;
  company: string;
  cash: number;
  debt: number;
  rep: number;
  ap: number;
  coach: Coach;
  network: number;
  bodyguard: boolean;
  lifetimeIncome: number;
  members: Member[];
  groups: Group[];
  ships: Ship[];
  cpBans: { key: string; until: number }[];
  scouts: Scout[];
  offers: Offer[];
  bids: Bid[];
  gigs: Gig[];
  projects: Project[];
  schedules: Record<string, string>;
  teamSchedules: Record<string, string>;
  ai: AIGroup[];
  charts: Charts;
  prevRank: Record<string, number>;
  log: LogItem[];
  history: WeekReport[];
  pending: Pending[];
  settledWeeks: number[];
  nets: number[];
  negStreak: number;
  phase: Phase;
  eventQueue: LiveEvent[];
  restructure: boolean;
  lastReport: WeekReport | null;
  seen: Record<string, number>;
  clientRel: Record<string, number>;
  taxed: boolean;
};

export type StartMember = {
  name: string;
  gender: Gender;
  age: number;
  attr: Attrs;
  tal: number;
  pot: number;
  amb: number;
  loyal: number;
  examined: boolean;
  signCost?: number;
  track?: "trainee" | "veteran";
};

export type StartConfig = {
  company: string;
  groupName: string;
  type: GroupType;
  seed: number;
  members: StartMember[];
};
