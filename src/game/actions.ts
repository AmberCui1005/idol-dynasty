import { CP_ACTIONS, DATA, POSITIONS } from "./data";
import type { Game, Genre, GroupType, Scale } from "./types";
import { assessOffer, bidOutlook, cohesionParts, debutScore, isBusy } from "./calc";
import { blankGroup, initAff, memberFrom, signCostOf } from "./create";
import { available, clamp, findGroup, findMember, getAff, membersOf, pairKey, r2, rng, setAff, uid } from "./util";

export type ActResult = { ok: boolean; message: string };

function fail(message: string): ActResult {
  return { ok: false, message };
}
function ok(message: string): ActResult {
  return { ok: true, message };
}

export function setSchedule(g: Game, memberId: string, act: string): ActResult {
  const m = findMember(g, memberId);
  if (!m) return fail("找不到成员");
  if (m.status === "injured" && act !== "rest" && act !== "skip") return fail("伤病期间只能休息");
  if (m.status === "military") return fail("服役中无法排程");
  if ((m.surgeryRest ?? 0) > 0 && act !== "rest" && act !== "skip") return fail("整容恢复中，只能休息");
  if (m.energy < 10 && act !== "rest" && act !== "skip") return fail("体力低于 10，本周强制休息");
  if (act !== "skip" && act !== "rest" && g.gigs.some((gig) => gig.memberIds.includes(m.id))) {
    return fail("已有通告档期，本周个人槽被占用");
  }
  if (act === "channel" && m.attr.VAR < 50) return fail("综艺感未到 50，开不了个人频道");
  g.schedules[memberId] = act;
  return ok("已写入行程");
}

export function setTeam(g: Game, groupId: string, act: string): ActResult {
  const group = findGroup(g, groupId);
  if (!group) return fail("找不到团体");
  if (act !== "skip" && g.gigs.some((gig) => gig.groupId === groupId && gig.blocksTeam)) return fail("团体档期被通告占用，本周团活做不了");
  if (act === "camp") {
    if (group.lastCamp && g.week - group.lastCamp < 8) return fail(`合宿冷却中，还需 ${8 - (g.week - group.lastCamp)} 周`);
  }
  g.teamSchedules[groupId] = act;
  return ok("已写入团体行程");
}

export function applyTemplate(g: Game, groupId: string, tpl: "vocal" | "rest" | "balance" | "clear") {
  const ms = membersOf(g, groupId).filter((m) => m.status !== "left" && m.status !== "military");
  const cycle = ["vocal", "dance", "rap", "rest"];
  ms.forEach((m, i) => {
    if (m.status === "injured" || (m.surgeryRest ?? 0) > 0) {
      g.schedules[m.id] = "rest";
      return;
    }
    if (g.gigs.some((gig) => gig.memberIds.includes(m.id))) return;
    if (m.energy < 10) {
      g.schedules[m.id] = "rest";
      return;
    }
    if (tpl === "clear") g.schedules[m.id] = "skip";
    else if (tpl === "vocal") g.schedules[m.id] = "vocal";
    else if (tpl === "rest") g.schedules[m.id] = "rest";
    else g.schedules[m.id] = cycle[i % cycle.length]!;
  });
  if (!g.gigs.some((gig) => gig.groupId === groupId && gig.blocksTeam)) {
    g.teamSchedules[groupId] = tpl === "rest" || tpl === "clear" ? "skip" : "practice";
  }
  return ok("模板已填入，仍可单独调整");
}

export function surgeryReason(g: Game, m: Game["members"][number] | undefined) {
  if (!m || m.status === "left") return "这个人已经不在公司";
  if (m.status === "military") return "服役期间不能整容";
  if (m.status === "injured" || (m.surgeryRest ?? 0) > 0) return "正在休养，手术室不收";
  if (m.disfigured) return "上次毁容，医生拒绝再动";
  if ((m.visOps ?? 0) >= DATA.SURGERY_MAX) return `已经整过 ${DATA.SURGERY_MAX} 次，再动没有意义`;
  const born = m.visBorn ?? m.attr.VIS;
  const cap = Math.min(97, born + DATA.SURGERY_CAP);
  if (m.attr.VIS >= cap) return `整容最多比天生外形高 ${DATA.SURGERY_CAP}，已经到顶`;
  if ((m.surgeryCd ?? 0) > 0) return `距离下次整容还要 ${m.surgeryCd} 周`;
  if (g.cash < DATA.SURGERY_COST) return `整容要 ${DATA.SURGERY_COST} 万，现金不够`;
  return "";
}

export function doSurgery(g: Game, memberId: string): ActResult {
  const m = findMember(g, memberId);
  const why = surgeryReason(g, m);
  if (!m || why) return fail(why || "不能整容");
  g.cash -= DATA.SURGERY_COST;
  const born = m.visBorn ?? m.attr.VIS;
  m.visBorn = born;
  m.surgeryRest = DATA.SURGERY_REST;
  g.schedules[m.id] = "rest";
  if (rng(g) < DATA.SURGERY_RISK) {
    const before = Math.round(m.attr.VIS);
    m.attr.VIS = clamp(before - DATA.SURGERY_DROP, 16, 100);
    m.disfigured = true;
    m.mood = clamp(m.mood - 22, 0, 100);
    m.loyal = clamp(m.loyal - 8, 0, 100);
    const group = m.groupId ? findGroup(g, m.groupId) : undefined;
    if (group) {
      group.heat = clamp(group.heat - 10, -100, 100);
      group.fandom = Math.round(group.fandom * 0.96);
    }
    g.log.unshift({ week: g.week, title: `${m.name} 整容失败` });
    return ok(`${m.name} 毁容。外形 ${before} → ${m.attr.VIS}。舆论下滑，此后不能再整。休养 ${DATA.SURGERY_REST} 周。`);
  }
  const cap = Math.min(97, born + DATA.SURGERY_CAP);
  const before = m.attr.VIS;
  m.attr.VIS = Math.min(cap, r2(before + DATA.SURGERY_GAIN));
  m.visOps = (m.visOps ?? 0) + 1;
  m.surgeryCd = DATA.SURGERY_CD;
  m.mood = clamp(m.mood - 6, 0, 100);
  g.log.unshift({ week: g.week, title: `${m.name} 整容成功` });
  return ok(`${m.name} 外形 ${Math.round(before)} → ${Math.round(m.attr.VIS)}。上限 ${cap}（天生 ${Math.round(born)} +${DATA.SURGERY_CAP}）。休养 ${DATA.SURGERY_REST} 周。`);
}

export function placeBid(g: Game, offerId: string, groupId: string, memberIds: string[], quote: number): ActResult {
  const offer = g.offers.find((o) => o.id === offerId);
  const group = findGroup(g, groupId);
  if (!offer || !group) return fail("通告已刷新");
  if (g.bids.some((b) => b.offerId === offerId)) return fail("这张通告已经出过价");
  const ids = offer.scope === "member" ? memberIds.slice(0, 1) : membersOf(g, groupId).filter((m) => available(m) && !isBusy(g, m.id)).map((m) => m.id);
  if (offer.scope === "member" && !ids[0]) return fail("选择一名成员");
  if (offer.scope === "group" && ids.length < 2) return fail("可上场人数不足");
  for (const id of ids) {
    const why = isBusy(g, id);
    if (why) return fail(why);
  }
  const gate = assessOffer(g, offer, group, ids);
  if (gate.status === "no") return fail(gate.reasons[0] || "门槛不足");
  const q = clamp(quote, 0.8, 1.3);
  const deposit = Math.max(1, Math.round(offer.pay * 0.1));
  if (g.cash < deposit) return fail(`保证金 ${deposit} 万，现金不够`);
  g.cash -= deposit;
  g.bids.push({ id: uid(g, "b"), offerId, groupId, memberIds: ids, quote: q, deposit });
  return ok(`已支付保证金 ${deposit} 万。中标结果在本周结算后揭晓。`);
}

export function cancelBid(g: Game, bidId: string): ActResult {
  const i = g.bids.findIndex((b) => b.id === bidId);
  if (i < 0) return fail("报价不存在");
  g.cash += g.bids[i]!.deposit;
  g.bids.splice(i, 1);
  return ok("保证金已退回");
}

export function setPosition(g: Game, groupId: string, pos: string, memberId: string | null): ActResult {
  const def = POSITIONS.find((p) => p.id === pos);
  if (!def) return fail("未知定位");
  const members = membersOf(g, groupId);
  if (def.unique) {
    for (const m of members) m.positions = m.positions.filter((p) => p !== pos);
  }
  if (!memberId) return ok("已卸下定位");
  const m = members.find((x) => x.id === memberId);
  if (!m) return fail("成员不在这个团");
  if (m.positions.includes(pos)) return ok("已经是这个定位");
  if (m.positions.length >= 3) return fail("一人最多兼任 3 个定位");
  if (!def.unique) {
    /* allow several */
  }
  m.positions.push(pos);
  return ok(`${m.name} 担任${def.name}`);
}

export function setCenter(g: Game, groupId: string, memberId: string | null): ActResult {
  const group = findGroup(g, groupId);
  if (!group) return fail("找不到团体");
  if (group.centerCd > 0 && memberId !== group.centerId) return fail(`C 位更换冷却还剩 ${group.centerCd} 周`);
  if (memberId === group.centerId) return ok("C 位没有变化");
  const next = memberId ? findMember(g, memberId) : undefined;
  if (memberId && (!next || next.groupId !== groupId)) return fail("成员不在团内");
  const prev = group.centerId ? findMember(g, group.centerId) : undefined;
  if (prev && next) {
    prev.mood = clamp(prev.mood - 25, 0, 100);
    prev.loyal = clamp(prev.loyal - 8, 0, 100);
    next.mood = clamp(next.mood + 15, 0, 100);
    next.loyal = clamp(next.loyal + 5, 0, 100);
    group.cohesionBuff = r2(group.cohesionBuff - 5);
    if (getAff(group, prev.id, next.id) < 40) {
      const tag = `冷战：${prev.name} 与 ${next.name}`;
      if (!group.conflicts.includes(tag)) group.conflicts.push(tag);
    }
    group.centerCd = DATA.CENTER_CD;
  } else if (next && !prev) {
    next.mood = clamp(next.mood + 8, 0, 100);
    group.centerCd = 0;
  }
  group.centerId = memberId;
  for (const m of membersOf(g, groupId)) {
    m.positions = m.positions.filter((p) => p !== "center");
  }
  return ok(next ? `${next.name} 成为 C 位` : "C 位已留空");
}

export function debut(g: Game, groupId: string): ActResult {
  const group = findGroup(g, groupId);
  if (!group) return fail("找不到团体");
  if (group.debuted) return fail("已经出道");
  const ms = membersOf(g, groupId).filter(available);
  if (ms.length < 2) return fail("至少 2 名可出道成员");
  if (g.cash < DATA.DEBUT_FEE) return fail(`出道企划费 ${DATA.DEBUT_FEE} 万，现金不够`);
  const score = debutScore(g, group);
  g.cash -= DATA.DEBUT_FEE;
  group.debuted = true;
  group.debutWeek = g.week;
  group.known = score.known;
  group.fandom = score.fandom;
  if (group.type === "mixed") group.known = Math.round(group.known * 1.15);
  if (score.score < 50) {
    group.nuguLeft = 26;
    for (const m of ms) m.mood = clamp(m.mood - 15, 0, 100);
  }
  for (const m of ms) {
    m.status = "active";
    m.contractLeft = DATA.CONTRACT_WEEKS;
    m.salary = DATA.SALARY;
  }
  g.rep = clamp(g.rep + (score.score >= 80 ? 25 : score.score >= 65 ? 12 : 4), 0, 1000);
  g.log.unshift({ week: g.week, title: `${group.name} 出道：${score.tier}（${score.score}）` });
  return ok(`${score.tier}。认知 ${score.known}，粉丝 ${score.fandom}。${score.note}`);
}

export function foundGroup(g: Game, name: string, type: GroupType, memberIds: string[]): ActResult {
  if (g.groups.length >= DATA.MAX_GROUPS) return fail("最多同时运营 4 支团体");
  if (memberIds.length < 2 || memberIds.length > 9) return fail("人数需要在 2 到 9 之间");
  if (g.cash < 100) return fail("建团企划至少 100 万");
  const ms = memberIds.map((id) => findMember(g, id));
  if (ms.some((m) => !m || m.groupId || m.status === "left")) return fail("只能编入尚未入团的练习生");
  if (type === "girl" && ms.some((m) => m!.gender !== "f")) return fail("女团不能编入男性成员");
  if (type === "boy" && ms.some((m) => m!.gender !== "m")) return fail("男团不能编入女性成员");
  g.cash -= 100;
  const group = blankGroup(uid(g, "g"), name.trim() || "新团", type);
  for (const m of ms) m!.groupId = group.id;
  initAff(g, group);
  g.groups.push(group);
  return ok(`${group.name} 已建立，仍是练习生团`);
}

export function signScout(g: Game, scoutId: string): ActResult {
  const i = g.scouts.findIndex((s) => s.id === scoutId);
  if (i < 0) return fail("候选人已离开");
  const s = g.scouts[i]!;
  if (g.cash < s.signCost) return fail("签约金不够");
  g.cash -= s.signCost;
  const m = memberFrom(
    g,
    { name: s.name, gender: s.gender, age: s.age, attr: s.attr, tal: s.tal, pot: s.pot, amb: s.amb, loyal: s.loyal, examined: s.examined },
    null,
  );
  g.members.push(m);
  g.scouts.splice(i, 1);
  return ok(`${m.name} 签约，每周培训费 3 万。把人编进团体后才能一起训练出道。`);
}

export function assignToGroup(g: Game, memberId: string, groupId: string): ActResult {
  const m = findMember(g, memberId);
  const group = findGroup(g, groupId);
  if (!m || !group) return fail("对象不存在");
  if (m.groupId) return fail("已经在团体里。跨团需要先解约。");
  if (m.status !== "trainee") return fail("只有练习生能新编入");
  const n = membersOf(g, groupId).length;
  if (n >= 9) return fail("一团最多 9 人");
  if (group.type === "girl" && m.gender !== "f") return fail("女团");
  if (group.type === "boy" && m.gender !== "m") return fail("男团");
  if (group.debuted) return fail("已出道团体不能中途塞入练习生，避免定位被打乱。先让其以个人身份训练。");
  m.groupId = groupId;
  for (const other of membersOf(g, groupId)) {
    if (other.id !== m.id) setAff(group, m.id, other.id, 36);
  }
  return ok(`${m.name} 加入 ${group.name}`);
}

export function spendAp(g: Game, kind: string, targetId?: string): ActResult {
  if (g.ap <= 0) return fail("本周管理行动点已用完");
  if (kind === "network") {
    g.ap -= 1;
    g.network = clamp(g.network + 8, 0, 100);
    for (const k of Object.keys(g.clientRel)) g.clientRel[k] = clamp((g.clientRel[k] ?? 0) + 8, 0, 100);
    return ok("人脉 +8。竞标时的关系系数会上升。");
  }
  if (kind === "pr") {
    g.ap -= 1;
    for (const group of g.groups) group.heat = clamp(group.heat + 8, -100, 100);
    return ok("紧急公关，各团舆论 +8");
  }
  if (kind === "fans") {
    g.ap -= 1;
    if (g.cash < 10) return fail("粉丝运营需要 10 万");
    g.cash -= 10;
    const group = g.groups.find((x) => x.debuted) ?? g.groups[0];
    if (group) {
      const take = Math.min(0.02, group.layers.casual);
      group.layers.casual -= take;
      group.layers.core += take;
    }
    return ok("核心粉占比上升了约 2 个点");
  }
  if (kind === "examine") {
    const s = g.scouts.find((x) => x.id === targetId);
    if (!s) return fail("候选人不在了");
    g.ap -= 1;
    s.examined = true;
    return ok(`${s.name} 的天赋区间收窄了`);
  }
  if (kind === "talk") {
    const m = findMember(g, targetId);
    if (!m || m.status === "left") return fail("找不到成员");
    g.ap -= 1;
    m.mood = clamp(m.mood + 8, 0, 100);
    m.loyal = clamp(m.loyal + 4, 0, 100);
    const group = m.groupId ? findGroup(g, m.groupId) : undefined;
    if (group) {
      const others = membersOf(g, group.id).filter((x) => x.id !== m.id);
      const other = others[0];
      if (other) setAff(group, m.id, other.id, getAff(group, m.id, other.id) + 3);
    }
    return ok(`${m.name} 情绪 +8，忠诚 +4`);
  }
  return fail("没有这个行动");
}

export function setCoach(g: Game, coach: Game["coach"]): ActResult {
  g.coach = coach;
  const fee = DATA.COACH_FEE[coach];
  return ok(fee ? `已更换教练，每周 ${fee} 万，从下周结算开始扣除` : "改回基础教练，不再支付教练费");
}

export function takeLoan(g: Game, amount: number): ActResult {
  const n = Math.round(amount);
  if (![500, 1000, 2000].includes(n)) return fail("只能借入 500、1000 或 2000 万");
  g.cash += n;
  g.debt += n;
  return ok(`到账 ${n} 万。负债按每周 2% 计息。`);
}

export function startProject(g: Game, groupId: string, scale: Scale, genre: Genre, tier: 0 | 1 | 2 | 3): ActResult {
  const group = findGroup(g, groupId);
  if (!group?.debuted) return fail("出道之后才能立项");
  if (g.projects.some((p) => p.groupId === groupId && !p.released)) return fail("这个团还有未完成的作品");
  if (group.pausedLeft > 0) return fail("团体暂停中");
  g.projects.push({
    id: uid(g, "p"),
    groupId,
    title: "",
    scale,
    genre,
    stage: "concept",
    stageLeft: 1,
    budgetTier: tier,
    spent: 0,
    stalled: false,
    released: false,
    releaseWeek: null,
    q: 0,
    promo: 1,
    sales: [],
    saleIdx: 0,
    music: 0,
    streamLeft: 0,
    streamMul: 1,
    failed: false,
  });
  const p = g.projects[g.projects.length - 1]!;
  p.title = `${group.name} «${pickSong(g)}»`;
  return ok(`${p.title} 已立项。资金不足时会停滞，已花的钱不退。`);
}

function pickSong(g: Game) {
  const songs = ["午夜地铁", "GLASS HEART", "粉红噪音", "AFTERIMAGE", "我们的季节", "NEON RAIN", "无声应援", "BLUE HOUR", "糖与刀", "FIRST LIGHT", "回声旅馆", "灯塔练习室"];
  return songs[Math.floor((g.rng % 997) % songs.length)] ?? "未命名";
}

export function planShipBiz(g: Game, shipId: string, actionId: string): ActResult {
  const ship = g.ships.find((s) => s.id === shipId && s.active);
  if (!ship) return fail("CP 不存在");
  if (ship.planned) return fail("本周已经安排过营业");
  const act = CP_ACTIONS.find((a) => a.id === actionId);
  if (!act) return fail("没有这个营业");
  if ((ship.cd[actionId] ?? 0) > 0) return fail(`冷却还剩 ${ship.cd[actionId]} 周`);
  if (g.cash < act.cost) return fail("资金不够");
  g.cash -= act.cost;
  ship.planned = actionId;
  return ok(`${act.name} 会在本周结算时生效`);
}

export function cancelShipBiz(g: Game, shipId: string): ActResult {
  const ship = g.ships.find((s) => s.id === shipId);
  if (!ship?.planned) return fail("没有待结算的营业");
  const act = CP_ACTIONS.find((a) => a.id === ship.planned);
  if (act) g.cash += act.cost;
  ship.planned = null;
  return ok("营业已取消，费用退回");
}

export function createShip(g: Game, groupId: string, a: string, b: string): ActResult {
  const group = findGroup(g, groupId);
  if (!group) return fail("找不到团体");
  if (a === b) return fail("需要两名成员");
  const ma = findMember(g, a);
  const mb = findMember(g, b);
  if (!ma || !mb || ma.groupId !== groupId || mb.groupId !== groupId) return fail("必须是同团成员");
  const active = g.ships.filter((s) => s.groupId === groupId && s.active);
  if (active.length >= DATA.MAX_SHIPS) return fail("每团最多 3 对 CP");
  if (g.ships.some((s) => s.active && ((s.a === a && s.b === b) || (s.a === b && s.b === a)))) return fail("这对已经在营业");
  const count = (id: string) => active.filter((s) => s.a === id || s.b === id).length;
  if (count(a) >= 2 || count(b) >= 2) return fail("同一成员最多同时两对 CP");
  const ban = g.cpBans.find((x) => x.key === pairKey(a, b) && x.until > g.week);
  if (ban) return fail(`解绑冷却中，直到第 ${ban.until} 周`);
  const aff = getAff(group, a, b);
  const ship = {
    id: uid(g, "cp"),
    groupId,
    a,
    b,
    kind: "official" as const,
    heat: aff >= 25 ? 12 : 6,
    sugar: aff >= 25 ? 4 : 18,
    weeks: 0,
    active: true,
    secondary: count(a) >= 1 || count(b) >= 1,
    planned: null,
    snsStreak: 0,
    cd: {},
  };
  if (aff < 25) {
    setAff(group, a, b, aff - 5);
  }
  g.ships.push(ship);
  return ok(aff < 25 ? "好感不足仍强制组成，糖精一开始就偏高" : "官方 CP 成立");
}

export function unbindShip(g: Game, shipId: string, mode: "peace" | "cut"): ActResult {
  const ship = g.ships.find((s) => s.id === shipId && s.active);
  const group = ship ? findGroup(g, ship.groupId) : undefined;
  if (!ship || !group) return fail("CP 不存在");
  if (mode === "peace") {
    group.fandom = Math.round(group.fandom * 0.92);
    group.cpFans = r2(group.cpFans * 0.4);
    g.cpBans.push({ key: pairKey(ship.a, ship.b), until: g.week + 8 });
  } else {
    group.fandom = Math.round(group.fandom * 0.85);
    group.cpFans = r2(group.cpFans * 0.25);
    setAff(group, ship.a, ship.b, getAff(group, ship.a, ship.b) - 10);
    g.cpBans.push({ key: pairKey(ship.a, ship.b), until: g.week + 12 });
  }
  ship.active = false;
  ship.heat = 0;
  ship.sugar = 0;
  ship.planned = null;
  return ok(mode === "peace" ? "和平解绑：粉丝 -8%，8 周内不能重组" : "强行切割：粉丝 -15%，好感 -10，12 周冷却");
}

export function restructure(g: Game, mode: "sell" | "cut" | "keep"): ActResult {
  if (mode === "sell") {
    if (!g.groups.length) return fail("没有可出售的团体");
    const top = g.groups.slice().sort((a, b) => b.fandom - a.fandom)[0]!;
    g.members.forEach((m) => {
      if (m.groupId === top.id) {
        m.status = "left";
        m.groupId = null;
      }
    });
    g.groups = g.groups.filter((x) => x.id !== top.id);
    g.ships = g.ships.filter((s) => s.groupId !== top.id);
    g.projects = g.projects.filter((p) => p.groupId !== top.id);
    g.gigs = g.gigs.filter((x) => x.groupId !== top.id);
  } else if (mode === "cut") {
    const ranked = g.members.filter((m) => m.status !== "left").sort((a, b) => b.fame - a.fame);
    for (const m of ranked.slice(0, 2)) {
      m.status = "left";
      m.groupId = null;
    }
  } else {
    for (const s of g.ships) s.active = false;
    g.projects = g.projects.filter((p) => p.released);
    g.gigs = [];
    g.rep = clamp(g.rep - 10, 0, 1000);
  }
  g.debt = 0;
  g.cash = 500;
  g.rep = clamp(g.rep - 40, 0, 1000);
  g.restructure = false;
  g.negStreak = 0;
  g.log.unshift({ week: g.week, title: "破产重组完成，现金回到 500 万" });
  return ok("负债清零，现金 500 万，公司声望 -40。未来招募质量会差一截。");
}

export function releaseMember(g: Game, memberId: string, pay: boolean) {
  const m = findMember(g, memberId);
  if (!m || m.status === "left") return;
  if (pay && m.contractLeft > 0) {
    const penalty = Math.round(m.contractLeft * m.salary * 3);
    g.cash -= penalty;
  }
  const group = m.groupId ? findGroup(g, m.groupId) : undefined;
  if (group && group.centerId === m.id) group.centerId = null;
  m.status = "left";
  m.groupId = null;
  g.ships.forEach((s) => {
    if (s.active && (s.a === m.id || s.b === m.id)) {
      s.active = false;
      if (group) group.fandom = Math.round(group.fandom * 0.95);
    }
  });
}

export function openTasks(g: Game) {
  const group = g.groups[0];
  const tasks: { done: boolean; text: string; page: string }[] = [
    { done: Object.keys(g.schedules).length > 0, text: "为成员安排本周行程", page: "schedule" },
    { done: g.groups.some((x) => x.debuted), text: "能力上来之后安排出道", page: "group" },
    { done: g.bids.length > 0 || g.gigs.length > 0, text: "去通告市场看现金流", page: "gigs" },
    { done: g.projects.length > 0, text: "出道后立项一张单曲", page: "studio" },
  ];
  if (group && !group.debuted) {
    const score = debutScore(g, group);
    tasks[1]!.text = `出道评估目前 ${score.score}（${score.tier}）`;
  }
  return tasks;
}

export function cohesionLine(g: Game, groupId: string) {
  const group = findGroup(g, groupId);
  if (!group) return "";
  const c = cohesionParts(g, group);
  return `0.50×好感 ${c.avg} + 队长 ${c.leaderScore} + 团活 ${c.team} − 基尼 ${c.giniPen} + C位 ${c.center} − 冲突 ${c.conflict} + 修正 ${c.buff}`;
}
