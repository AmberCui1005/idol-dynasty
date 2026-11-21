import { CP_ACTIONS, DATA, ACTIVITIES } from "./data";
import type { Game, ReportLine } from "./types";
import { releaseMember } from "./actions";
import {
  calcGain,
  cohesionParts,
  costBreakdown,
  estimateQuality,
  exposureFame,
  fanPayFactor,
  fanStreamFactor,
  groupSizeMul,
  overlaps,
  positionNotes,
  stageCostPerWeek,
  transferLayer,
  bidOutlook,
} from "./calc";
import { refreshOffers, refreshScouts } from "./create";
import { applyPendingDue, rollEvents } from "./events";
import { ATTRS } from "./data";
import {
  available,
  clamp,
  companyCut,
  findGroup,
  findMember,
  getAff,
  mean,
  membersOf,
  r2,
  rng,
  seasonOf,
  setAff,
  uid,
  yearWeek,
} from "./util";

export function settle(g: Game): { ok: boolean; message: string } {
  if (g.phase !== "play") return { ok: false, message: "先处理完事件或周报" };
  if (g.settledWeeks.includes(g.week)) return { ok: false, message: "这一周已经结算过，不能重复入账" };
  const played = g.week;
  const cash0 = g.cash;
  const lines: ReportLine[] = [];
  const push = (stage: string, title: string, delta: string, tone: ReportLine["tone"], detail: string) => {
    lines.push({ stage, title, delta, tone, detail });
  };
  const income: { groupId: string | null; gross: number; label: string; gig: boolean }[] = [];
  const guard = (stage: string, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      push(stage, "本阶段计算异常，已跳过", "", "bad", e instanceof Error ? e.message : "未知错误");
    }
  };

  guard("S0", () => {
    for (const group of g.groups) group.exposureWeek = 0;
  });
  guard("S1", () => runPersonal(g, push, income));
  guard("S2", () => runTeam(g, push));
  guard("S3", () => runGigs(g, push, income));
  guard("S4", () => runProjects(g, push));
  guard("S5", () => runRelease(g, push));
  guard("S6", () => runCharts(g, push));
  guard("S7", () => runFinance(g, push, income, cash0));
  guard("S8", () => runPeople(g, push));
  guard("S9", () => {
    applyPendingDue(g, (line) => push(line.stage, line.title, line.delta, line.tone, line.detail));
    g.eventQueue = rollEvents(g);
  });

  const net = Math.round(g.cash - cash0);
  g.nets.push(net);
  g.nets = g.nets.slice(-8);
  if (net < 0) g.negStreak += 1;
  else g.negStreak = 0;
  const headline = `${yearWeek(played).label} · 净现金流 ${net >= 0 ? "+" : ""}${net} 万`;
  g.lastReport = { week: played, headline, lines };
  g.history.unshift(g.lastReport);
  g.history = g.history.slice(0, DATA.LOG_KEEP);
  g.settledWeeks.push(played);
  if (g.settledWeeks.length > 400) g.settledWeeks = g.settledWeeks.slice(-400);

  if (g.restructure) g.phase = "restructure";
  else if (g.eventQueue.length) g.phase = "event";
  else closeWeek(g);
  return { ok: true, message: headline };
}

export function closeWeek(g: Game) {
  g.week += 1;
  g.ap = DATA.AP;
  g.schedules = {};
  g.teamSchedules = {};
  for (const s of g.ships) {
    for (const k of Object.keys(s.cd)) s.cd[k] = Math.max(0, (s.cd[k] ?? 0) - 1);
  }
  for (const group of g.groups) {
    if (group.centerCd > 0) group.centerCd -= 1;
    if (group.nuguLeft > 0) group.nuguLeft -= 1;
    if (group.pausedLeft > 0) group.pausedLeft -= 1;
    group.cohesionBuff = r2(group.cohesionBuff * 0.8);
  }
  for (const m of g.members) {
    if ((m.surgeryCd ?? 0) > 0) m.surgeryCd = (m.surgeryCd ?? 0) - 1;
  }
  g.cpBans = g.cpBans.filter((b) => b.until > g.week);
  try {
    refreshScouts(g);
    refreshOffers(g);
  } catch {
    /* market refresh failed, keep previous */
  }
  g.phase = "report";
}

function runPersonal(g: Game, push: Push, income: Income[]) {
  for (const m of g.members) {
    if (m.status === "left") continue;
    m.weeksIn += 1;
    if (m.status === "military") {
      m.militaryLeft -= 1;
      m.age = r2(m.age + 1 / 52);
      if (m.militaryLeft <= 0) {
        m.status = m.contractLeft > 0 ? "active" : "trainee";
        m.mood = clamp(m.mood + 12, 0, 100);
        m.energy = m.energyMax;
        push("S1", `${m.name} 退伍归队`, "归队", "good", "服役结束，体力回满");
      }
      continue;
    }
    m.age = r2(m.age + 1 / 52);
    if (m.status === "injured") {
      m.injuryLeft -= 1;
      m.energy = clamp(m.energy + 10, 0, m.energyMax);
      if (m.injuryLeft <= 0) {
        m.status = m.contractLeft > 0 ? "active" : "trainee";
        push("S1", `${m.name} 伤愈`, "归队", "good", "可以重新排程");
      } else push("S1", `${m.name} 养伤`, `${m.injuryLeft} 周`, "neutral", "本周不参与任何活动");
      continue;
    }
    if ((m.surgeryRest ?? 0) > 0) {
      m.surgeryRest = (m.surgeryRest ?? 0) - 1;
      m.energy = clamp(m.energy + 18, 0, m.energyMax);
      m.mood = clamp(m.mood + 4, 0, 100);
      m.restStreak += 1;
      push("S1", `${m.name} 整容恢复`, `还剩 ${m.surgeryRest} 周`, "neutral", "这周只能消肿。外形不会因为训练变高。");
      continue;
    }
    const onGig = g.gigs.some((gig) => gig.memberIds.includes(m.id));
    if (onGig) {
      push("S1", `${m.name} 通告占档`, "未训练", "neutral", "竞标或通告占用个人槽，体力只在履约时扣除一次");
      m.restStreak = 0;
      continue;
    }
    let act = g.schedules[m.id] || "skip";
    if (m.energy < 10 && act !== "rest") {
      act = "rest";
      push("S1", `${m.name} 强制休息`, "体力 < 10", "bad", "个人行程被占用");
    }
    const def = ACTIVITIES[act] ?? ACTIVITIES.skip!;
    if (def.attr === "VIS") {
      push("S1", `${m.name} 外形`, "不变", "neutral", "外形是天生的，训练加不上去。");
    } else if (def.attr) {
      const res = calcGain(m.attr[def.attr], m.tal, m.energy, m.mood, g.coach, m.pot);
      const gain = res.gain;
      const before = m.attr[def.attr];
      m.attr[def.attr] = r2(clamp(before + gain, 0, Math.min(100, m.pot)));
      push("S1", `${m.name} ${def.name}`, gain > 0 ? `+${gain} ${def.attr}` : "0", gain > 0 ? "good" : "neutral", res.reason);
    } else if (act === "visual") {
      if (rng(g) < 0.4) m.prof.camera = Math.min(5, m.prof.camera + 1);
      push("S1", `${m.name} 形体镜头`, "外形不变", "neutral", "脸是天生的。这周只是熟悉机位。");
    } else if (act === "stamina") {
      const prev = m.energyMax;
      m.energyMax = Math.min(120, m.energyMax + 2);
      push("S1", `${m.name} 体能训练`, `上限 ${prev} → ${m.energyMax}`, "good", "不提升能力值");
    } else if (act === "channel") {
      if (m.attr.VAR >= 50) {
        m.fame = clamp(m.fame + 8, 0, DATA.FAME_CAP);
        m.prof.express = Math.min(5, m.prof.express + 1);
        income.push({ groupId: m.groupId, gross: 20, label: `${m.name} 个人频道`, gig: false });
        push("S1", `${m.name} 个人频道`, "+20 万", "good", "核心向内容，知名度 +8");
      }
    } else {
      push("S1", `${m.name} ${def.name}`, act === "rest" ? "恢复" : "跳过", "neutral", def.hint);
    }
    let mood = def.mood;
    if (act === "rest" && m.restStreak >= 1) mood += 10;
    m.energy = clamp(m.energy + def.energy, 0, m.energyMax);
    m.mood = clamp(m.mood + mood, 0, 100);
    m.restStreak = act === "rest" ? m.restStreak + 1 : 0;
    if (m.prof.stage < 5 && (act === "vocal" || act === "dance" || act === "stamina")) m.prof.stage = Math.min(5, m.prof.stage + (rng(g) < 0.35 ? 1 : 0));
    if (m.energy < 20 && rng(g) < 0.15) {
      m.status = "injured";
      m.injuryLeft = 3 + Math.floor(rng(g) * 4);
      push("S1", `${m.name} 伤病`, `${m.injuryLeft} 周`, "bad", "体力低于 20，15% 判定命中。事件里决定休养、带伤或手术。");
    }
  }
}

function runTeam(g: Game, push: Push) {
  for (const group of g.groups) {
    if (group.pausedLeft > 0) {
      push("S2", `${group.name} 暂停`, "团活取消", "bad", "重组或空窗");
      continue;
    }
    if (g.gigs.some((gig) => gig.groupId === group.id && gig.blocksTeam)) {
      push("S2", `${group.name} 团活让位`, "通告占用", "neutral", "固定综艺、演唱会或巡演占着团队槽");
      continue;
    }
    const act = g.teamSchedules[group.id] || "skip";
    const ms = membersOf(g, group.id).filter(available);
    if (act === "skip" || !ms.length) {
      push("S2", `${group.name} 没有团活`, "—", "neutral", "本周未安排团体练习");
      continue;
    }
    if (act === "camp") {
      if (group.lastCamp && g.week - group.lastCamp < 8) {
        push("S2", `${group.name} 合宿失败`, "冷却", "bad", "改为没有效果");
        continue;
      }
      for (const m of ms) {
        m.energy = clamp(m.energy + 10, 0, m.energyMax);
        m.mood = clamp(m.mood + 20, 0, 100);
      }
      bumpPairs(g, group.id, 3);
      group.teamWeeks = Math.min(15, group.teamWeeks + 3);
      group.lastCamp = g.week;
      push("S2", `${group.name} 合宿`, "好感 +3", "good", "体力 +10，情绪 +20，凝聚力积累 +3");
      continue;
    }
    for (const m of ms) {
      m.energy = clamp(m.energy - 8, 0, m.energyMax);
      m.mood = clamp(m.mood + 2, 0, 100);
      // 外形是天生的，不参与排行，团练只会强化最强的一项可训练能力。
      const top = ATTRS.filter((a) => a.key !== "VIS").sort((a, b) => m.attr[b.key] - m.attr[a.key])[0]!;
      if (m.attr[top.key] < m.pot) m.attr[top.key] = r2(clamp(m.attr[top.key] + 1, 0, Math.min(100, m.pot)));
    }
    group.teamWeeks = Math.min(15, group.teamWeeks + 1);
    push("S2", `${group.name} 团体练习`, "凝聚积累 +1", "good", "全员体力 -8，情绪 +2，最强项 +1");
  }
}

function runGigs(g: Game, push: Push, income: Income[]) {
  const fresh: Game["gigs"] = [];
  for (const bid of g.bids) {
    const offer = g.offers.find((o) => o.id === bid.offerId);
    const group = findGroup(g, bid.groupId);
    if (!offer || !group) {
      g.cash += bid.deposit;
      push("S3", "竞标作废", `+${bid.deposit} 万`, "neutral", "通告已不在池中，保证金退回");
      continue;
    }
    const out = bidOutlook(g, offer, group, bid.quote);
    const roll = rng(g);
    if (roll <= out.p) {
      fresh.push({
        id: uid(g, "k"),
        type: offer.type,
        title: offer.title,
        groupId: group.id,
        memberIds: bid.memberIds,
        left: offer.weeks,
        total: offer.weeks,
        payPerWeek: Math.max(1, Math.round(offer.pay / offer.weeks)),
        exposure: offer.exposure,
        energy: offer.energy,
        mood: offer.mood,
        client: offer.client,
        scope: offer.scope,
        blocksTeam: offer.blocksTeam,
        special: offer.special,
        gateMin: offer.min,
        gateAttr: offer.attr,
      });
      g.clientRel[offer.client] = clamp((g.clientRel[offer.client] ?? 15) + 6, 0, 100);
      push("S3", `中标 ${offer.title}`, "下周履约", "good", `把握判定 ${roll.toFixed(2)} ≤ ${out.p.toFixed(2)}。保证金 ${bid.deposit} 万转为成本。本周训练照常，通告从下周开始扣档。`);
    } else {
      g.cash += bid.deposit;
      const why = out.weak === "报价" ? "报价低于竞品" : out.weak === "知名度" ? "知名度不足" : "和通告方缺少合作基础";
      push("S3", `落标 ${offer.title}`, `退回 ${bid.deposit} 万`, "bad", `${why}，被 ${offer.aiName} 抢走。判定 ${roll.toFixed(2)} > ${out.p.toFixed(2)}。`);
    }
  }
  g.bids = [];

  const touched = new Set<string>();
  for (const gig of g.gigs) {
    const group = findGroup(g, gig.groupId);
    if (!group) continue;
    let breach = false;
    for (const id of gig.memberIds) {
      const m = findMember(g, id);
      if (!m || m.status === "injured" || m.status === "military" || m.status === "left") {
        breach = true;
        continue;
      }
      m.energy = clamp(m.energy + gig.energy, 0, m.energyMax);
      m.mood = clamp(m.mood + gig.mood, 0, 100);
      if (m.energy < 10) breach = true;
      const fame = exposureFame(m, gig.exposure / gig.memberIds.length, group.centerId === m.id);
      m.fame = clamp(r2(m.fame + fame), 0, DATA.FAME_CAP);
      touched.add(m.id);
      if (gig.type === "variety" || gig.type === "varietyFix") m.prof.express = Math.min(5, m.prof.express + 1);
      if (gig.type === "dramaSup" || gig.type === "dramaLead") m.prof.camera = Math.min(5, m.prof.camera + 1);
    }
    let pay = gig.payPerWeek;
    if (gig.special && gig.left === 1) {
      const ms = gig.memberIds.map((id) => findMember(g, id)).filter((m): m is NonNullable<typeof m> => !!m);
      const sta = ms.length ? mean(ms.map((m) => m.attr.STA)) : 50;
      const coh = cohesionParts(g, group).value;
      const stage = clamp(sta * 0.5 + coh * 0.3 + (group.centerId ? 6 : 0), 0, 100);
      const occ = clamp(0.35 + group.fandom / 2000 + stage / 200, 0.2, 1);
      const rent = gig.special === "tour" ? 400 : 180;
      const ticket = gig.special === "tour" ? 2.2 : 1.1;
      pay = Math.round(group.fandom * occ * ticket - rent);
      const band = groupSizeMul(membersOf(g, group.id).length);
      if (band > 1 && gig.special === "tour") pay = Math.round(pay * 1.25);
      if (ms.length < membersOf(g, group.id).filter(available).length) pay = Math.round(pay * 0.75);
      push("S3", gig.title, `${pay >= 0 ? "+" : ""}${pay} 万`, pay >= 0 ? "good" : "bad", `上座率 ${(occ * 100).toFixed(0)}% = 0.35 + 粉丝/2000 + 舞台/200。舞台分 ${stage.toFixed(0)}。`);
    }
    if (breach && pay > 0) {
      pay = Math.round(pay * 0.6);
      group.heat = clamp(group.heat - 4, -100, 100);
      g.clientRel[gig.client] = clamp((g.clientRel[gig.client] ?? 20) - 20, 0, 100);
      push("S3", `${gig.title} 部分违约`, "报酬 -40%", "bad", "有人体力低于 10 或无法上场");
    }
    if (group.nuguLeft > 0 && pay > 0) pay = Math.round(pay * 0.7);
    if (g.debt > DATA.DEBT_PRESSURE && pay > 0) pay = Math.round(pay * 0.8);
    if (!(gig.special && gig.left === 1)) {
      push("S3", gig.title, `${pay >= 0 ? "+" : ""}${pay} 万`, pay >= 0 ? "good" : "neutral", `周期报酬，剩余 ${gig.left - 1} 周。曝光 ${gig.exposure}。`);
    }
    income.push({ groupId: group.id, gross: pay, label: gig.title, gig: true });
    group.exposureWeek += gig.exposure;
    group.known = clamp(group.known + gig.exposure * 0.12, 0, DATA.KNOWN_CAP);
    group.fandom += Math.round(gig.exposure * 0.05);
    if (gig.type === "fansign") transferLayer(group, "casual", "core", 0.02);
    gig.left -= 1;
  }
  g.gigs = g.gigs.filter((gig) => gig.left > 0).concat(fresh);
  for (const m of g.members) {
    if (m.status === "left" || m.status === "military") continue;
    if (!touched.has(m.id)) m.fame = r2(clamp(m.fame * 0.98, 0, DATA.FAME_CAP));
  }
}

function runProjects(g: Game, push: Push) {
  for (const p of g.projects) {
    if (p.released || p.stage === "done") continue;
    const group = findGroup(g, p.groupId);
    if (!group || group.pausedLeft > 0) {
      p.stalled = true;
      push("S4", p.title || "作品", "停滞", "bad", "团体不可用");
      continue;
    }
    const ms = membersOf(g, group.id).filter(available);
    if (p.stage === "record" && !ms.some((m) => m.attr.VOC >= 45)) {
      p.stalled = true;
      push("S4", p.title, "停滞", "bad", "录音阶段需要能唱的人在团");
      continue;
    }
    if (p.stage === "choreo" && !ms.some((m) => m.attr.DAN >= 45)) {
      p.stalled = true;
      push("S4", p.title, "停滞", "bad", "编舞阶段缺舞蹈人手");
      continue;
    }
    const cost = stageCostPerWeek(p);
    if (g.cash < cost) {
      p.stalled = true;
      push("S4", p.title, "资金不足", "bad", `本周需要 ${cost} 万，进度保留，已投入 ${p.spent} 万不退`);
      continue;
    }
    g.cash -= cost;
    p.spent += cost;
    p.stalled = false;
    p.stageLeft -= 1;
    push("S4", `${p.title} · ${stageName(p.stage)}`, `-${cost} 万`, "neutral", `阶段还剩 ${Math.max(0, p.stageLeft)} 周，累计投入 ${p.spent} 万`);
    if (p.stageLeft <= 0) {
      const order = ["concept", "record", "choreo", "mv", "promo"];
      const idx = order.indexOf(p.stage);
      if (idx < 0 || idx === order.length - 1) p.stage = "done";
      else {
        p.stage = order[idx + 1] as typeof p.stage;
        p.stageLeft = weeksOf(p.stage, p.scale);
        push("S4", p.title, `进入${stageName(p.stage)}`, "good", `这一阶段 ${p.stageLeft} 周`);
      }
    }
  }
}

function runRelease(g: Game, push: Push) {
  const season = seasonOf(g.week);
  for (const p of g.projects) {
    if (p.stage !== "done" || p.released) continue;
    const group = findGroup(g, p.groupId);
    if (!group) continue;
    const est = estimateQuality(g, group, p);
    const mods = positionNotes(membersOf(g, group.id));
    let q = est.q;
    if (!group.centerId) q = r2(q * 0.92);
    else q = r2(clamp(q + 2, 0, 100));
    if (mods.exposureMul) {
      /* exposure handled below */
    }
    p.q = q;
    p.released = true;
    p.releaseWeek = g.week;
    p.promo = (["0.85", "1.05", "1.2", "1.35"][p.budgetTier] as unknown as number) || 1.05;
    const promo = [0.85, 1.05, 1.2, 1.35][p.budgetTier] ?? 1.05;
    p.promo = promo;
    const fan = fanPayFactor(group);
    const cp = 1 + 0.08 * Math.min(1, group.cpFans);
    const rand = 0.85 + rng(g) * 0.3;
    let first = group.fandom * 0.08 * Math.pow(Math.max(q, 1) / 70, 1.5) * promo * rand * fan * cp * mods.exposureMul;
    if (q < 45) {
      first *= 0.45;
      group.fandom = Math.round(group.fandom * 0.92);
      group.heat = clamp(group.heat - 14, -100, 100);
      transferLayer(group, "core", "casual", 0.04);
      p.failed = true;
    } else {
      group.heat = clamp(group.heat + Math.min(18, 8 + q / 10), -100, 100);
      group.known = clamp(group.known + q * 0.4, 0, DATA.KNOWN_CAP);
      group.fandom = Math.round(group.fandom + first * 2.2);
      if (q >= 70) transferLayer(group, "casual", "core", 0.03);
      if (q >= 85) transferLayer(group, "regular", "hardcore", 0.02);
    }
    const ratios = [1, 0.55, 0.3, 0.15, 0.05, 0.04, 0.03, 0.02];
    p.sales = ratios.map((r) => r2(first * r)).filter((n) => n >= 0.05);
    p.saleIdx = 0;
    let music = q * DATA.CHART_Q_WEIGHT + group.fandom * 0.25 + group.known * 0.15 + promo * 80 * 1.5;
    music *= mods.vocalMul;
    if (season.award) music *= 1.2;
    if (season.summer) music *= 1.1;
    if (group.heat > 60) music *= 1.2;
    p.music = r2(music);
    p.streamLeft = 14;
    p.streamMul = 1;
    group.lastRelease = g.week;
    group.exposureWeek += 80 * mods.exposureMul;
    push(
      "S5",
      `${p.title} 发行`,
      `质量 ${q}`,
      q >= 45 ? "good" : "bad",
      `${est.detail}。首周预估 ${r2(first)} 万张。${q < 45 ? "失败作：粉丝 -8%。" : "进入音源结算。"}`,
    );
  }
}

function runCharts(g: Game, push: Push) {
  for (const ai of g.ai) {
    ai.fandom = Math.round(ai.fandom * (1 + 0.005 + rng(g) * 0.01));
    ai.known = clamp(ai.known * 1.003, 0, DATA.KNOWN_CAP);
    ai.debutWeeks += 1;
    ai.comebackIn -= 1;
    if (ai.comebackIn <= 0) {
      ai.music = ai.baseMusic * 2.2;
      ai.sales = ai.fandom * 1.3;
      ai.topic = 220 + rng(g) * 200;
      ai.comebackIn = 32 + Math.floor(rng(g) * 14);
      push("S6", `${ai.name} 回归`, "指数 ×2.2", "bad", "竞品短时爆发，之后每周衰减");
    } else {
      ai.music = Math.max(ai.baseMusic * 0.4, ai.music * 0.86);
      ai.topic = Math.max(30, ai.topic * 0.9);
      ai.sales = ai.fandom * 1.05;
    }
    if (ai.momentum) {
      ai.music *= 1.3;
      ai.sales *= 1.3;
      ai.topic *= 1.3;
    }
  }
  const rows = (key: "music" | "sales" | "topic" | "rookie") => {
    const list: Game["charts"]["music"] = [];
    for (const group of g.groups) {
      const score = scoreOf(g, group.id, key);
      if (key === "rookie") {
        if (!group.debuted || !group.debutWeek || g.week - group.debutWeek > 104) continue;
      }
      list.push({
        id: group.id,
        name: group.name,
        score: Math.round(score),
        player: true,
        fandom: Math.round(group.fandom),
        prev: g.prevRank[`${key}:${group.id}`] ?? 0,
      });
    }
    for (const ai of g.ai) {
      let score = key === "music" ? ai.music : key === "sales" ? ai.sales : key === "topic" ? ai.topic : 0;
      if (key === "rookie") {
        if (ai.debutWeeks > 104) continue;
        score = ai.music * (1 - ai.debutWeeks / 104) * 1.5;
      }
      list.push({
        id: ai.id,
        name: ai.name,
        score: Math.round(score),
        player: false,
        fandom: Math.round(ai.fandom),
        prev: g.prevRank[`${key}:${ai.id}`] ?? 0,
      });
    }
    list.sort((a, b) => b.score - a.score || b.fandom - a.fandom);
    list.forEach((row, i) => {
      g.prevRank[`${key}:${row.id}`] = i + 1;
    });
    return list.slice(0, 12);
  };
  g.charts = { music: rows("music"), sales: rows("sales"), topic: rows("topic"), rookie: rows("rookie") };
  const top = g.charts.music[0];
  for (const ai of g.ai) {
    if (top && top.id === ai.id) ai.topStreak += 1;
    else ai.topStreak = 0;
    ai.momentum = ai.topStreak >= 8;
  }
  const mine = g.charts.music.findIndex((r) => r.player);
  if (mine >= 0) push("S6", "音源榜", `第 ${mine + 1} 名`, mine < 3 ? "good" : "neutral", `${g.charts.music[mine]!.name} ${g.charts.music[mine]!.score} 分`);
  else if (g.groups.some((x) => x.debuted)) push("S6", "音源榜", "榜外", "neutral", "还没有足够的音源指数");
}

function scoreOf(g: Game, groupId: string, key: "music" | "sales" | "topic" | "rookie") {
  const group = findGroup(g, groupId);
  if (!group) return 0;
  const projects = g.projects.filter((p) => p.groupId === groupId && p.released && p.releaseWeek);
  const latest = projects.slice().sort((a, b) => (b.releaseWeek ?? 0) - (a.releaseWeek ?? 0))[0];
  let music = group.known * 0.3;
  if (latest?.releaseWeek) {
    const age = Math.max(0, g.week - latest.releaseWeek);
    music = latest.music * Math.pow(0.88, age);
  }
  if (group.heat > 60) music *= 1.2;
  if (group.heat < -40) music *= 0.8;
  const ships = g.ships.filter((s) => s.active && s.groupId === groupId).reduce((s, x) => s + x.heat, 0);
  const topic = group.exposureWeek * 0.6 + Math.abs(group.heat) * 3 + ships * 0.5;
  const sales = group.fandom * 1.2 * fanPayFactor(group) + (latest?.q ?? 0) * 4 + group.exposureWeek * 0.5;
  if (key === "music") return music;
  if (key === "sales") return sales;
  if (key === "topic") return topic;
  if (!group.debutWeek) return 0;
  const age = g.week - group.debutWeek;
  return music * (1 - age / 104) * 1.5;
}

function runFinance(g: Game, push: Push, income: Income[], cash0: number) {
  let grossAll = 0;
  for (const group of g.groups) {
    for (const p of g.projects) {
      if (p.groupId !== group.id || !p.released) continue;
      if (p.saleIdx < p.sales.length) {
        const units = p.sales[p.saleIdx] ?? 0;
        p.saleIdx += 1;
        const money = Math.round(units * DATA.ALBUM_UNIT);
        income.push({ groupId: group.id, gross: money, label: `${p.title} 专辑`, gig: false });
      }
      if (p.streamLeft > 0) {
        const money = Math.round(p.music * DATA.STREAM_COEF * p.streamMul * fanStreamFactor(group) * (1 + 0.1 * Math.min(1, group.cpFans)));
        income.push({ groupId: group.id, gross: money, label: `${p.title} 音源`, gig: false });
        p.streamLeft -= 1;
        if (p.streamLeft <= 8) p.streamMul = r2(p.streamMul * 0.8);
      }
      if (p.releaseWeek && g.week - p.releaseWeek <= 26) {
        const voc = mean(membersOf(g, group.id).map((m) => m.attr.VOC));
        income.push({ groupId: group.id, gross: Math.round(voc * 0.2), label: "版权与 OST", gig: false });
      }
    }
    if (group.debuted && g.week % 4 === 0) {
      income.push({ groupId: group.id, gross: Math.round(group.fandom * 0.6), label: "周边与会员", gig: false });
    }
    group.known = clamp(group.known * (group.heat < -20 ? 0.97 : 0.99), 0, DATA.KNOWN_CAP);
    const before = group.fandom;
    group.fandom = Math.round(group.fandom * 0.98);
    const shipBoost = g.ships
      .filter((s) => s.active && s.groupId === group.id)
      .reduce((s, ship) => s + (ship.heat >= 86 ? 0.1 : ship.heat >= 61 ? 0.06 : ship.heat >= 31 ? 0.03 : 0), 0);
    if (shipBoost) group.fandom = Math.round(group.fandom * (1 + Math.min(0.15, shipBoost)));
    if (group.fandom !== before) {
      push("S7", `${group.name} 粉丝`, `${before} → ${Math.round(group.fandom)}`, group.fandom >= before ? "good" : "neutral", "自然流失 2%，CP 热度对冲");
    }
  }

  const byGroup = new Map<string, number>();
  let loose = 0;
  for (const item of income) {
    grossAll += Math.max(0, item.gross);
    if (item.gross < 0) {
      loose += item.gross;
      push("S7", item.label, `${item.gross} 万`, "bad", "亏损由公司承担，不分成");
      continue;
    }
    if (!item.groupId) {
      loose += item.gross;
      continue;
    }
    byGroup.set(item.groupId, (byGroup.get(item.groupId) ?? 0) + item.gross);
  }
  g.lifetimeIncome += grossAll;
  g.cash += loose;
  for (const [gid, gross] of byGroup) {
    const group = findGroup(g, gid);
    if (!group) {
      g.cash += gross;
      continue;
    }
    const base = companyCut(g, group);
    const ms = membersOf(g, gid).filter((m) => m.status === "active" || m.status === "trainee");
    const share = ms.length ? mean(ms.map((m) => m.cutOverride ?? base)) : base;
    const keep = Math.round(gross * share);
    const paid = gross - keep;
    g.cash += keep;
    push("S7", `${group.name} 收入`, `+${keep} 万`, "good", `毛收入 ${Math.round(gross)} 万，公司分成 ${Math.round(share * 100)}%，成员拿走 ${paid} 万`);
  }

  const costs = costBreakdown(g).filter((r) => r.label !== "贷款利息");
  let spend = 0;
  for (const row of costs) {
    spend += row.amount;
    push("S7", row.label, `-${row.amount} 万`, "neutral", "固定支出");
  }
  g.cash -= spend;
  if (g.debt > 0) {
    const interest = Math.round(g.debt * DATA.INTEREST);
    if (g.cash >= interest) g.cash -= interest;
    else {
      g.debt += interest - Math.max(0, g.cash);
      g.cash = Math.min(g.cash, 0);
    }
    push("S7", "负债利息", `-${interest} 万`, "bad", `负债 ${Math.round(g.debt)} 万 × 2%`);
  }
  if (g.cash < 0) {
    g.debt += -g.cash;
    push("S7", "现金转负债", `${Math.round(g.cash)} 万`, "bad", "现金为负时自动记为负债，经营不中断");
    g.cash = 0;
  }
  g.cash = Math.round(g.cash);
  g.debt = Math.round(g.debt);
  if (g.debt >= DATA.BANKRUPT_DEBT) {
    g.restructure = true;
    push("S7", "破产重组", "必须选择", "bad", "负债达到 12000 万。出售团体、解约成员，或裁撤后保留全员。处理完负债清零，现金回到 500 万。");
  }
  const net = Math.round(g.cash - cash0);
  push("S7", "本周现金变化", `${net >= 0 ? "+" : ""}${net} 万`, net >= 0 ? "good" : "bad", `结算后现金 ${Math.round(g.cash)} 万，负债 ${Math.round(g.debt)} 万`);
}

function runPeople(g: Game, push: Push) {
  for (const m of g.members) {
    if (m.status === "left" || m.status === "military") continue;
    if (m.contractLeft > 0) m.contractLeft -= 1;
    if (m.soloDue && g.week > m.soloDue && m.loyal > 0) {
      m.loyal = clamp(m.loyal - 8, 0, 100);
      push("S8", `${m.name} 的 solo 承诺逾期`, "忠诚 -8", "bad", "续约时答应的个人作品没有落地");
      m.soloDue = 0;
    }
  }
  for (const group of g.groups) {
    const ms = membersOf(g, group.id).filter((m) => m.status !== "military");
    const c = cohesionParts(g, group);
    if (c.value > 70) bumpPairs(g, group.id, 1);
    if (c.value < 40) bumpPairs(g, group.id, -1);
    driftPairs(g, group.id);
    const rival = overlaps(ms);
    for (const o of rival) {
      o.a.loyal = clamp(o.a.loyal - 3, 0, 100);
      o.b.loyal = clamp(o.b.loyal - 3, 0, 100);
      push("S8", `${o.pos}定位重叠`, "忠诚 -3", "bad", `${o.a.name} 与 ${o.b.name} 属性差距小于 5`);
    }
    if (c.gini > 0.55) {
      const avg = mean(ms.map((m) => m.fame));
      for (const m of ms) if (m.fame < avg) m.loyal = clamp(m.loyal - 3, 0, 100);
      push("S8", `${group.name} 人气不均`, `基尼 ${c.gini.toFixed(2)}`, "bad", "低于平均知名度的成员忠诚 -3");
    }
    const center = group.centerId ? findMember(g, group.centerId) : undefined;
    if (center && available(center)) {
      center.mood = clamp(center.mood + 5, 0, 100);
      const avg = mean(ms.map((m) => m.fame));
      if (center.fame > avg * 1.3) {
        for (const m of ms) if (m.id !== center.id) m.mood = clamp(m.mood - 2, 0, 100);
      }
    }
    const mods = positionNotes(ms);
    if (mods.moodAura) {
      for (const m of ms) m.mood = clamp(m.mood + mods.moodAura, 0, 100);
    }
    group.heat = clamp(group.heat + (group.heat > 0 ? -3 : group.heat < 0 ? 3 : 0), -100, 100);
    if (!g.gigs.some((gig) => gig.groupId === group.id && gig.type === "fansign") && !g.ships.some((s) => s.groupId === group.id && s.planned)) {
      transferLayer(group, "hardcore", "casual", 0.005);
      transferLayer(group, "core", "regular", 0.005);
    }
    push("S8", `${group.name} 凝聚力`, c.value.toFixed(0), c.value >= 60 ? "good" : "neutral", `好感 ${c.avg}，队长 ${c.leaderScore}，团活 ${c.team}，基尼扣 ${c.giniPen}，C位 ${c.center}`);
  }
  for (const ship of g.ships.filter((s) => s.active)) {
    const group = findGroup(g, ship.groupId);
    if (!group) continue;
    const act = ship.planned ? CP_ACTIONS.find((a) => a.id === ship.planned) : undefined;
    if (act) {
      let heat = act.heat;
      if (ship.secondary) heat = Math.round(heat * 0.6);
      if (act.id === "sns") {
        ship.snsStreak += 1;
        if (ship.snsStreak >= 3) heat = Math.round(heat * 0.5);
      } else ship.snsStreak = 0;
      if (ship.sugar >= DATA.SUGAR_SOFT) heat = Math.round(heat * 0.5);
      ship.heat = clamp(ship.heat + heat, 0, 100);
      ship.sugar = clamp(ship.sugar + act.sugar, 0, 100);
      ship.cd[act.id] = act.cd + 1;
      const aff = getAff(group, ship.a, ship.b);
      setAff(group, ship.a, ship.b, aff + (aff >= 40 ? 2 : -3));
      group.cpFans = clamp(group.cpFans + 0.01, 0, 0.45);
      push("S8", `CP 营业 · ${act.name}`, `热度 +${heat}`, heat > 0 ? "good" : "bad", `糖精 +${act.sugar}。好感 ${aff >= 40 ? "+2" : "-3（违和）"}`);
      ship.planned = null;
    } else ship.snsStreak = 0;
    const decay = ship.planned ? DATA.CP_DECAY_ACTIVE : DATA.CP_DECAY;
    // planned already cleared; decay as no-biz unless we just biz'd
    const just = !!act;
    ship.heat = clamp(ship.heat - (just ? DATA.CP_DECAY_ACTIVE : decay), 0, 100);
    ship.sugar = clamp(ship.sugar - DATA.SUGAR_DECAY, 0, 100);
    ship.weeks += 1;
    if (ship.sugar > 60) group.heat = clamp(group.heat - 2, -100, 100);
    const ma = findMember(g, ship.a);
    const mb = findMember(g, ship.b);
    if (ma && mb && ship.heat > 60 && getAff(group, ship.a, ship.b) < 40 && rng(g) < 0.2) {
      group.fandom = Math.round(group.fandom * 0.94);
      push("S8", "关系不和被拍到", "粉丝 -6%", "bad", "好感低于 40 仍在高热度营业");
    }
  }
  // fix: decay used ship.planned after clear. The just flag handles it. OK.
  void releaseMember;
}

function bumpPairs(g: Game, groupId: string, d: number) {
  const group = findGroup(g, groupId);
  if (!group) return;
  const ms = membersOf(g, groupId);
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) setAff(group, ms[i]!.id, ms[j]!.id, getAff(group, ms[i]!.id, ms[j]!.id) + d);
  }
}
function driftPairs(g: Game, groupId: string) {
  const group = findGroup(g, groupId);
  if (!group) return;
  const ms = membersOf(g, groupId);
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      let v = getAff(group, ms[i]!.id, ms[j]!.id);
      if (v > 40) v -= 1;
      else if (v < 40) v += 1;
      v += 2;
      setAff(group, ms[i]!.id, ms[j]!.id, v);
    }
  }
}

function stageName(s: string) {
  return ({ concept: "选曲立项", record: "录音制作", choreo: "编舞排练", mv: "MV 拍摄", promo: "宣发预热", done: "发行" } as Record<string, string>)[s] ?? s;
}
function weeksOf(stage: string, scale: Game["projects"][number]["scale"]) {
  const table: Record<string, Record<string, number>> = {
    concept: { single: 1, mini: 1, full: 1 },
    record: { single: 2, mini: 3, full: 4 },
    choreo: { single: 2, mini: 2, full: 2 },
    mv: { single: 1, mini: 1, full: 1 },
    promo: { single: 2, mini: 3, full: 4 },
  };
  return table[stage]?.[scale] ?? 1;
}

type Push = (stage: string, title: string, delta: string, tone: ReportLine["tone"], detail: string) => void;
type Income = { groupId: string | null; gross: number; label: string; gig: boolean };

export function continueAfterEvent(g: Game) {
  if (g.eventQueue.length) {
    g.phase = "event";
    return;
  }
  if (g.restructure) {
    g.phase = "restructure";
    return;
  }
  closeWeek(g);
}
