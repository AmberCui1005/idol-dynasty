import { ATTRS, BUDGETS, DATA, POSITIONS, sizeBand } from "./data";
import type { AttrKey, Game, Genre, Group, Member, Offer, Project } from "./types";
import { available, clamp, companyCut, getAff, mean, membersOf, r2 } from "./util";

export function kE(energy: number) {
  if (energy >= 70) return DATA.KE[0];
  if (energy >= 40) return DATA.KE[1];
  return DATA.KE[2];
}
export function kM(mood: number) {
  if (mood >= 70) return DATA.KM[0];
  if (mood >= 40) return DATA.KM[1];
  return DATA.KM[2];
}

export function calcGain(attr: number, tal: number, energy: number, mood: number, coach: Game["coach"], pot: number) {
  if (attr >= pot - 0.001 || attr >= 100) {
    return { gain: 0, reason: "已达潜力上限。建议把行程转向综艺、演技或个人频道，而不是继续堆这一项。" };
  }
  const ke = kE(energy);
  const km = kM(mood);
  const kc = DATA.KC[coach];
  const core = Math.pow(1 - attr / 100, DATA.GROWTH_EXP);
  let gain = DATA.GROWTH_BASE * core * tal * ke * km * kc;
  if (attr + gain > pot) gain = pot - attr;
  gain = r2(Math.max(0, gain));
  const reason = `${DATA.GROWTH_BASE} × (1 − ${attr.toFixed(0)}/100)^${DATA.GROWTH_EXP} × 天赋 ${tal.toFixed(2)} × 体力 ${ke} × 情绪 ${km} × 教练 ${kc} = ${gain}`;
  return { gain, reason };
}

export function gini(values: number[]) {
  const xs = values.map((v) => Math.max(0, v));
  const n = xs.length;
  if (n === 0) return 0;
  const sum = xs.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  let acc = 0;
  for (let i = 0; i < n; i++) acc += (2 * (i + 1) - n - 1) * sorted[i]!;
  return acc / (n * sum);
}

export function attrLabel(m: { attr: Member["attr"] }) {
  const top = ATTRS.slice().sort((a, b) => m.attr[b.key] - m.attr[a.key])[0]!;
  return top.name + "倾向";
}

export function talentBand(tal: number, examined: boolean) {
  const err = examined ? 0.08 : 0.18;
  const a = clamp(tal - err, 0.7, 1.5);
  const b = clamp(tal + err, 0.7, 1.5);
  return `${a.toFixed(2)} – ${b.toFixed(2)}`;
}

export function potBand(pot: number, examined: boolean) {
  const err = examined ? 4 : 10;
  return `${Math.round(clamp(pot - err, 55, 100))} – ${Math.round(clamp(pot + err, 55, 100))}`;
}

function posPower(member: Member, posId: string) {
  const idx = member.positions.indexOf(posId);
  if (idx < 0) return 0;
  const slot = idx === 0 ? 1 : idx === 1 ? 0.7 : 0.5;
  const def = POSITIONS.find((p) => p.id === posId);
  if (!def) return 0;
  if (def.loyal && member.loyal < def.loyal) {
    const ratio = member.loyal / def.loyal;
    if (ratio < 0.7) return 0;
    return slot * ratio;
  }
  if (def.attr && def.min) {
    const ratio = member.attr[def.attr] / def.min;
    if (ratio < 0.7) return 0;
    return slot * Math.min(1, ratio);
  }
  return slot;
}

export function positionNotes(members: Member[]) {
  const notes: string[] = [];
  const miss: string[] = [];
  let vocalMul = 1;
  let danceAdd = 0;
  let exposureMul = 1;
  let varietyMul = 1;
  let conflictMul = 1;
  let stageAdd = 0;
  let moodAura = 0;
  let maknaeShield = 0;
  const holder = (id: string) => members.find((m) => m.positions.includes(id) && available(m));
  const mainV = holder("mainVocal");
  if (mainV) {
    const p = posPower(mainV, "mainVocal");
    vocalMul *= 1 + 0.12 * p;
    if (p <= 0) notes.push("主唱未达门槛，加成失效");
  } else {
    vocalMul *= 0.85;
    miss.push("缺主唱，音源 -15%");
  }
  const leads = members.filter((m) => m.positions.includes("leadVocal") && available(m));
  for (const m of leads) vocalMul *= 1 + 0.04 * posPower(m, "leadVocal");
  const mainD = holder("mainDancer");
  if (mainD) {
    const p = posPower(mainD, "mainDancer");
    danceAdd += 12 * p;
    stageAdd += 8 * p;
    if (p <= 0) notes.push("主舞未达门槛，加成失效");
  } else {
    danceAdd -= 12;
    miss.push("缺主舞，舞台 -12%");
  }
  for (const m of members.filter((x) => x.positions.includes("leadDancer"))) danceAdd += 4 * posPower(m, "leadDancer");
  const rap = holder("mainRap");
  const visual = holder("visual");
  if (visual) {
    const p = posPower(visual, "visual");
    exposureMul *= 1 + 0.2 * p;
    if (p <= 0) notes.push("门面未达门槛");
  } else {
    exposureMul *= 0.9;
    miss.push("缺门面，首周曝光 -10%");
  }
  const leader = holder("leader");
  if (!leader) {
    conflictMul *= 1.3;
    miss.push("缺队长，冲突更容易爆发");
  } else if (posPower(leader, "leader") > 0) conflictMul *= 0.8;
  const maknae = holder("maknae");
  if (maknae) {
    const youngest = members.slice().sort((a, b) => a.age - b.age)[0];
    if (youngest && youngest.id === maknae.id) maknaeShield = 0.1;
    else notes.push("忙内不是团内最小，效果无效");
  }
  const variety = members.filter((m) => m.positions.includes("variety") && available(m));
  if (variety.length) varietyMul *= 1 + 0.15 * Math.max(...variety.map((m) => posPower(m, "variety")));
  else varietyMul *= 0.95;
  if (members.some((m) => m.positions.includes("mood") && m.mood >= 70 && available(m))) moodAura = 3;
  return { vocalMul, danceAdd, exposureMul, varietyMul, conflictMul, stageAdd, moodAura, maknaeShield, notes, miss, mainV, mainD, rap, visual };
}

export function cohesionParts(g: Game, group: Group) {
  const members = membersOf(g, group.id).filter((m) => m.status !== "military");
  const pairs: number[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) pairs.push(getAff(group, members[i]!.id, members[j]!.id));
  }
  const avg = pairs.length ? mean(pairs) : 40;
  const leader = members.find((m) => m.positions.includes("leader") && available(m));
  let leaderScore = 0;
  if (leader && leader.loyal >= 60) leaderScore = 8;
  else if (!leader) leaderScore = -10;
  const team = Math.min(15, group.teamWeeks);
  const G = gini(members.map((m) => m.fame));
  let giniPen = 0;
  if (G > 0.55) giniPen = r2(8 + ((G - 0.55) / 0.45) * 12);
  let center = 0;
  if (group.centerId) {
    const top = members.reduce((a, b) => (a.fame >= b.fame ? a : b), members[0]);
    center = top && top.id === group.centerId ? 5 : -3;
  }
  const conflict = group.conflicts.length * 5;
  const value = clamp(0.5 * avg + leaderScore + team - giniPen + center - conflict + group.cohesionBuff, 0, 100);
  return { value: r2(value), avg: r2(avg), leaderScore, team, giniPen, center, conflict, buff: group.cohesionBuff, gini: r2(G) };
}

export function debutScore(g: Game, group: Group) {
  const members = membersOf(g, group.id).filter(available);
  const attrs = members.flatMap((m) => ATTRS.map((a) => m.attr[a.key]));
  const avg = mean(attrs);
  const vis = mean(members.map((m) => m.attr.VIS));
  const keys = ["leader", "mainVocal", "mainDancer", "visual"];
  let cover = 0;
  for (const k of keys) {
    const def = POSITIONS.find((p) => p.id === k)!;
    const m = members.find((x) => x.positions.includes(k));
    if (!m) continue;
    if (def.attr && def.min && m.attr[def.attr] < def.min) continue;
    if (def.loyal && m.loyal < def.loyal) continue;
    cover += 25;
  }
  const coh = cohesionParts(g, group).value;
  const score = r2(0.5 * avg + 0.2 * cover + 0.15 * coh + 0.15 * vis);
  let tier = "强行出道";
  let known = 80;
  let fandom = 160;
  let note = "糊团状态 26 周，通告报价 -30%，全员情绪 -15";
  if (score >= 80) {
    tier = "怪物新人";
    known = 400;
    fandom = 800;
    note = "出道周话题前三，代言询价 +50%";
  } else if (score >= 65) {
    tier = "有潜力的新人";
    known = 250;
    fandom = 500;
    note = "首周曝光 +20%";
  } else if (score >= 50) {
    tier = "普通新人";
    known = 150;
    fandom = 300;
    note = "无额外光环";
  }
  return {
    score,
    tier,
    known,
    fandom,
    note,
    avg: r2(avg),
    cover,
    coh,
    vis: r2(vis),
    formula: `0.50×能力均值 ${r2(avg)} + 0.20×定位完整 ${cover} + 0.15×凝聚力 ${r2(coh)} + 0.15×外形均值 ${r2(vis)}`,
  };
}

export function styleMatch(genre: Genre, vocal: number, dance: number, rap: number, vis: number) {
  let m = 1;
  if (genre === "hiphop") m = 0.8 + 0.4 * (rap / 100);
  if (genre === "ballad") m = 0.8 + 0.4 * (vocal / 100);
  if (genre === "dance") m = 0.8 + 0.4 * (dance / 100);
  if (genre === "pop") m = 0.9 + 0.2 * ((vocal + dance) / 200);
  if (genre === "rnb") m = 0.85 + 0.3 * ((vocal + vis) / 200);
  return clamp(m, 0.8, 1.2);
}

export function estimateQuality(g: Game, group: Group, project: Pick<Project, "genre" | "budgetTier">) {
  const members = membersOf(g, group.id).filter(available);
  if (!members.length) return { q: 0, detail: "没有可参加的成员" };
  const mods = positionNotes(members);
  const vocalM = mods.mainV ?? members.slice().sort((a, b) => b.attr.VOC - a.attr.VOC)[0]!;
  const danceM = mods.mainD ?? members.slice().sort((a, b) => b.attr.DAN - a.attr.DAN)[0]!;
  const vocal = vocalM.attr.VOC * (mods.mainV ? 1 : 0.9);
  const dance = danceM.attr.DAN * (mods.mainD ? 1 : 0.9);
  const rap = mean(members.map((m) => m.attr.RAP));
  const vis = mean(members.map((m) => m.attr.VIS));
  const coh = cohesionParts(g, group).value;
  const producer = g.coach === "high" ? 5 : g.coach === "mid" ? 4 : 3;
  const budget = BUDGETS[project.budgetTier] ?? BUDGETS[1]!;
  const match = styleMatch(project.genre, vocal, dance, rap, vis);
  let gap = 1;
  if (group.lastRelease) {
    const d = g.week - group.lastRelease;
    if (d < DATA.COMEBACK_GAP) gap = 0.7 + 0.3 * (d / DATA.COMEBACK_GAP);
  }
  const coach = g.coach === "high" ? 1.1 : g.coach === "mid" ? 1.02 : 0.95;
  let hip = 1;
  if (project.genre === "hiphop") {
    if (mods.rap && posPower(mods.rap, "mainRap") > 0) hip = 1.15;
    else if (!mods.rap) hip = 0.9;
  }
  const base = 0.3 * vocal + 0.25 * dance + 0.15 * rap + 0.15 * producer * 20 + 0.15 * coh;
  let q = base * match * budget.coef * gap * coach * mods.vocalMul * hip;
  q = clamp(r2(q), 0, 100);
  const detail = `(0.30×唱 ${r2(vocal)} + 0.25×舞 ${r2(dance)} + 0.15×说唱 ${r2(rap)} + 0.15×制作人 ${producer}×20 + 0.15×凝聚 ${r2(coh)}) × 曲风 ${match.toFixed(2)} × 预算 ${budget.coef} × 冷却 ${gap.toFixed(2)} × 教练 ${coach} × 定位 ${mods.vocalMul.toFixed(2)}`;
  return { q, detail, match, gap, vocal, dance, rap, vis, coh };
}

export function costBreakdown(g: Game) {
  const rows: { label: string; amount: number }[] = [];
  const trainees = g.members.filter((m) => m.status === "trainee");
  const idols = g.members.filter((m) => m.status === "active" || m.status === "injured");
  if (trainees.length) rows.push({ label: `练习生培养 ×${trainees.length}`, amount: trainees.length * DATA.TRAINEE_FEE });
  let salary = 0;
  for (const m of idols) {
    const group = g.groups.find((x) => x.id === m.groupId);
    const senior = !!(group?.debutWeek && g.week - group.debutWeek >= 104);
    salary += senior ? DATA.SALARY_SENIOR : m.salary || DATA.SALARY;
  }
  if (salary) rows.push({ label: "成员底薪", amount: salary });
  const mil = g.members.filter((m) => m.status === "military");
  if (mil.length) rows.push({ label: "服役津贴", amount: mil.length * 8 });
  const groups = Math.max(1, g.groups.length);
  rows.push({ label: "场地与宿舍", amount: DATA.VENUE + (groups - 1) * DATA.VENUE_EXTRA });
  const debuted = g.groups.filter((x) => x.debuted && x.pausedLeft <= 0);
  if (debuted.length) {
    rows.push({ label: "经纪人", amount: debuted.length * DATA.BROKER });
    rows.push({ label: "造型与宣传", amount: debuted.length * DATA.STYLING });
  }
  rows.push({ label: "公司行政", amount: DATA.ADMIN });
  const coachFee = DATA.COACH_FEE[g.coach];
  if (coachFee) rows.push({ label: g.coach === "high" ? "高级教练" : "中级教练", amount: coachFee });
  if (g.bodyguard) rows.push({ label: "安保", amount: 15 });
  if (g.debt > 0) rows.push({ label: "贷款利息", amount: Math.round(g.debt * DATA.INTEREST) });
  return rows;
}

export function runwayOf(g: Game) {
  const burnNow = costBreakdown(g).reduce((a, b) => a + b.amount, 0);
  const nets = g.nets.slice(-8);
  if (!nets.length) {
    if (burnNow <= 0) return { weeks: null as number | null, label: "充足", detail: "暂无净支出" };
    const w = g.cash / burnNow;
    return { weeks: w, label: `${Math.max(0, Math.floor(w))} 周`, detail: `尚无历史。现金 ${fmt(g.cash)} ÷ 本周固定成本 ${burnNow} 万` };
  }
  const avg = mean(nets);
  if (avg >= -0.5) return { weeks: null, label: "充足", detail: `近 ${nets.length} 周平均净现金流 ${avg.toFixed(0)} 万，没有净流出` };
  const w = g.cash / Math.abs(avg);
  return {
    weeks: w,
    label: `${Math.max(0, Math.floor(w))} 周`,
    detail: `现金 ${fmt(g.cash)} ÷ 近 ${nets.length} 周平均净支出 ${Math.abs(avg).toFixed(0)} 万`,
  };
}

function fmt(n: number) {
  return Math.round(n).toLocaleString("zh-CN");
}

export function warnings(g: Game) {
  const out: { text: string; tone: "bad" | "warn" }[] = [];
  const run = runwayOf(g);
  if (run.weeks !== null && run.weeks < 8) out.push({ text: `现金跑道只剩 ${run.label}`, tone: run.weeks < 4 ? "bad" : "warn" });
  if (g.debt > DATA.DEBT_PRESSURE) out.push({ text: "负债超过 5000 万，通告收入 -20%，挖角更容易发生", tone: "bad" });
  for (const m of g.members) {
    if (m.status === "left") continue;
    if (m.energy < 20 && m.status !== "injured" && m.status !== "military") out.push({ text: `${m.name} 体力低于 20，有伤病风险`, tone: "warn" });
    if (m.mood < 25) out.push({ text: `${m.name} 情绪濒危，可能提出退团`, tone: "bad" });
    else if (m.mood < 40) out.push({ text: `${m.name} 情绪偏低，训练效率下降`, tone: "warn" });
    if (m.loyal < 30 && m.status === "active") out.push({ text: `${m.name} 忠诚度低于 30`, tone: "bad" });
  }
  for (const group of g.groups) {
    const ms = membersOf(g, group.id);
    const c = cohesionParts(g, group);
    if (group.debuted && c.value < 40) out.push({ text: `${group.name} 凝聚力跌破 40`, tone: "bad" });
    if (c.gini > 0.55 && ms.length > 1) out.push({ text: `${group.name} 人气不均（基尼 ${c.gini.toFixed(2)}）`, tone: "warn" });
    if (!group.debuted && g.week > 30) out.push({ text: `${group.name} 仍未出道，练习生会失去耐心`, tone: "warn" });
    const mods = positionNotes(ms);
    if (group.debuted && mods.miss.length) out.push({ text: `${group.name}：${mods.miss[0]}`, tone: "warn" });
  }
  for (const s of g.ships.filter((x) => x.active)) {
    if (s.sugar >= DATA.SUGAR_SOFT) out.push({ text: "有 CP 糖精偏高，再营业会反噬", tone: s.sugar >= DATA.SUGAR_LIMIT ? "bad" : "warn" });
  }
  return out.slice(0, 8);
}

export function bestAttr(members: Member[], key: AttrKey) {
  if (!members.length) return 0;
  return Math.max(...members.map((m) => m.attr[key]));
}

export type Gate = { status: "ok" | "close" | "no"; reasons: string[] };

export function assessOffer(g: Game, offer: Offer, group: Group, memberIds: string[]): Gate {
  const roster = membersOf(g, group.id);
  const picked = memberIds.length ? roster.filter((m) => memberIds.includes(m.id)) : roster.filter(available);
  const reasons: string[] = [];
  let status: Gate["status"] = "ok";
  const worse = (s: Gate["status"]) => {
    if (s === "no" || status === "no") status = "no";
    else if (s === "close") status = "close";
  };
  const check = (value: number, min: number, label: string) => {
    if (value >= min) return;
    if (value >= min * 0.9) {
      worse("close");
      reasons.push(`${label} ${Math.round(value)}，门槛 ${min}（差 ${Math.round(min - value)}）`);
    } else {
      worse("no");
      reasons.push(`${label} ${Math.round(value)}，未达门槛 ${min}`);
    }
  };
  if (offer.attr && offer.min) {
    const pool = picked.length ? picked : roster;
    const primary = bestAttr(pool, offer.attr);
    const alt = offer.altAttr ? bestAttr(pool, offer.altAttr) : 0;
    check(Math.max(primary, alt), offer.min, offer.altAttr ? "唱功或舞蹈" : ATTRS.find((a) => a.key === offer.attr)!.name);
  }
  if (offer.sta) check(bestAttr(picked.length ? picked : roster, "STA"), offer.sta, "舞台");
  if (offer.known) check(group.known, offer.known, "团体认知");
  if (offer.fandom) check(group.fandom, offer.fandom, "粉丝");
  if (offer.charting) {
    const live = g.projects.some((p) => p.groupId === group.id && p.released && p.releaseWeek && g.week - p.releaseWeek <= 6);
    if (!live) {
      worse("no");
      reasons.push("需要发行后 6 周内的在榜作品");
    }
  }
  if (offer.scope === "group") {
    const free = roster.filter((m) => available(m) && !isBusy(g, m.id));
    const need = roster.length <= 3 ? Math.max(2, roster.filter(available).length) : Math.max(2, Math.ceil(roster.length * 0.6));
    if (free.length < Math.min(need, roster.filter(available).length) || free.length < 2) {
      worse("no");
      reasons.push("可上场人数不足");
    }
  }
  if (!reasons.length) reasons.push("门槛满足");
  return { status, reasons };
}

export function isBusy(g: Game, memberId: string) {
  if (g.gigs.some((gig) => gig.memberIds.includes(memberId))) return "已有通告档期";
  if (g.bids.some((b) => b.memberIds.includes(memberId))) return "已参与本周竞标";
  return "";
}

export function bidOutlook(g: Game, offer: Offer, group: Group, quote: number) {
  const qCoef = quote / Math.max(quote, offer.aiQuote);
  const kCoef = group.known / Math.max(group.known, offer.aiKnown, 1);
  const rel = clamp((g.clientRel[offer.client] ?? 15) / 100, 0, 1);
  let p = DATA.BID_W_QUOTE * qCoef + DATA.BID_W_KNOWN * kCoef + DATA.BID_W_REL * rel;
  if (!group.debuted) p *= 0.9;
  if (!g.groups.some((x) => x.debuted)) p *= 0.95;
  if (g.debt > DATA.DEBT_PRESSURE) p *= 0.85;
  const parts = [
    { name: "报价", v: qCoef },
    { name: "知名度", v: kCoef },
    { name: "人脉", v: rel },
  ];
  const weak = parts.slice().sort((a, b) => a.v - b.v)[0]!.name;
  const band = p >= 0.66 ? "高" : p >= 0.42 ? "中" : "低";
  return { p: clamp(p, 0.04, 0.92), band, weak, qCoef, kCoef, rel };
}

export function stageCostPerWeek(project: Project) {
  const total = STAGE_COST_SAFE(project.stage, project.scale);
  const weeks = STAGE_WEEKS_SAFE(project.stage, project.scale);
  const mul = BUDGETS[project.budgetTier]?.cost ?? 1;
  return Math.max(1, Math.round((total / weeks) * mul));
}

function STAGE_COST_SAFE(stage: string, scale: Project["scale"]) {
  const table: Record<string, Record<Project["scale"], number>> = {
    concept: { single: 100, mini: 250, full: 500 },
    record: { single: 60, mini: 180, full: 350 },
    choreo: { single: 40, mini: 80, full: 120 },
    mv: { single: 80, mini: 180, full: 300 },
    promo: { single: 50, mini: 150, full: 300 },
  };
  return table[stage]?.[scale] ?? 0;
}
function STAGE_WEEKS_SAFE(stage: string, scale: Project["scale"]) {
  const table: Record<string, Record<Project["scale"], number>> = {
    concept: { single: 1, mini: 1, full: 1 },
    record: { single: 2, mini: 3, full: 4 },
    choreo: { single: 2, mini: 2, full: 2 },
    mv: { single: 1, mini: 1, full: 1 },
    promo: { single: 2, mini: 3, full: 4 },
  };
  return table[stage]?.[scale] ?? 1;
}

export function projectBudgetTotal(scale: Project["scale"], tier: number) {
  const stages = ["concept", "record", "choreo", "mv", "promo"];
  const mul = BUDGETS[tier]?.cost ?? 1;
  return Math.round(stages.reduce((s, st) => s + STAGE_COST_SAFE(st, scale), 0) * mul);
}

export function fanPayFactor(group: Group) {
  const { casual, regular, core, hardcore } = group.layers;
  const pay = casual * 0.1 + regular * 0.3 + core * 0.4 + hardcore * 0.2;
  return pay / 0.189;
}
export function fanStreamFactor(group: Group) {
  const { casual, regular, core, hardcore } = group.layers;
  const pay = casual * 0.2 + regular * 0.3 + core * 0.3 + hardcore * 0.2;
  return pay / 0.237;
}

export function transferLayer(group: Group, from: keyof Group["layers"], to: keyof Group["layers"], amt: number) {
  const a = Math.min(group.layers[from], amt);
  group.layers[from] -= a;
  group.layers[to] += a;
  const s = group.layers.casual + group.layers.regular + group.layers.core + group.layers.hardcore;
  if (s > 0) {
    group.layers.casual /= s;
    group.layers.regular /= s;
    group.layers.core /= s;
    group.layers.hardcore /= s;
  }
}

export function overlaps(members: Member[]) {
  const out: { pos: string; a: Member; b: Member }[] = [];
  for (const p of POSITIONS) {
    if (!p.unique || !p.attr || !p.min) continue;
    const holder = members.find((m) => m.positions.includes(p.id) && available(m));
    if (!holder) continue;
    const rival = members
      .filter((m) => m.id !== holder.id && available(m))
      .map((m) => ({ m, v: m.attr[p.attr!] }))
      .sort((x, y) => y.v - x.v)[0];
    if (!rival) continue;
    if (holder.attr[p.attr] >= p.min && rival.v >= p.min && Math.abs(holder.attr[p.attr] - rival.v) < 5) {
      out.push({ pos: p.name, a: holder, b: rival.m });
    }
  }
  return out;
}

export function looksLabel(vis: number) {
  if (vis >= 84) return "天生丽质";
  if (vis <= 45) return "蒲柳之姿";
  return "外形在线";
}

export function scheduleBlock(g: Game, m: Member, act: string) {
  if (m.status === "left") return "已离团";
  if (m.status === "military") return "服役中，无法安排行程";
  if ((m.surgeryRest ?? 0) > 0 && act !== "rest" && act !== "skip") return "整容恢复中，只能休息";
  if (m.status === "injured" && act !== "rest" && act !== "skip") return "伤病休养中，只能休息";
  if (g.gigs.some((gig) => gig.memberIds.includes(m.id)) && act !== "skip" && act !== "rest") return "已有通告档期，个人槽被占用";
  if (m.energy < 10 && act !== "rest" && act !== "skip") return "体力低于 10，本周强制休息";
  if (act === "channel" && m.attr.VAR < 50) return "综艺感未到 50，个人频道开不起来";
  if (act === "camp") return "合宿在团体槽里，不占个人行程";
  return "";
}

export function exposureFame(m: Member, exposure: number, isCenter: boolean) {
  const posCoef = m.positions.some((p) => p.startsWith("main") || p === "visual" || p === "leader") ? 1.12 : 1;
  return r2(exposure * 0.4 * (1 + (isCenter ? 0.3 : 0)) * posCoef * (1 + 0.1 * (m.attr.VAR / 100)));
}

export function groupSizeMul(n: number) {
  return sizeBand(n) === "small" ? 1.4 : sizeBand(n) === "large" ? 0.78 : 1;
}

export function shareText(g: Game, group: Group) {
  const cut = companyCut(g, group);
  return `公司 ${Math.round(cut * 100)} / 成员 ${Math.round((1 - cut) * 100)}`;
}
