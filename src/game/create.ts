import { AI_SEED, ATTRS, BOY_NAMES, CLIENTS, DATA, GIGS, GIRL_NAMES, SONGS } from "./data";
import type { AttrKey, Game, Gender, Group, GroupType, Offer, Scout, StartConfig } from "./types";
import { clamp, rng, uid } from "./util";

const ATTR_KEYS = ATTRS.map((a) => a.key);

export type RecruitTrack = "trainee" | "veteran";

export function ageBand(track: RecruitTrack) {
  return track === "veteran" ? { min: 16, max: 22 } : { min: 10, max: 18 };
}

function rollAttr(state: { rng: number }, mean: number, spread: number, lo: number, hi: number) {
  const x = (rng(state) + rng(state) + rng(state)) / 3;
  return clamp(Math.round(mean + (x - 0.5) * spread), lo, hi);
}

export function rollScout(
  state: { rng: number },
  gender: Gender,
  rep: number,
  week: number,
  opts?: { track?: RecruitTrack; age?: number; ageMin?: number; ageMax?: number },
): Scout {
  const track = opts?.track ?? "trainee";
  const band = ageBand(track);
  const lo = clamp(Math.round(opts?.ageMin ?? band.min), band.min, band.max);
  const hi = clamp(Math.round(opts?.ageMax ?? band.max), lo, band.max);
  const age = opts?.age != null ? clamp(Math.round(opts.age), band.min, band.max) : lo + Math.floor(rng(state) * (hi - lo + 1));
  const mean = track === "veteran" ? 54 + rep / 80 : 30 + rep / 140;
  const attr = {} as Scout["attr"];
  const skillKeys = ATTR_KEYS.filter((k) => k !== "VIS");
  for (const k of skillKeys) {
    attr[k] = track === "veteran" ? rollAttr(state, mean, 28, 38, 88) : rollAttr(state, mean, 34, 12, 64);
  }
  if (rng(state) < (track === "veteran" ? 0.35 : 0.28)) {
    const spike = skillKeys[Math.floor(rng(state) * skillKeys.length)]!;
    attr[spike] = clamp(attr[spike] + (track === "veteran" ? 8 : 12) + Math.floor(rng(state) * 8), 0, track === "veteran" ? 94 : 78);
  }
  const skillAvg = skillKeys.reduce((s, k) => s + attr[k], 0) / skillKeys.length;
  attr.VIS = rollLooks(state, skillAvg);
  const names = gender === "f" ? GIRL_NAMES : BOY_NAMES;
  const name = names[Math.floor(rng(state) * names.length)]!;
  const avg = ATTR_KEYS.reduce((s, k) => s + attr[k], 0) / 7;
  const tal = track === "veteran" ? r3(0.95 + rng(state) * 0.45) : r3(0.7 + rng(state) * 0.85);
  const pot = track === "veteran" ? clamp(Math.round(skillAvg + 8 + rng(state) * 14), 64, 94) : Math.round(72 + rng(state) * 26);
  const signCost =
    track === "veteran" ? clamp(Math.round(16 + (avg - 48) * 1.15), 16, 60) : clamp(Math.round(4 + (avg - 24) * 0.45), 4, 22);
  return {
    id: uid(state, "s"),
    name: uniqueName(name, state),
    gender,
    age,
    attr,
    tal,
    pot,
    amb: Math.round(track === "veteran" ? 40 + rng(state) * 50 : 20 + rng(state) * 55),
    loyal: Math.round(track === "veteran" ? 35 + rng(state) * 35 : 62 + rng(state) * 28),
    examined: false,
    expires: week + 2,
    signCost,
    track,
  };
}

function rollLooks(state: { rng: number }, skillAvg: number) {
  const r = rng(state);
  if (r < 0.14) return 26 + Math.floor(rng(state) * 16);
  if (r < 0.34) return 84 + Math.floor(rng(state) * 13);
  const floor = Math.max(56, Math.round(skillAvg + 16));
  return clamp(floor + Math.floor(rng(state) * 14), 50, 86);
}

function uniqueName(base: string, state: { rng: number }) {
  const suffix = ["", "", "", " Q", " V"][Math.floor(rng(state) * 5)] ?? "";
  return base + suffix;
}

function r3(n: number) {
  return Math.round(n * 100) / 100;
}

export function gendersFor(type: GroupType, state: { rng: number }, n: number): Gender[] {
  if (type === "girl") return Array.from({ length: n }, () => "f" as const);
  if (type === "boy") return Array.from({ length: n }, () => "m" as const);
  return Array.from({ length: n }, () => (rng(state) < 0.5 ? "f" : "m"));
}

export function poolSplit(count: number, trainee: boolean, veteran: boolean) {
  const n = Math.max(0, count);
  if (trainee && veteran) {
    const vet = Math.min(n, Math.round(n * 0.2));
    return { vet, trainee: n - vet };
  }
  if (veteran) return { vet: n, trainee: 0 };
  return { vet: 0, trainee: n };
}

export function makePool(
  seed: number,
  type: GroupType,
  count: number,
  spec: { trainee: boolean; veteran: boolean; traineeMin: number; traineeMax: number; veteranMin: number; veteranMax: number },
  rep = DATA.START_REP,
  week = 1,
) {
  const state = { rng: seed >>> 0 };
  const split = poolSplit(Math.max(1, count), spec.trainee, spec.veteran);
  const plan: { track: RecruitTrack; ageMin: number; ageMax: number }[] = [
    ...Array.from({ length: split.trainee }, () => ({ track: "trainee" as const, ageMin: spec.traineeMin, ageMax: spec.traineeMax })),
    ...Array.from({ length: split.vet }, () => ({ track: "veteran" as const, ageMin: spec.veteranMin, ageMax: spec.veteranMax })),
  ];
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng(state) * (i + 1));
    const tmp = plan[i]!;
    plan[i] = plan[j]!;
    plan[j] = tmp;
  }
  const genders = gendersFor(type, state, plan.length);
  const used = new Set<string>();
  return plan.map((slot, i) => {
    let s = rollScout(state, genders[i] ?? "f", rep, week, slot);
    let guard = 0;
    while (used.has(s.name) && guard < 8) {
      s = { ...s, name: s.name + "·" + Math.floor(rng(state) * 9) };
      guard += 1;
    }
    used.add(s.name);
    return s;
  });
}

function emptyCharts(): Game["charts"] {
  return { music: [], sales: [], topic: [], rookie: [] };
}

export function createGame(cfg: StartConfig): Game {
  const g: Game = {
    version: 1,
    seed: cfg.seed >>> 0,
    rng: cfg.seed >>> 0,
    week: 1,
    company: cfg.company.trim() || "未名娱乐",
    cash: DATA.START_CASH,
    debt: 0,
    rep: DATA.START_REP,
    ap: DATA.AP,
    coach: "basic",
    network: 20,
    bodyguard: false,
    lifetimeIncome: 0,
    members: [],
    groups: [],
    ships: [],
    cpBans: [],
    scouts: [],
    offers: [],
    bids: [],
    gigs: [],
    projects: [],
    schedules: {},
    teamSchedules: {},
    ai: [],
    charts: emptyCharts(),
    prevRank: {},
    log: [],
    history: [],
    pending: [],
    settledWeeks: [],
    nets: [],
    negStreak: 0,
    phase: "play",
    eventQueue: [],
    restructure: false,
    lastReport: null,
    seen: {},
    clientRel: {},
    taxed: false,
  };
  const gid = uid(g, "g");
  const group = blankGroup(gid, cfg.groupName.trim() || "NOVA", cfg.type);
  cfg.members.forEach((src) => {
    const m = memberFrom(g, src, gid);
    g.members.push(m);
    g.cash -= src.signCost ?? signCostOf(src.attr);
  });
  g.cash = Math.round(g.cash);
  initAff(g, group);
  g.groups.push(group);
  g.ai = AI_SEED.slice(0, DATA.AI_COUNT).map((a) => ({
    id: uid(g, "ai"),
    name: a.name,
    type: a.type,
    fandom: a.fandom,
    known: a.known,
    music: a.base,
    sales: a.fandom * 1.1,
    topic: 80 + a.known * 0.2,
    debutWeeks: a.debut,
    comebackIn: a.back,
    baseMusic: a.base,
    topStreak: 0,
    momentum: false,
  }));
  for (const c of CLIENTS) g.clientRel[c] = 15;
  refreshScouts(g);
  refreshOffers(g);
  g.log.unshift({
    week: 1,
    title: cfg.members.some((m) => m.track === "veteran")
      ? `${g.company} 开业，${group.name} 由挖角艺人组成`
      : `${g.company} 开业，${group.name} 从练习生海选起步`,
  });
  return g;
}

export function signCostOf(attr: Record<AttrKey, number>) {
  const avg = ATTR_KEYS.reduce((s, k) => s + attr[k], 0) / 7;
  return clamp(Math.round(5 + (avg - 30) * 0.55), 5, 30);
}

export function memberFrom(g: { rng: number }, src: StartConfig["members"][number], groupId: string | null) {
  return {
    id: uid(g, "m"),
    name: src.name,
    gender: src.gender,
    age: src.age,
    groupId,
    attr: { ...src.attr },
    energy: src.track === "veteran" ? 92 : 86,
    energyMax: src.track === "veteran" ? 108 : 100,
    mood: src.track === "veteran" ? 70 : 78,
    fame: src.track === "veteran" ? Math.round(28 + src.attr.VIS * 0.35) : Math.round(4 + src.attr.VIS * 0.08),
    loyal: src.loyal,
    tal: src.tal,
    pot: src.pot,
    amb: src.amb,
    positions: [],
    status: "trainee" as const,
    injuryLeft: 0,
    militaryLeft: 0,
    militaryHandled: false,
    delayMilitary: false,
    contractLeft: 0,
    salary: DATA.SALARY,
    restStreak: 0,
    examined: src.examined,
    weeksIn: 0,
    cutOverride: null,
    soloDue: 0,
    prof: { stage: src.track === "veteran" ? 2 : 0, camera: 0, express: src.track === "veteran" ? 1 : 0 },
    visBorn: src.attr.VIS,
    visOps: 0,
    disfigured: false,
    surgeryRest: 0,
    surgeryCd: 0,
  };
}

export function blankGroup(id: string, name: string, type: GroupType): Group {
  return {
    id,
    name,
    type,
    debuted: false,
    debutWeek: null,
    known: 0,
    fandom: 0,
    heat: 0,
    cohesionBuff: 0,
    centerId: null,
    centerCd: 0,
    teamWeeks: 0,
    lastCamp: 0,
    lastRelease: null,
    nuguLeft: 0,
    renewed: false,
    layers: { casual: 0.6, regular: 0.25, core: 0.12, hardcore: 0.03 },
    cpFans: 0,
    pausedLeft: 0,
    conflicts: [],
    aff: {},
    exposureWeek: 0,
  };
}

export function initAff(g: Game, group: ReturnType<typeof blankGroup>) {
  const ms = g.members.filter((m) => m.groupId === group.id);
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i]!.id;
      const b = ms[j]!.id;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      group.aff[key] = Math.round(30 + rng(g) * 20);
    }
  }
}

export function refreshScouts(g: Game) {
  g.scouts = g.scouts.filter((s) => s.expires > g.week);
  const need = 4 - g.scouts.length;
  const type = g.groups[0]?.type ?? "mixed";
  for (let i = 0; i < Math.max(0, need); i++) {
    const genders = gendersFor(type === "mixed" ? "mixed" : type, g, 1);
    const s = rollScout(g, genders[0]!, g.rep, g.week);
    if (g.members.some((m) => m.name === s.name) || g.scouts.some((m) => m.name === s.name)) s.name += " " + Math.floor(rng(g) * 90);
    g.scouts.push(s);
  }
}

export function refreshOffers(g: Game) {
  const known = Math.max(0, ...g.groups.map((x) => x.known), 0);
  const tier = known >= 450 ? 3 : known >= 220 ? 2 : known >= 80 ? 1 : 0;
  const pool = GIGS.filter((d) => d.tier <= tier);
  const street = GIGS.filter((d) => d.tier === 0);
  const picks = [];
  const count = 6 + Math.floor(rng(g) * 3);
  for (let i = 0; i < count; i++) {
    const src = i < 2 ? street[Math.floor(rng(g) * street.length)]! : pool[Math.floor(rng(g) * pool.length)]!;
    picks.push(src);
  }
  const ai = g.ai;
  g.offers = picks.map((def) => {
    const rival = ai[Math.floor(rng(g) * ai.length)]!;
    const span = def.pay[1] - def.pay[0];
    const scale = 0.75 + known / 700;
    const pay = Math.round((def.pay[0] + rng(g) * span) * scale);
    const client = CLIENTS[Math.floor(rng(g) * CLIENTS.length)]!;
    const offer: Offer = {
      id: uid(g, "o"),
      type: def.type,
      title: `${client} · ${def.name}`,
      weeks: def.weeks,
      pay,
      exposure: def.exposure,
      energy: def.energy,
      mood: def.mood,
      scope: def.scope,
      blocksTeam: !!def.blocksTeam,
      attr: def.attr,
      altAttr: def.altAttr,
      min: def.min,
      known: def.known,
      fandom: def.fandom,
      charting: def.charting,
      sta: def.sta,
      tier: def.tier,
      aiName: rival?.name ?? "竞品",
      aiKnown: rival?.known ?? 400,
      aiQuote: r3(0.85 + rng(g) * 0.4),
      client,
      special: def.special,
    };
    return offer;
  });
}

export function songTitle(g: Game) {
  return SONGS[Math.floor(rng(g) * SONGS.length)]!;
}
