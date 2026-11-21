import { releaseMember } from "./actions";
import { DATA } from "./data";
import type { Effect, Game, LiveEvent } from "./types";
import { cohesionParts } from "./calc";
import { available, clamp, findGroup, findMember, getAff, membersOf, rng, seasonOf, setAff, uid } from "./util";

function seen(g: Game, id: string, salt = "") {
  const k = salt ? `${id}:${salt}` : id;
  const last = g.seen[k];
  return !!(last && g.week - last < 12);
}
function mark(g: Game, id: string, salt = "") {
  g.seen[salt ? `${id}:${salt}` : id] = g.week;
}

export function rollEvents(g: Game): LiveEvent[] {
  const out: LiveEvent[] = [];
  const push = (ev: LiveEvent, id: string, salt = "") => {
    if (seen(g, id, salt)) return;
    mark(g, id, salt);
    out.push(ev);
  };

  for (const group of g.groups) {
    const ms = membersOf(g, group.id);
    for (const m of ms) {
      if (m.gender === "m" && !m.militaryHandled && m.status === "active") {
        const gate = m.delayMilitary ? 30 : 27;
        if (m.age >= gate) {
          push(militaryEvent(g, group.id, m.id, m.name), "E11", m.id);
        }
      }
      if (m.status === "injured" && m.injuryLeft > 0) push(injuryEvent(g, group.id, m), "E10", m.id);
      if (m.contractLeft > 0 && m.contractLeft <= 12 && (m.status === "active" || m.status === "injured")) {
        push(contractEvent(g, group, m), "E13", m.id);
      }
      if (m.mood < 25 && available(m)) push(quitEvent(g, group.id, m), "E17", m.id);
    }
    const pairs = worstPair(g, group.id);
    if (pairs && pairs.aff < 35 && g.week > 2) push(coldEvent(g, group.id, pairs), "E02", pairs.a.id);
    const c = cohesionParts(g, group);
    if (c.gini > 0.6 && ms.length > 2) push(giniEvent(g, group.id), "E03", group.id);
    for (const s of g.ships.filter((x) => x.active && x.groupId === group.id)) {
      if (s.sugar >= DATA.SUGAR_LIMIT) push(sugarEvent(g, group.id, s.id), "E12", s.id);
      const ma = findMember(g, s.a);
      const mb = findMember(g, s.b);
      if (ma && mb && s.heat > 70) {
        const hi = Math.max(ma.fame, mb.fame);
        const lo = Math.max(1, Math.min(ma.fame, mb.fame));
        if (hi / lo > 1.4) push(fanwarEvent(g, group.id, s.id), "fanwar", s.id);
      }
    }
    const released = g.projects.find((p) => p.groupId === group.id && p.releaseWeek === g.week);
    if (released?.failed && g.projects.filter((p) => p.groupId === group.id && p.released).length === 1) {
      push(flopEvent(g, group.id, released.title), "E01", group.id);
    }
    if (group.known > 150 && rng(g) < 0.08) push(datingEvent(g, group.id, ms), "E04", group.id);
    if (group.fandom > 400 && rng(g) < 0.1) push(sasaengEvent(g, group.id), "E05", group.id);
    if (group.heat < -60) push(unfollowEvent(g, group.id), "E16", group.id);
    if (group.known > 500 && !seen(g, "E18", group.id) && rng(g) < 0.12) push(overseasEvent(g, group.id), "E18", group.id);
    const making = g.projects.find((p) => p.groupId === group.id && !p.released && (p.stage === "mv" || p.stage === "promo"));
    if (making && rng(g) < 0.18) push(leakEvent(g, group.id, making.title), "E19", making.id);
  }

  const { w } = seasonOf(g.week);
  if (w === 20) {
    const target = g.members
      .filter((m) => m.status === "active" && m.loyal < 40)
      .sort((a, b) => b.fame - a.fame)[0];
    if (target) push(poachEvent(g, target.id, target.name), "E07", target.id);
  }
  if (g.negStreak >= 8) push(investorEvent(g), "E08", "co");
  const idx = g.charts.music.findIndex((r) => r.player);
  if (w === 52 && idx >= 0 && idx < 3) push(awardEvent(g), "E14", "co");
  if (!g.taxed && g.lifetimeIncome > 5000) push(taxEvent(g), "E15", "co");

  if (out.length === 0 && rng(g) < 0.62) {
    const ev = flavor(g);
    if (!seen(g, ev.id, "co")) {
      mark(g, ev.id, "co");
      out.push(ev);
    }
  }
  return out.slice(0, 3);
}

function base(g: Game, id: string, title: string, category: string, text: string, options: LiveEvent["options"], extra: Partial<LiveEvent> = {}): LiveEvent {
  return { uid: uid(g, "ev"), id, title, category, text, options, ...extra };
}

function militaryEvent(g: Game, groupId: string, memberId: string, name: string): LiveEvent {
  return base(g, "E11", "兵役通知", "成员", `${name} 到了服役年龄。男团和混合团躲不过这 78 周。`, [
    { label: "按期服役", detail: "缺席 78 周。团体认知 -15。", effects: { known: -15 }, special: "militaryServe" },
    { label: "延期到 30 岁", detail: "公司声望 -15，只能拖一次。", effects: { rep: -15 }, special: "militaryDelay" },
    { label: "转小分队过冬", detail: "照样服役，但给剩下的人凝聚力 +4，避免空窗期彻底停摆的舆论。", effects: { cohesionBuff: 4, known: -8 }, special: "militaryServe" },
  ], { groupId, memberId });
}

function injuryEvent(g: Game, groupId: string, m: { id: string; name: string }): LiveEvent {
  return base(g, "E10", "成员伤病", "成员", `${m.name} 的体力透支，医务室要求停掉一切行程。`, [
    { label: "安心休养", detail: "维持伤病状态，医疗费 30 万，情绪 +6。", effects: { cash: -30, mood: 6 }, special: "restInjury" },
    { label: "带伤上阵", detail: "立即归队，但体力只剩 12，情绪 -8。", effects: { mood: -8 }, special: "performInjured" },
    { label: "手术", detail: "再花 40 万，伤病缩短到 1 周。", effects: { cash: -40, mood: 4 }, special: "surgery" },
  ], { groupId, memberId: m.id });
}

function contractEvent(g: Game, group: { id: string; centerId: string | null }, m: { id: string; name: string; fame: number; amb: number; loyal: number }): LiveEvent {
  const mates = membersOf(g, group.id);
  const top = mates.slice().sort((a, b) => b.fame - a.fame)[0];
  let demand = "更稳定的休息安排";
  if (m.fame > 600) demand = "周薪翻倍";
  else if (top && top.id === m.id && group.centerId !== m.id && m.fame > 180) demand = "担任 C 位";
  else if (m.amb > 60) demand = "26 周内的 solo 承诺";
  else if (m.fame > 400) demand = "分成改为公司 45 / 成员 55";
  return base(
    g,
    "E13",
    "续约谈判",
    "人事",
    `${m.name} 的合约进入最后 12 周。对方把条件摊开：${demand}。`,
    [
      { label: "接受条件", detail: "满足诉求，忠诚 +12。", effects: { loyal: 12 }, special: "acceptDemand" },
      { label: "部分让步", detail: "加薪两成，忠诚 -5。", effects: { loyal: -5 }, special: "partialDeal" },
      { label: "拒绝", detail: "忠诚 -20。若降到 25 以下，对方会支付结构内的解约。", effects: { loyal: -20 }, special: "refuseContract", danger: true },
    ],
    { groupId: group.id, memberId: m.id, demand },
  );
}

function quitEvent(g: Game, groupId: string, m: { id: string; name: string }): LiveEvent {
  return base(g, "E17", "退团意愿", "成员", `${m.name} 的情绪跌破 25，经纪人带回一句很轻的话：不想干了。`, [
    { label: "加薪挽留", detail: "周薪 +10，情绪 +16，忠诚 +10。", effects: { mood: 16, loyal: 10 }, special: "raiseSalary" },
    { label: "当面谈心", detail: "消耗 1 点行动点。情绪 +12，忠诚 +6。", effects: { mood: 12, loyal: 6 }, needAp: 1, special: "talkQuit" },
    { label: "放行", detail: "按剩余合约支付违约金（剩余周数 × 周薪 × 3）。", effects: {}, special: "releasePay", danger: true },
  ], { groupId, memberId: m.id });
}

function coldEvent(g: Game, groupId: string, pair: { a: { id: string; name: string }; b: { id: string; name: string }; aff: number }): LiveEvent {
  return base(g, "E02", "队内冷战", "团队", `${pair.a.name} 和 ${pair.b.name} 已经不说话了。好感只剩 ${Math.round(pair.aff)}。`, [
    { label: "分别面谈", detail: "消耗 1 点行动点。双方好感 +5，凝聚力修正 +3。", effects: { cohesionBuff: 3 }, needAp: 1, special: "mediate" },
    { label: `公开支持 ${pair.a.name}`, detail: `${pair.a.name} 忠诚 +10，${pair.b.name} 忠诚 -15，凝聚力 -6。`, effects: { cohesionBuff: -6 }, special: "standA" },
    { label: "冷处理", detail: "3 周后若仍未解开，粉丝 -5%。", effects: { fandomPct: -0.05 }, delay: 3, special: "coldDelay" },
  ], { groupId, memberId: pair.a.id, memberId2: pair.b.id });
}

function giniEvent(g: Game, groupId: string): LiveEvent {
  return base(g, "E03", "人气不均", "团队", "粉丝把镜头差算得很清楚。边缘成员的名字开始从应援牌上消失。", [
    { label: "把曝光让给边缘位", detail: "人气最高者知名度 -20，其余每人 +15，凝聚力 +4。", effects: { cohesionBuff: 4 }, special: "shareFame" },
    { label: "强行更换 C 位到人气第一", detail: "走正常换 C 位代价。", effects: {}, special: "centerTop", danger: true },
    { label: "先不管", detail: "低人气成员忠诚再 -6。", effects: {}, special: "ignoreGap" },
  ], { groupId });
}

function sugarEvent(g: Game, groupId: string, shipId: string): LiveEvent {
  return base(g, "E12", "营业过度", "舆论", "糖精浓度冲破 85。路人开始用「工业糖精」称呼这对。", [
    { label: "立刻降温", detail: "热度 -15，糖精 -25，舆论 -6。", effects: { shipHeat: -15, sugar: -25, heat: -6 } },
    { label: "继续营业", detail: "热度再 +6，但路人好感（舆论）-12。", effects: { shipHeat: 6, heat: -12, sugar: 5 }, danger: true },
    { label: "切割 CP", detail: "按强行切割结算。", effects: {}, special: "cutShip", danger: true },
  ], { groupId, shipId });
}

function fanwarEvent(g: Game, groupId: string, shipId: string): LiveEvent {
  return base(g, "fanwar", "唯粉互撕", "舆论", "热度起来之后，两边唯粉开始审计每秒镜头。", [
    { label: "官方降温", detail: "CP 热度 -12，舆论 -4，双方忠诚 -2。", effects: { shipHeat: -12, heat: -4, loyal: -2 } },
    { label: "装没看见", detail: "舆论 -8，双方忠诚 -5。", effects: { heat: -8, loyal: -5 } },
  ], { groupId, shipId });
}

function flopEvent(g: Game, groupId: string, title: string): LiveEvent {
  return base(g, "E01", "回归失利", "市场", `${title} 的质量分没有站住。发行当周粉丝已经在退。`, [
    { label: "追加宣发", detail: "花费 200 万，舆论 +14，认知 +25。", effects: { cash: -200, heat: 14, known: 25 } },
    { label: "认栽", detail: "粉丝再 -10%，把预算留给下一张。", effects: { fandomPct: -0.1 } },
  ], { groupId });
}

function datingEvent(g: Game, groupId: string, ms: { id: string; name: string }[]): LiveEvent {
  const m = ms[Math.floor(rng(g) * ms.length)] ?? ms[0];
  return base(g, "E04", "深夜同框", "舆论", `狗仔拍到 ${m?.name ?? "成员"} 与圈外人士深夜同框，图已经在流传。`, [
    { label: "承认", detail: "舆论 -20，粉丝 -6%，当事人忠诚 +5。", effects: { heat: -20, fandomPct: -0.06, loyal: 5 } },
    { label: "否认并澄清", detail: "舆论 -8，粉丝 -2%。", effects: { heat: -8, fandomPct: -0.02 } },
    { label: "冷处理", detail: "两周后舆论 -25，粉丝 -10%。", effects: { heat: -25, fandomPct: -0.1 }, delay: 2 },
  ], { groupId, memberId: m?.id });
}

function sasaengEvent(g: Game, groupId: string): LiveEvent {
  return base(g, "E05", "私生饭骚扰", "舆论", "宿舍楼下又是长枪短炮。成员开始不敢走正门。", [
    { label: "报警", detail: "情绪 +5，声望 +2。", effects: { mood: 5, rep: 2 } },
    { label: "加保镖", detail: "每周固定支出 +15，情绪 +8。", effects: { mood: 8 }, special: "bodyguard" },
    { label: "让他们自己消化", detail: "情绪 -10。", effects: { mood: -10 } },
  ], { groupId });
}

function unfollowEvent(g: Game, groupId: string): LiveEvent {
  return base(g, "E16", "大规模脱粉", "舆论", "舆论热度跌破 -60，粉丝站开始关站。", [
    { label: "公开道歉", detail: "舆论 +18，粉丝再 -4%。", effects: { heat: 18, fandomPct: -0.04 } },
    { label: "用作品回应", detail: "认知 +20，舆论 +8，现金 -80。", effects: { known: 20, heat: 8, cash: -80 } },
    { label: "解散正在营业的 CP", detail: "所有官方 CP 和平解绑。", effects: { heat: 10 }, special: "clearShips" },
  ], { groupId });
}

function overseasEvent(g: Game, groupId: string): LiveEvent {
  return base(g, "E18", "海外窗口", "市场", "一个海外厂牌愿意给档期，但前期投放要公司自己扛。", [
    { label: "投入 300 万", detail: "认知 +80，声望 +10。", effects: { cash: -300, known: 80, rep: 10 } },
    { label: "放弃", detail: "没有立刻损失。", effects: {} },
  ], { groupId });
}

function leakEvent(g: Game, groupId: string, title: string): LiveEvent {
  return base(g, "E19", "MV 泄露", "作品", `${title} 的成片片段流到了网上。`, [
    { label: "提前造势", detail: "宣发系数相当于白捡一截热度，舆论 +10。", effects: { heat: 10, known: 15 } },
    { label: "照常发行", detail: "小幅舆论 -4。", effects: { heat: -4 } },
    { label: "延期重制", detail: "现金 -120，作品进度停一周的成本已经含在这笔里。", effects: { cash: -120, heat: 4 }, special: "stallWeek" },
  ], { groupId });
}

function poachEvent(g: Game, memberId: string, name: string): LiveEvent {
  return base(g, "E07", "竞品挖角", "人事", `年中的挖角季。竞品开出双倍周薪和 solo，点名要 ${name}。`, [
    { label: "匹配薪资", detail: "周薪 ×1.8，忠诚 +15。", effects: { loyal: 15 }, special: "matchSalary" },
    { label: "拒绝", detail: "60% 概率直接离开，不付违约金。", effects: {}, special: "poachGamble", danger: true },
    { label: "提前续约", detail: "合约重置 260 周，周薪 ×1.2，个人分成提到 45%，忠诚 +10。", effects: { loyal: 10 }, special: "renewEarly" },
  ], { memberId });
}

function investorEvent(g: Game): LiveEvent {
  return base(g, "E08", "投资人施压", "公司", "连续 8 周净现金流为负。投资人要求一个能写进纪要的说法。", [
    { label: "承诺接下来会盈利", detail: "若做不到，声望以后再算。本周声望 -5，获得 400 万过桥。", effects: { rep: -5, cash: 400 } },
    { label: "拒绝干预", detail: "声望 -12。", effects: { rep: -12 } },
    { label: "压缩造型预算", detail: "各团舆论热度 -6，现金 +80（本周退回一笔预付款）。", effects: { heat: -6, cash: 80 } },
  ]);
}

function awardEvent(g: Game): LiveEvent {
  return base(g, "E14", "年终提名", "市场", "颁奖季名单里有你们。哪怕不是大赏，练习室的灯都亮得久一点。", [
    { label: "全员庆祝", detail: "情绪 +15，声望 +30，花掉 40 万。", effects: { mood: 15, rep: 30, cash: -40 } },
    { label: "低调训练", detail: "声望 +15，情绪 +4。", effects: { rep: 15, mood: 4 } },
  ]);
}

function taxEvent(g: Game): LiveEvent {
  return base(g, "E15", "税务稽查", "公司", "全年进账过了税务局的线。稽查员的口吻很礼貌。", [
    { label: "补齐", detail: "支付 480 万，声望 +5。", effects: { cash: -480, rep: 5 }, special: "taxed" },
    { label: "申诉", detail: "声望 -8，仍要付 200 万。", effects: { cash: -200, rep: -8 }, special: "taxed" },
    { label: "拖延", detail: "两周后一次付 700 万，声望 -15。", effects: { cash: -700, rep: -15 }, delay: 2, special: "taxed" },
  ]);
}

function flavor(g: Game): LiveEvent {
  const roll = rng(g);
  if (roll < 0.34) {
    return base(g, "flavor-ac", "练习室空调", "公司", "空调在最热的那天罢工。成员看着你。", [
      { label: "连夜换新的", detail: "花费 20 万，情绪 +4。", effects: { cash: -20, mood: 4 } },
      { label: "再忍一周", detail: "情绪 -5。", effects: { mood: -5 } },
    ]);
  }
  if (roll < 0.67) {
    return base(g, "flavor-letter", "粉丝来信", "公司", "一箱手写信送到了前台，里面夹着一张很旧的合照。", [
      { label: "在晚会上念一段", detail: "情绪 +6，认知 +4。", effects: { mood: 6, known: 4 } },
      { label: "收进档案室", detail: "情绪 +2。", effects: { mood: 2 } },
    ]);
  }
  return base(g, "flavor-street", "街头公演提议", "公司", "宣传想周末占一个广场。没有通告费，但有人会路过。", [
    { label: "去", detail: "体力 -8，每人知名度 +6，团体认知 +8。", effects: { known: 8 }, special: "streetShow" },
    { label: "不去", detail: "把体力留给训练。", effects: {} },
  ]);
}

function worstPair(g: Game, groupId: string) {
  const group = findGroup(g, groupId);
  if (!group) return null;
  const ms = membersOf(g, groupId).filter(available);
  let best: { a: (typeof ms)[number]; b: (typeof ms)[number]; aff: number } | null = null;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const aff = getAff(group, ms[i]!.id, ms[j]!.id);
      if (!best || aff < best.aff) best = { a: ms[i]!, b: ms[j]!, aff };
    }
  }
  return best;
}

export function applyChoice(g: Game, index: number) {
  const ev = g.eventQueue[0];
  if (!ev) return;
  const opt = ev.options[index];
  if (!opt) return;
  if (opt.needAp && g.ap < opt.needAp) return;
  if (opt.needAp) g.ap -= opt.needAp;
  if (opt.delay && opt.delay > 0) {
    g.pending.push({
      week: g.week + opt.delay,
      effect: opt.effects,
      special: opt.special,
      source: ev.title,
      groupId: ev.groupId,
      memberId: ev.memberId,
      memberId2: ev.memberId2,
      shipId: ev.shipId,
    });
    if (opt.special === "coldDelay" && ev.groupId) {
      const group = findGroup(g, ev.groupId);
      const tag = "未解开的冷战";
      if (group && !group.conflicts.includes(tag)) group.conflicts.push(tag);
    }
  } else {
    applyEffect(g, opt.effects, ev);
    applySpecial(g, opt.special, ev);
  }
  g.log.unshift({ week: g.week, title: ev.title, choice: opt.label });
  if (g.lastReport) {
    g.lastReport.lines.push({
      stage: "S9",
      title: ev.title,
      delta: opt.label,
      tone: opt.danger ? "bad" : "neutral",
      detail: opt.detail,
    });
  }
  g.eventQueue.shift();
  if (g.cash < 0) {
    g.debt += -g.cash;
    g.cash = 0;
  }
}

export function applyPendingDue(g: Game, push: (line: { stage: string; title: string; delta: string; tone: "good" | "bad" | "neutral"; detail: string }) => void) {
  const due = g.pending.filter((p) => p.week === g.week);
  g.pending = g.pending.filter((p) => p.week !== g.week);
  for (const p of due) {
    const fake: LiveEvent = {
      uid: "pending",
      id: "pending",
      title: p.source,
      category: "延迟",
      text: "",
      options: [],
      groupId: p.groupId,
      memberId: p.memberId,
      memberId2: p.memberId2,
      shipId: p.shipId,
    };
    applyEffect(g, p.effect, fake);
    applySpecial(g, p.special, fake);
    push({ stage: "S9", title: `延迟后果 · ${p.source}`, delta: "结算", tone: "bad", detail: "当初的选择在这一周入账" });
  }
}

function groupsOf(g: Game, ev: { groupId?: string }) {
  if (ev.groupId) {
    const group = findGroup(g, ev.groupId);
    return group ? [group] : [];
  }
  return g.groups;
}

export function applyEffect(g: Game, e: Effect, ev: { groupId?: string; memberId?: string; memberId2?: string; shipId?: string }) {
  if (e.cash) g.cash += e.cash;
  if (e.rep) g.rep = clamp(g.rep + e.rep, 0, 1000);
  if (e.network) g.network = clamp(g.network + e.network, 0, 100);
  const gs = groupsOf(g, ev);
  for (const group of gs) {
    if (e.heat) group.heat = clamp(group.heat + e.heat, -100, 100);
    if (e.known) group.known = clamp(group.known + e.known, 0, DATA.KNOWN_CAP);
    if (e.fandomPct) group.fandom = Math.max(0, Math.round(group.fandom * (1 + e.fandomPct)));
    if (e.cohesionBuff) group.cohesionBuff = r2(group.cohesionBuff + e.cohesionBuff);
  }
  const targets = [ev.memberId, ev.memberId2].filter(Boolean) as string[];
  const members = targets.length ? targets.map((id) => findMember(g, id)).filter((m): m is NonNullable<typeof m> => !!m) : g.members.filter((m) => m.status !== "left" && (!ev.groupId || m.groupId === ev.groupId));
  for (const m of members) {
    if (e.loyal) m.loyal = clamp(m.loyal + e.loyal, 0, 100);
    if (e.mood) m.mood = clamp(m.mood + e.mood, 0, 100);
  }
  if (ev.shipId) {
    const ship = g.ships.find((s) => s.id === ev.shipId);
    if (ship) {
      if (e.shipHeat) ship.heat = clamp(ship.heat + e.shipHeat, 0, 100);
      if (e.sugar) ship.sugar = clamp(ship.sugar + e.sugar, 0, 100);
    }
  }
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export function applySpecial(g: Game, special: string | undefined, ev: LiveEvent) {
  if (!special) return;
  const m = findMember(g, ev.memberId);
  const group = findGroup(g, ev.groupId ?? m?.groupId ?? undefined);
  if (special === "militaryServe" && m) {
    m.status = "military";
    m.militaryLeft = DATA.MILITARY_WEEKS;
    m.militaryHandled = true;
    m.positions = m.positions.filter((p) => p !== "leader");
  }
  if (special === "militaryDelay" && m) m.delayMilitary = true;
  if (special === "restInjury" && m) {
    /* keep injury */
  }
  if (special === "performInjured" && m) {
    m.injuryLeft = 0;
    m.status = m.contractLeft > 0 ? "active" : "trainee";
    m.energy = 12;
  }
  if (special === "surgery" && m) m.injuryLeft = 1;
  if (special === "raiseSalary" && m) m.salary += 10;
  if (special === "talkQuit") {
    /* ap already spent */
  }
  if (special === "releasePay" && m) releaseMember(g, m.id, true);
  if (special === "mediate" && group && ev.memberId && ev.memberId2) {
    setAff(group, ev.memberId, ev.memberId2, getAff(group, ev.memberId, ev.memberId2) + 5);
    group.conflicts = group.conflicts.filter((c) => !c.includes("冷战"));
  }
  if (special === "standA" && ev.memberId && ev.memberId2) {
    const a = findMember(g, ev.memberId);
    const b = findMember(g, ev.memberId2);
    if (a) a.loyal = clamp(a.loyal + 10, 0, 100);
    if (b) b.loyal = clamp(b.loyal - 15, 0, 100);
  }
  if (special === "shareFame" && group) {
    const ms = membersOf(g, group.id).filter(available);
    const top = ms.slice().sort((a, b) => b.fame - a.fame)[0];
    if (top) top.fame = clamp(top.fame - 20, 0, DATA.FAME_CAP);
    for (const x of ms) if (x !== top) x.fame = clamp(x.fame + 15, 0, DATA.FAME_CAP);
  }
  if (special === "centerTop" && group) {
    const ms = membersOf(g, group.id).filter(available);
    const top = ms.slice().sort((a, b) => b.fame - a.fame)[0];
    if (top) {
      group.centerCd = 0;
      group.centerId = top.id;
      group.cohesionBuff = r2(group.cohesionBuff - 5);
    }
  }
  if (special === "ignoreGap" && group) {
    const ms = membersOf(g, group.id).filter(available);
    const avg = ms.reduce((s, x) => s + x.fame, 0) / Math.max(1, ms.length);
    for (const x of ms) if (x.fame < avg) x.loyal = clamp(x.loyal - 6, 0, 100);
  }
  if (special === "cutShip" && ev.shipId) {
    const ship = g.ships.find((s) => s.id === ev.shipId);
    if (ship && group) {
      group.fandom = Math.round(group.fandom * 0.85);
      setAff(group, ship.a, ship.b, getAff(group, ship.a, ship.b) - 10);
      ship.active = false;
      ship.heat = 0;
      ship.sugar = 0;
    }
  }
  if (special === "clearShips" && group) {
    for (const s of g.ships.filter((x) => x.groupId === group.id && x.active)) {
      group.fandom = Math.round(group.fandom * 0.92);
      s.active = false;
      s.heat = 0;
    }
    group.cpFans = 0;
  }
  if (special === "bodyguard") g.bodyguard = true;
  if (special === "stallWeek") {
    const p = g.projects.find((x) => x.groupId === ev.groupId && !x.released);
    if (p && p.stage !== "done") p.stageLeft += 1;
  }
  if (special === "streetShow") {
    for (const mem of g.members.filter((x) => available(x))) {
      mem.energy = clamp(mem.energy - 8, 0, mem.energyMax);
      mem.fame = clamp(mem.fame + 6, 0, DATA.FAME_CAP);
    }
  }
  if (special === "matchSalary" && m) m.salary = Math.round(m.salary * 1.8);
  if (special === "poachGamble" && m) {
    if (rng(g) < 0.6) {
      releaseMember(g, m.id, false);
      const ai = g.ai[0];
      if (ai) ai.baseMusic += 30;
    } else m.loyal = clamp(m.loyal + 5, 0, 100);
  }
  if (special === "renewEarly" && m) {
    m.contractLeft = DATA.CONTRACT_WEEKS;
    m.salary = Math.round(m.salary * 1.2);
    m.cutOverride = 0.55;
  }
  if (special === "acceptDemand" && m && group) {
    const d = ev.demand || "";
    if (d.includes("周薪")) m.salary = Math.round(m.salary * 2);
    else if (d.includes("C 位")) {
      group.centerCd = 0;
      const prev = group.centerId ? findMember(g, group.centerId) : undefined;
      if (prev && prev.id !== m.id) {
        prev.mood = clamp(prev.mood - 25, 0, 100);
        prev.loyal = clamp(prev.loyal - 8, 0, 100);
      }
      group.centerId = m.id;
      m.mood = clamp(m.mood + 15, 0, 100);
      group.centerCd = DATA.CENTER_CD;
    } else if (d.includes("solo")) m.soloDue = g.week + 26;
    else if (d.includes("分成")) m.cutOverride = 0.45;
    else m.mood = clamp(m.mood + 10, 0, 100);
    if (d.includes("分成") || d.includes("周薪")) group.renewed = true;
  }
  if (special === "partialDeal" && m) m.salary = Math.round(m.salary * 1.2);
  if (special === "refuseContract" && m) {
    if (m.loyal < 25) releaseMember(g, m.id, true);
  }
  if (special === "taxed") g.taxed = true;
}
