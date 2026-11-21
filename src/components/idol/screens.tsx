import { useState } from "react";
import { ACTIVITIES, ATTRS, BUDGETS, CP_ACTIONS, DATA, GENRES, POSITIONS, SCALES, TEAM_ACTS } from "@/game/data";
import {
  assessOffer,
  bidOutlook,
  calcGain,
  cohesionParts,
  costBreakdown,
  debutScore,
  estimateQuality,
  isBusy,
  positionNotes,
  projectBudgetTotal,
  scheduleBlock,
  talentBand,
  looksLabel,
  potBand,
  warnings,
} from "@/game/calc";
import { openTasks, surgeryReason } from "@/game/actions";
import { useIdol, type PageId } from "@/game/store";
import type { Game, Genre, Group, Scale } from "@/game/types";
import { getAff, membersOf, yearWeek } from "@/game/util";
import { AttrGrid } from "./attrs";
import { ThemeSwitch } from "./theme";
import { Btn, Card, Meter, Modal, PageTitle, Tag } from "./ui";

function useGame() {
  return useIdol((s) => s.game)!;
}
function useGroup(): Group | undefined {
  const game = useGame();
  const id = useIdol((s) => s.focusGroup);
  return game.groups.find((g) => g.id === id) ?? game.groups[0];
}

export function Page() {
  const page = useIdol((s) => s.page);
  if (page === "overview") return <Overview />;
  if (page === "members") return <Members />;
  if (page === "group") return <GroupPage />;
  if (page === "schedule") return <Schedule />;
  if (page === "gigs") return <Gigs />;
  if (page === "studio") return <Studio />;
  if (page === "market") return <Market />;
  if (page === "cp") return <Cp />;
  if (page === "finance") return <Finance />;
  if (page === "hr") return <Hr />;
  if (page === "log") return <Log />;
  return <Settings />;
}

function GroupSwitch() {
  const game = useGame();
  const id = useIdol((s) => s.focusGroup);
  const set = useIdol((s) => s.setFocusGroup);
  if (game.groups.length < 2) return null;
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto">
      {game.groups.map((g) => (
        <button key={g.id} type="button" onClick={() => set(g.id)} className={`h-10 shrink-0 rounded-lg px-3 text-sm ${g.id === id ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}>
          {g.name}
        </button>
      ))}
    </div>
  );
}

function Overview() {
  const game = useGame();
  const go = useIdol((s) => s.go);
  const warns = warnings(game);
  const tasks = openTasks(game);
  const when = yearWeek(game.week);
  return (
    <div>
      <PageTitle kicker={game.company} title={when.label} sub="先看警告，再排程，再去抢通告。结束本周是唯一让时间前进的按钮。" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">声望</p>
          <p className="text-2xl font-semibold tabular-nums">{Math.round(game.rep)}</p>
          <Meter value={game.rep} max={1000} />
        </Card>
        <Card>
          <p className="text-xs text-muted">负债</p>
          <p className={`text-2xl font-semibold tabular-nums ${game.debt > 0 ? "text-bad" : ""}`}>{Math.round(game.debt)}</p>
          <p className="text-xs text-muted">万元 · 周息 2%</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">行动点</p>
          <p className="text-2xl font-semibold">
            {game.ap} / {DATA.AP}
          </p>
          <p className="text-xs text-muted">面谈、考察、公关、人脉</p>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-base font-semibold">本周要做的事</h2>
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li key={t.text}>
                <button type="button" className="flex w-full items-center justify-between gap-3 text-left text-sm" onClick={() => go(t.page as PageId)}>
                  <span className={t.done ? "text-muted line-through" : ""}>{t.text}</span>
                  <Tag tone={t.done ? "good" : "primary"}>{t.done ? "完成" : "去处理"}</Tag>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 text-base font-semibold">警告</h2>
          {warns.length === 0 ? <p className="text-sm text-muted">这周没有红灯。不代表下周也没有。</p> : null}
          <ul className="space-y-2">
            {warns.map((w) => (
              <li key={w.text} className={`text-sm ${w.tone === "bad" ? "text-bad" : "text-warn"}`}>
                {w.text}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {game.groups.map((g) => {
          const c = cohesionParts(game, g);
          const rank = game.charts.music.findIndex((r) => r.id === g.id);
          return (
            <Card key={g.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{g.name}</h3>
                  <p className="text-xs text-muted">{g.debuted ? "已出道" : "练习生团"} · {g.type === "girl" ? "女团" : g.type === "boy" ? "男团" : "混合团"}</p>
                </div>
                <Tag tone={rank >= 0 && rank < 3 ? "primary" : "muted"}>{rank >= 0 ? `音源第 ${rank + 1}` : "未入榜"}</Tag>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">认知</dt>
                  <dd className="tabular-nums">{Math.round(g.known)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">粉丝</dt>
                  <dd className="tabular-nums">{Math.round(g.fandom)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">凝聚</dt>
                  <dd className="tabular-nums">{c.value.toFixed(0)}</dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Members() {
  const game = useGame();
  const focus = useIdol((s) => s.focusMember);
  const setFocus = useIdol((s) => s.setFocusMember);
  const talk = useIdol((s) => s.ap);
  const operate = useIdol((s) => s.surgery);
  const [ask, setAsk] = useState(false);
  const list = game.members.filter((m) => m.status !== "left");
  const m = list.find((x) => x.id === focus) ?? list[0];
  const why = m ? surgeryReason(game, m) : "没有成员";
  const born = m ? (m.visBorn ?? m.attr.VIS) : 0;
  const cap = Math.min(97, born + DATA.SURGERY_CAP);
  return (
    <div>
      <PageTitle kicker="名册" title="成员" sub="唱跳可以练。外形是天生的，整容最多加一点，也有毁容的可能。" />
      <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((mem) => (
            <button key={mem.id} type="button" onClick={() => setFocus(mem.id)} className={`rounded-xl border p-3 text-left ${m?.id === mem.id ? "border-primary bg-surface" : "border-border bg-surface"}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">
                  {mem.name} <span className="text-xs text-muted">{mem.gender === "f" ? "女" : "男"} · {mem.age.toFixed(1)} 岁</span>
                </p>
                <Tag tone={mem.disfigured ? "bad" : mem.status === "injured" ? "bad" : mem.status === "military" ? "warn" : mem.status === "active" ? "primary" : "muted"}>
                  {mem.disfigured ? "毁容" : statusName(mem.status)}
                </Tag>
              </div>
              <p className="mt-1 text-xs text-muted">
                {looksLabel(mem.attr.VIS)} · 外形 {Math.round(mem.attr.VIS)}
                {mem.positions.length ? ` · ${mem.positions.map(posName).join(" · ")}` : " · 未定定位"}
              </p>
              <div className="mt-2 space-y-1">
                <Row label="体力" value={mem.energy} max={mem.energyMax} />
                <Row label="情绪" value={mem.mood} />
                <Row label="忠诚" value={mem.loyal} />
              </div>
            </button>
          ))}
          {list.length === 0 ? <Card>名册是空的。去人事签新人。</Card> : null}
        </div>
        {m ? (
          <Card>
            <h2 className="text-xl font-semibold">{m.name}</h2>
            <p className="text-xs text-muted">
              天赋 {talentBand(m.tal, m.examined)} · 潜力上限 {potBand(m.pot, m.examined)}
            </p>
            <ul className="mt-3 space-y-2">
              {ATTRS.map((a) => (
                <li key={a.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>
                      {a.name}
                      {a.key === "VIS" ? ` · ${looksLabel(m.attr.VIS)}` : ""}
                    </span>
                    <span className="tabular-nums">{m.attr[a.key].toFixed(0)}</span>
                  </div>
                  <Meter value={m.attr[a.key]} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              天生外形 {Math.round(born)}，整容上限 {cap}。已动 {m.visOps ?? 0}/{DATA.SURGERY_MAX} 次。
              {m.disfigured ? " 毁容后封刀。" : ` 成功 +${DATA.SURGERY_GAIN}，约两成概率毁容并 -${DATA.SURGERY_DROP}。`}
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">知名度</dt>
                <dd className="tabular-nums">{Math.round(m.fame)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">周薪</dt>
                <dd className="tabular-nums">{m.status === "trainee" ? "培训 3 万" : `${m.salary} 万`}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">合约</dt>
                <dd>{m.contractLeft ? `剩 ${m.contractLeft} 周` : "练习生"}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {game.ap > 0 && m.status !== "military" ? (
                <Btn kind="primary" onClick={() => talk("talk", m.id)}>
                  面谈（1 点）
                </Btn>
              ) : (
                <Btn onClick={() => talk("talk", m.id)}>面谈</Btn>
              )}
              {why ? (
                <Btn onClick={() => operate(m.id)} title={why}>
                  整容
                </Btn>
              ) : (
                <Btn kind="danger" onClick={() => setAsk(true)}>
                  整容
                </Btn>
              )}
            </div>
          </Card>
        ) : null}
      </div>
      {ask && m ? (
        <Modal title={`给 ${m.name} 整容`} onClose={() => setAsk(false)}>
          <p className="mb-3 text-sm">
            花费 {DATA.SURGERY_COST} 万。成功外形 +{DATA.SURGERY_GAIN}，但不会超过天生值 +{DATA.SURGERY_CAP}（这次上限 {cap}）。大约两成概率毁容，外形 -{DATA.SURGERY_DROP}，并且以后不能再动。术后休养 {DATA.SURGERY_REST} 周。
          </p>
          <Btn
            kind="danger"
            onClick={() => {
              operate(m.id);
              setAsk(false);
            }}
          >
            确认上手术台
          </Btn>
        </Modal>
      ) : null}
    </div>
  );
}

function Row({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.round(value)}
          {max !== 100 ? `/${Math.round(max)}` : ""}
        </span>
      </div>
      <Meter value={value} max={max} />
    </div>
  );
}

function GroupPage() {
  const game = useGame();
  const group = useGroup();
  const setPos = useIdol((s) => s.position);
  const setCenter = useIdol((s) => s.center);
  const debut = useIdol((s) => s.debut);
  if (!group) return <PageTitle title="还没有团体" sub="在人事页把练习生编成新团。" />;
  const ms = membersOf(game, group.id);
  const c = cohesionParts(game, group);
  const mods = positionNotes(ms);
  const score = group.debuted ? null : debutScore(game, group);
  return (
    <div>
      <GroupSwitch />
      <PageTitle kicker="编制" title={group.name} sub={group.debuted ? `出道于 ${group.debutWeek ? yearWeek(group.debutWeek).label : ""}` : "练习生期没有底薪，也没有榜。"} />
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">凝聚力 {c.value.toFixed(0)}</p>
          <p className="text-xs text-muted">好感 {c.avg} · 队长 {c.leaderScore} · 团活 {c.team} · 基尼扣 {c.giniPen} · C位 {c.center}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">舆论 {Math.round(group.heat)}</p>
          <Meter value={group.heat + 100} max={200} />
        </Card>
        <Card>
          <p className="text-xs text-muted">粉丝结构</p>
          <p className="text-xs">路人 {(group.layers.casual * 100).toFixed(0)}% · 一般 {(group.layers.regular * 100).toFixed(0)}% · 核心 {(group.layers.core * 100).toFixed(0)}% · 死忠 {(group.layers.hardcore * 100).toFixed(0)}%</p>
        </Card>
      </div>
      {mods.miss.length ? <p className="mb-3 text-sm text-warn">{mods.miss.join("；")}</p> : null}
      <Card className="mb-3">
        <h2 className="mb-2 font-semibold">定位</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {POSITIONS.map((p) => {
            const holder = ms.find((m) => m.positions.includes(p.id));
            const low = holder && p.attr && p.min ? holder.attr[p.attr] < p.min : holder && p.loyal ? holder.loyal < p.loyal : false;
            return (
              <label key={p.id} className="text-sm">
                <span className="mb-1 flex items-center justify-between">
                  <span>
                    {p.name}
                    {p.unique ? "" : " · 可多名"}
                  </span>
                  {low ? <Tag tone="bad">未达门槛</Tag> : null}
                </span>
                <select
                  className="h-11 w-full rounded-lg border border-border bg-bg px-2"
                  value={holder?.id ?? ""}
                  onChange={(e) => setPos(group.id, p.id, e.target.value || null)}
                >
                  <option value="">空缺 · {p.miss}</option>
                  {ms.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {p.attr ? m.attr[p.attr] : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">{p.good}</p>
              </label>
            );
          })}
        </div>
      </Card>
      <Card className="mb-3">
        <h2 className="mb-2 font-semibold">C 位</h2>
        <p className="mb-2 text-xs text-muted">人气增速 +30%，舞台 +6，本人情绪每周 +5。换人有 8 周冷却，旧 C 位情绪 -25、忠诚 -8。</p>
        <select className="h-11 w-full rounded-lg border border-border bg-bg px-2" value={group.centerId ?? ""} onChange={(e) => setCenter(group.id, e.target.value || null)}>
          <option value="">留空（首周曝光 -15%）</option>
          {ms.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · 知名度 {Math.round(m.fame)}
            </option>
          ))}
        </select>
        {group.centerCd > 0 ? <p className="mt-2 text-xs text-warn">更换冷却 {group.centerCd} 周。点选其他人会提示原因。</p> : null}
      </Card>
      {!group.debuted && score ? (
        <Card>
          <h2 className="font-semibold">出道评估 {score.score}</h2>
          <p className="text-sm text-muted">{score.formula}</p>
          <p className="mt-1 text-sm">
            {score.tier} · 初始认知 {score.known} · 粉丝 {score.fandom}
          </p>
          <p className="text-xs text-muted">{score.note}</p>
          <div className="mt-3">
            {game.cash >= DATA.DEBUT_FEE ? (
              <Btn kind="primary" onClick={() => debut(group.id)}>
                支付 {DATA.DEBUT_FEE} 万出道
              </Btn>
            ) : (
              <Btn onClick={() => debut(group.id)}>现金不够出道</Btn>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Schedule() {
  const game = useGame();
  const group = useGroup();
  const setS = useIdol((s) => s.schedule);
  const setT = useIdol((s) => s.team);
  const tpl = useIdol((s) => s.template);
  if (!group) return <PageTitle title="没有团体" />;
  const ms = membersOf(game, group.id).filter((m) => m.status !== "left");
  return (
    <div>
      <GroupSwitch />
      <PageTitle kicker="本周" title="排程" sub="每人一个个人槽，每团一个团队槽。置灰的选项点开能看到原因。" />
      <div className="mb-3 flex flex-wrap gap-2">
        <Btn onClick={() => tpl(group.id, "vocal")}>全员声乐</Btn>
        <Btn onClick={() => tpl(group.id, "rest")}>全员休息</Btn>
        <Btn onClick={() => tpl(group.id, "balance")}>均衡训练</Btn>
        <Btn onClick={() => tpl(group.id, "clear")}>全部跳过</Btn>
      </div>
      <Card className="mb-3">
        <p className="mb-2 text-sm font-semibold">团队槽 · {group.name}</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TEAM_ACTS).map(([id, def]) => {
            const blocked = game.gigs.some((gig) => gig.groupId === group.id && gig.blocksTeam);
            const on = (game.teamSchedules[group.id] || "skip") === id;
            const why = blocked && id !== "skip" ? "团体档期被通告占用，本周团活做不了" : "";
            return (
              <button
                key={id}
                type="button"
                title={why || def.hint}
                onClick={() => setT(group.id, id)}
                className={`h-11 rounded-lg px-3 text-sm ${why ? "border border-border text-muted" : on ? "bg-primary text-on-primary" : "bg-surface-2"}`}
              >
                {def.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">{TEAM_ACTS[game.teamSchedules[group.id] || "skip"]?.hint}</p>
      </Card>
      <div className="space-y-3">
        {ms.map((m) => (
          <Card key={m.id}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">
                {m.name} <span className="text-xs text-muted">体力 {Math.round(m.energy)} · 情绪 {Math.round(m.mood)}</span>
              </p>
              <Tag>{ACTIVITIES[game.schedules[m.id] || "skip"]?.name || "未选"}</Tag>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACTIVITIES).map(([id, def]) => {
                const why = scheduleBlock(game, m, id);
                const on = (game.schedules[m.id] || "") === id;
                if (why) {
                  return (
                    <button key={id} type="button" onClick={() => setS(m.id, id)} className="h-10 rounded-lg border border-border px-2 text-xs text-muted" title={why}>
                      {def.name}
                    </button>
                  );
                }
                return (
                  <button key={id} type="button" onClick={() => setS(m.id, id)} className={`h-10 rounded-lg px-2 text-xs ${on ? "bg-primary text-on-primary" : "bg-surface-2"}`}>
                    {def.name}
                  </button>
                );
              })}
            </div>
            <Preview mId={m.id} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function Preview({ mId }: { mId: string }) {
  const game = useGame();
  const m = game.members.find((x) => x.id === mId);
  const act = game.schedules[mId];
  if (!m || !act) return <p className="mt-2 text-xs text-muted">还没选行程。结束本周时会当成跳过。</p>;
  const def = ACTIVITIES[act];
  if (!def?.attr) return <p className="mt-2 text-xs text-muted">{def?.hint}</p>;
  const res = calcGain(m.attr[def.attr], m.tal, m.energy, m.mood, game.coach, m.pot);
  const low = res.gain * 0.85;
  const high = res.gain;
  return (
    <p className="mt-2 text-xs text-muted">
      体力 {def.energy} · 情绪 {def.mood} · {def.attr} 大约 +{low.toFixed(1)} 至 +{high.toFixed(1)}。{res.reason}
    </p>
  );
}

function Gigs() {
  const game = useGame();
  const group = useGroup();
  const bid = useIdol((s) => s.bid);
  const unbid = useIdol((s) => s.unbid);
  const [quote, setQuote] = useState(1);
  const [memberId, setMemberId] = useState("");
  if (!group) return <PageTitle title="没有团体" />;
  const ms = membersOf(game, group.id).filter((m) => m.status === "trainee" || m.status === "active");
  return (
    <div>
      <GroupSwitch />
      <PageTitle kicker="市场" title="通告" sub="报价只影响中标把握，不改变报酬。保证金是报酬的 10%，落标全退。" />
      {game.bids.length ? (
        <Card className="mb-3">
          <h2 className="mb-2 text-sm font-semibold">待揭晓</h2>
          {game.bids.map((b) => {
            const offer = game.offers.find((o) => o.id === b.offerId);
            return (
              <div key={b.id} className="mb-2 flex items-center justify-between gap-2 text-sm">
                <span>
                  {offer?.title} · 报价 {Math.round(b.quote * 100)}%
                </span>
                <Btn onClick={() => unbid(b.id)}>撤回并退保证金</Btn>
              </div>
            );
          })}
        </Card>
      ) : null}
      {game.gigs.length ? (
        <Card className="mb-3">
          <h2 className="mb-2 text-sm font-semibold">履约中</h2>
          {game.gigs.map((gig) => (
            <p key={gig.id} className="text-sm">
              {gig.title} · 剩 {gig.left} 周 · 每周约 {gig.payPerWeek} 万
            </p>
          ))}
        </Card>
      ) : null}
      <div className="mb-3">
        <label className="text-xs text-muted">报价 {Math.round(quote * 100)}%（把握看方向，不显示精确概率）</label>
        <input className="w-full accent-primary" type="range" min={80} max={130} value={Math.round(quote * 100)} onChange={(e) => setQuote(Number(e.target.value) / 100)} />
      </div>
      <div className="grid gap-3">
        {game.offers.map((offer) => {
          const ids = offer.scope === "member" ? (memberId ? [memberId] : ms[0] ? [ms[0].id] : []) : ms.filter((m) => !isBusy(game, m.id)).map((m) => m.id);
          const gate = assessOffer(game, offer, group, ids);
          const out = bidOutlook(game, offer, group, quote);
          const mine = game.bids.find((b) => b.offerId === offer.id);
          return (
            <Card key={offer.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{offer.title}</h3>
                  <p className="text-xs text-muted">
                    {offer.weeks} 周 · 报酬 {offer.pay} 万 · 曝光 {offer.exposure} · 竞品 {offer.aiName}
                  </p>
                </div>
                <Tag tone={gate.status === "ok" ? "good" : gate.status === "close" ? "warn" : "bad"}>{gate.status === "ok" ? "可接" : gate.status === "close" ? "勉强" : "不可接"}</Tag>
              </div>
              <p className="mt-1 text-xs text-muted">{gate.reasons.join("；")}</p>
              <p className="text-xs text-muted">
                把握{out.band}。短板在{out.weak}。保证金 {Math.max(1, Math.round(offer.pay * 0.1))} 万。
              </p>
              {offer.scope === "member" ? (
                <select className="mt-2 h-11 w-full rounded-lg border border-border bg-bg px-2 text-sm" value={memberId || ms[0]?.id || ""} onChange={(e) => setMemberId(e.target.value)}>
                  {ms.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {isBusy(game, m.id) ? "（已占用）" : ""}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="mt-2">
                {mine ? (
                  <Tag>已出价</Tag>
                ) : gate.status === "no" ? (
                  <button type="button" title={gate.reasons.join("；")} onClick={() => bid(offer.id, group.id, ids, quote)} className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-3 text-sm text-muted">
                    出价
                  </button>
                ) : (
                  <Btn kind="primary" onClick={() => bid(offer.id, group.id, ids, quote)}>
                    出价
                  </Btn>
                )}
              </div>
            </Card>
          );
        })}
        {game.offers.length === 0 ? <Card>本周没有通告。可以花 1 点行动点去人事页开拓人脉。</Card> : null}
      </div>
    </div>
  );
}

function Studio() {
  const game = useGame();
  const group = useGroup();
  const start = useIdol((s) => s.project);
  const [scale, setScale] = useState<Scale>("single");
  const [genre, setGenre] = useState<Genre>("pop");
  const [tier, setTier] = useState<0 | 1 | 2 | 3>(1);
  if (!group) return <PageTitle title="没有团体" />;
  const active = game.projects.filter((p) => p.groupId === group.id);
  const est = group.debuted ? estimateQuality(game, group, { genre, budgetTier: tier }) : null;
  return (
    <div>
      <GroupSwitch />
      <PageTitle kicker="工作室" title="作品" sub="五个阶段不能跳。钱不够就停在原地，已经花掉的不退。" />
      {active.map((p) => (
        <Card key={p.id} className="mb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{p.title || "未命名"}</h3>
            <Tag tone={p.failed ? "bad" : p.released ? "good" : p.stalled ? "warn" : "primary"}>{p.released ? `质量 ${p.q}` : p.stalled ? "停滞" : stageLabel(p.stage)}</Tag>
          </div>
          <p className="text-xs text-muted">
            {SCALES[p.scale].name} · {GENRES[p.genre].name} · 已投入 {p.spent} 万
            {p.released ? ` · 音源指数 ${Math.round(p.music)} · 销量进度 ${p.saleIdx}/${p.sales.length}` : ` · 本阶段还剩 ${p.stageLeft} 周`}
          </p>
          {!p.released ? <Meter value={stageIndex(p.stage)} max={5} /> : null}
        </Card>
      ))}
      <Card>
        <h2 className="mb-2 font-semibold">新立项</h2>
        <div className="mb-2 flex flex-wrap gap-2">
          {(Object.keys(SCALES) as Scale[]).map((s) => (
            <button key={s} type="button" onClick={() => setScale(s)} className={`h-10 rounded-lg px-3 text-sm ${scale === s ? "bg-primary text-on-primary" : "bg-surface-2"}`}>
              {SCALES[s].name}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          {(Object.keys(GENRES) as Genre[]).map((s) => (
            <button key={s} type="button" onClick={() => setGenre(s)} className={`h-10 rounded-lg px-3 text-sm ${genre === s ? "bg-accent text-on-primary" : "bg-surface-2"}`}>
              {GENRES[s].name}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          {BUDGETS.map((b) => (
            <button key={b.tier} type="button" onClick={() => setTier(b.tier)} className={`h-10 rounded-lg px-3 text-sm ${tier === b.tier ? "bg-primary text-on-primary" : "bg-surface-2"}`}>
              {b.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">预算合计约 {projectBudgetTotal(scale, tier)} 万。{est ? `以现在的人估算质量 ${est.q}。${est.detail}` : "出道后才能立项。"}</p>
        <div className="mt-3">
          <Btn kind="primary" onClick={() => start(group.id, scale, genre, tier)}>
            立项
          </Btn>
        </div>
      </Card>
    </div>
  );
}

function Market() {
  const game = useGame();
  const [tab, setTab] = useState<"music" | "sales" | "topic" | "rookie">("music");
  const names = { music: "音源榜", sales: "销量榜", topic: "话题榜", rookie: "新人榜" };
  const rows = game.charts[tab];
  return (
    <div>
      <PageTitle kicker="情报" title="四张榜" sub="玩家和 8 支竞品同表。你没法四张榜同时第一。" />
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(names) as (keyof typeof names)[]).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`h-10 rounded-lg px-3 text-sm ${tab === k ? "bg-primary text-on-primary" : "bg-surface-2"}`}>
            {names[k]}
          </button>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? <p className="text-sm text-muted">结算一周之后才会有排名。</p> : null}
        <ol className="space-y-2">
          {rows.map((row, i) => {
            const arrow = row.prev ? (row.prev > i + 1 ? "↑" : row.prev < i + 1 ? "↓" : "·") : "新";
            return (
              <li key={row.id} className={`flex items-center justify-between rounded-lg px-2 py-2 ${row.player ? "bg-surface-2" : ""}`}>
                <span className="text-sm">
                  <span className="mr-2 tabular-nums text-muted">{i + 1}</span>
                  {row.name}
                  {row.player ? <span className="ml-2 text-xs text-primary">你的团</span> : null}
                </span>
                <span className="text-sm tabular-nums">
                  {arrow} {row.score}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>
      <Card className="mt-3">
        <h2 className="mb-2 text-sm font-semibold">竞品</h2>
        {game.ai.map((ai) => (
          <p key={ai.id} className="text-sm text-muted">
            {ai.name} · 粉丝 {ai.fandom} · {ai.momentum ? "大势" : `${ai.comebackIn} 周后回归`}
          </p>
        ))}
      </Card>
    </div>
  );
}

function Cp() {
  const game = useGame();
  const group = useGroup();
  const make = useIdol((s) => s.ship);
  const biz = useIdol((s) => s.biz);
  const unbiz = useIdol((s) => s.unbiz);
  const cut = useIdol((s) => s.unbind);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [ask, setAsk] = useState<string | null>(null);
  if (!group) return <PageTitle title="没有团体" />;
  const ms = membersOf(game, group.id);
  const ships = game.ships.filter((s) => s.groupId === group.id && s.active).sort((x, y) => y.heat - x.heat);
  const pairs: { a: string; b: string; aff: number }[] = [];
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) pairs.push({ a: ms[i]!.id, b: ms[j]!.id, aff: getAff(group, ms[i]!.id, ms[j]!.id) });
  pairs.sort((x, y) => x.aff - y.aff);
  return (
    <div>
      <GroupSwitch />
      <PageTitle kicker="关系" title="CP 中心" sub="热度是杠杆，糖精是利息。糖精过 85 会炸。" />
      <Card className="mb-3">
        <h2 className="mb-2 text-sm font-semibold">好感最低的几对</h2>
        {pairs.slice(0, 6).map((p) => {
          const na = ms.find((m) => m.id === p.a)?.name;
          const nb = ms.find((m) => m.id === p.b)?.name;
          return (
            <p key={p.a + p.b} className="text-sm">
              {na} / {nb} · 好感 {Math.round(p.aff)}
            </p>
          );
        })}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className="h-11 rounded-lg border border-border bg-bg px-2" value={a} onChange={(e) => setA(e.target.value)}>
            <option value="">成员 A</option>
            {ms.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select className="h-11 rounded-lg border border-border bg-bg px-2" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">成员 B</option>
            {ms.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <Btn kind="accent" onClick={() => a && b && make(group.id, a, b)}>
            组建官方 CP
          </Btn>
        </div>
      </Card>
      {ships.map((s) => {
        const na = game.members.find((m) => m.id === s.a)?.name;
        const nb = game.members.find((m) => m.id === s.b)?.name;
        const aff = getAff(group, s.a, s.b);
        const lamp = s.sugar >= 85 || (s.heat > 70 && aff < 40) ? "bad" : s.sugar >= 60 || s.heat >= 61 ? "warn" : "good";
        return (
          <Card key={s.id} className="mb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {na} × {nb}
              </h3>
              <Tag tone={lamp}>{lamp === "good" ? "安全" : lamp === "warn" ? "警戒" : "危险"}</Tag>
            </div>
            <p className="text-xs text-muted">
              成立 {s.weeks} 周 · 好感 {Math.round(aff)} {s.secondary ? "· 第二对，热度增长按 60%" : ""}
            </p>
            <div className="mt-2">
              <p className="text-xs text-muted">热度 {Math.round(s.heat)}</p>
              <Meter value={s.heat} />
              <p className="mt-1 text-xs text-muted">糖精 {Math.round(s.sugar)}</p>
              <Meter value={s.sugar} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {CP_ACTIONS.map((act) => {
                const cd = s.cd[act.id] ?? 0;
                if (cd > 0 || s.planned) {
                  return (
                    <Btn key={act.id} onClick={() => biz(s.id, act.id)}>
                      {act.name}
                      {cd > 0 ? ` ${cd} 周` : ""}
                    </Btn>
                  );
                }
                return (
                  <Btn key={act.id} kind="accent" onClick={() => biz(s.id, act.id)}>
                    {act.name} · {act.cost} 万
                  </Btn>
                );
              })}
            </div>
            {s.planned ? (
              <div className="mt-2">
                <Btn onClick={() => unbiz(s.id)}>取消本周营业并退款</Btn>
              </div>
            ) : null}
            <div className="mt-2 flex gap-2">
              <Btn
                onClick={() => {
                  if (ask === s.id + "peace") cut(s.id, "peace");
                  else setAsk(s.id + "peace");
                }}
              >
                {ask === s.id + "peace" ? "确认和平解绑 · 粉丝 -8%" : "和平解绑"}
              </Btn>
              <Btn
                kind="danger"
                onClick={() => {
                  if (ask === s.id + "cut") cut(s.id, "cut");
                  else setAsk(s.id + "cut");
                }}
              >
                {ask === s.id + "cut" ? "确认切割 · 粉丝 -15%" : "强行切割"}
              </Btn>
            </div>
          </Card>
        );
      })}
      {ships.length === 0 ? <p className="text-sm text-muted">还没有 CP。好感低于 25 也能硬组，但糖精会先涨。</p> : null}
    </div>
  );
}

function Finance() {
  const game = useGame();
  const coach = useIdol((s) => s.coach);
  const loan = useIdol((s) => s.loan);
  const rows = costBreakdown(game);
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div>
      <PageTitle kicker="账本" title="财务" sub="收入先入账，再扣成本，最后计息。单位一律是万元。" />
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">现金</p>
          <p className="text-2xl font-semibold tabular-nums">{Math.round(game.cash).toLocaleString("zh-CN")}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">负债</p>
          <p className="text-2xl font-semibold tabular-nums text-bad">{Math.round(game.debt).toLocaleString("zh-CN")}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">累计进账</p>
          <p className="text-2xl font-semibold tabular-nums">{Math.round(game.lifetimeIncome).toLocaleString("zh-CN")}</p>
        </Card>
      </div>
      <Card className="mb-3">
        <h2 className="mb-2 text-sm font-semibold">近几周净现金流</h2>
        {game.nets.length === 0 ? <p className="text-sm text-muted">结算之后这里会出现柱。</p> : null}
        <div className="flex h-28 items-end gap-2">
          {game.nets.map((n, i) => {
            const max = Math.max(1, ...game.nets.map((x) => Math.abs(x)));
            const h = Math.max(8, (Math.abs(n) / max) * 100);
            return <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${n} 万`}>
              <div className={`w-full rounded-md ${n >= 0 ? "bg-good" : "bg-bad"}`} style={{ height: `${h}%` }} />
            </div>;
          })}
        </div>
      </Card>
      <Card className="mb-3">
        <h2 className="mb-2 text-sm font-semibold">本周若结算，固定支出约 {sum} 万</h2>
        {rows.map((r) => (
          <p key={r.label} className="flex justify-between text-sm">
            <span>{r.label}</span>
            <span className="tabular-nums">{r.amount} 万</span>
          </p>
        ))}
      </Card>
      <Card className="mb-3">
        <h2 className="mb-2 text-sm font-semibold">教练</h2>
        <div className="flex flex-wrap gap-2">
          <Btn kind={game.coach === "basic" ? "primary" : "ghost"} onClick={() => coach("basic")}>
            基础 · 免费
          </Btn>
          <Btn kind={game.coach === "mid" ? "primary" : "ghost"} onClick={() => coach("mid")}>
            中级 · 8 万
          </Btn>
          <Btn kind={game.coach === "high" ? "primary" : "ghost"} onClick={() => coach("high")}>
            高级 · 25 万
          </Btn>
        </div>
        <p className="mt-2 text-xs text-muted">成长公式里的教练系数：1 / 1.25 / 1.5。高级教练还会把作品质量乘 1.10。</p>
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold">贷款</h2>
        <div className="flex flex-wrap gap-2">
          {[500, 1000, 2000].map((n) => (
            <Btn key={n} onClick={() => loan(n)}>
              借入 {n} 万
            </Btn>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">超过 5000 万，通告收入 -20%。超过 12000 万进入重组。</p>
      </Card>
    </div>
  );
}

function Hr() {
  const game = useGame();
  const sign = useIdol((s) => s.sign);
  const look = useIdol((s) => s.ap);
  const assign = useIdol((s) => s.assign);
  const found = useIdol((s) => s.found);
  const [ids, setIds] = useState<string[]>([]);
  const [name, setName] = useState("第二组");
  const free = game.members.filter((m) => !m.groupId && m.status === "trainee");
  return (
    <div>
      <PageTitle kicker="人事" title="星探与合约" sub="每周带回 10–18 岁练习生，两周后离开。开局海选才能挖 16–22 岁的熟手。考察花 1 点行动点。" />
      <div className="mb-3 flex flex-wrap gap-2">
        <Btn onClick={() => look("network")}>开拓人脉（1 点）</Btn>
        <Btn onClick={() => look("pr")}>紧急公关（1 点）</Btn>
        <Btn onClick={() => look("fans")}>粉丝运营 10 万（1 点）</Btn>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {game.scouts.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">
                  {s.name} <span className="text-xs text-muted">{s.gender === "f" ? "女" : "男"} · {s.age.toFixed(0)} 岁</span>
                </h3>
                <p className="text-xs text-muted">
                  天赋 {talentBand(s.tal, s.examined)} · 潜力 {potBand(s.pot, s.examined)}
                </p>
              </div>
              <Tag>{s.signCost} 万</Tag>
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted">深色是这人最高项，浅色是次高。</p>
            <AttrGrid attr={s.attr} />
            <div className="mt-2 flex gap-2">
              <Btn kind="primary" onClick={() => sign(s.id)}>
                签约
              </Btn>
              <Btn onClick={() => look("examine", s.id)}>{s.examined ? "已考察" : "考察"}</Btn>
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-3">
        <h2 className="mb-2 font-semibold">未入团的练习生</h2>
        {free.length === 0 ? <p className="text-sm text-muted">没有闲置练习生。</p> : null}
        {free.map((m) => (
          <div key={m.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{m.name}</span>
            <div className="flex gap-2">
              {game.groups
                .filter((g) => !g.debuted)
                .map((g) => (
                  <Btn key={g.id} onClick={() => assign(m.id, g.id)}>
                    加入 {g.name}
                  </Btn>
                ))}
              <button
                type="button"
                className={`h-11 rounded-lg px-3 text-sm ${ids.includes(m.id) ? "bg-primary text-on-primary" : "bg-surface-2"}`}
                onClick={() => setIds((cur) => (cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id]))}
              >
                选入新团
              </button>
            </div>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          <input className="h-11 rounded-lg border border-border bg-bg px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          <Btn kind="primary" onClick={() => found(name, "mixed", ids)}>
            用勾选的人建混合团（100 万）
          </Btn>
        </div>
      </Card>
    </div>
  );
}

function Log() {
  const game = useGame();
  return (
    <div>
      <PageTitle kicker="档案" title="事件与周报" sub="延迟后果会在到期的那一周单独入账。" />
      <div className="space-y-3">
        {game.history.map((h) => (
          <Card key={h.week}>
            <h2 className="font-semibold">{h.headline}</h2>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted">展开 {h.lines.length} 条</summary>
              <ul className="mt-2 space-y-1">
                {h.lines.map((line, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-xs text-muted">{line.stage}</span> {line.title}{" "}
                    <span className={line.tone === "good" ? "text-good" : line.tone === "bad" ? "text-bad" : "text-muted"}>{line.delta}</span>
                    <p className="text-xs text-muted">{line.detail}</p>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ))}
        {game.history.length === 0 ? <Card>还没有周报。先去排程，再结束本周。</Card> : null}
        <Card>
          <h2 className="mb-2 text-sm font-semibold">选择记录</h2>
          {game.log.slice(0, 20).map((l, i) => (
            <p key={i} className="text-sm text-muted">
              第 {l.week} 周 · {l.title}
              {l.choice ? ` · ${l.choice}` : ""}
            </p>
          ))}
        </Card>
      </div>
    </div>
  );
}

function Settings() {
  const save = useIdol((s) => s.saveNow);
  const restart = useIdol((s) => s.restart);
  const exp = useIdol((s) => s.exportText);
  const imp = useIdol((s) => s.importText);
  const game = useGame();
  const [text, setText] = useState("");
  const [sure, setSure] = useState(false);
  return (
    <div>
      <PageTitle kicker="系统" title="存档" sub="自动写在这台浏览器里。导出的文本可以自己收着。" />
      <Card className="mb-3">
        <p className="mb-2 text-sm font-semibold">配色</p>
        <ThemeSwitch />
        <p className="mt-2 text-xs text-muted">黑粉是夜间练习室，蓝白是白天办公室。随时可换，不影响存档。</p>
      </Card>
      <Card className="mb-3">
        <p className="text-sm">种子 {game.seed}</p>
        <p className="text-xs text-muted">同一份存档再结算，随机序列不会漂。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn kind="primary" onClick={save}>
            手动保存
          </Btn>
          <Btn
            onClick={() => {
              setText(exp());
            }}
          >
            导出到下方
          </Btn>
          {sure ? (
            <Btn kind="danger" onClick={restart}>
              确认弃档重开
            </Btn>
          ) : (
            <Btn
              kind="danger"
              onClick={() => setSure(true)}
            >
              弃档重开
            </Btn>
          )}
        </div>
      </Card>
      <Card>
        <textarea className="h-48 w-full rounded-lg border border-border bg-bg p-3 text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="把存档粘贴在这里" />
        <div className="mt-2">
          <Btn kind="primary" onClick={() => imp(text)}>
            导入
          </Btn>
        </div>
      </Card>
      <Card className="mt-3">
        <h2 className="mb-2 text-sm font-semibold">关键旋钮</h2>
        <p className="text-xs text-muted">成长基数 {DATA.GROWTH_BASE} · 开局现金 {DATA.START_CASH} · 出道费 {DATA.DEBUT_FEE} · 整容 {DATA.SURGERY_COST} 万 / +{DATA.SURGERY_GAIN} / 上限 +{DATA.SURGERY_CAP} / 毁容 {Math.round(DATA.SURGERY_RISK * 100)}% · 破产线 {DATA.BANKRUPT_DEBT}</p>
      </Card>
    </div>
  );
}

function statusName(s: string) {
  if (s === "trainee") return "练习生";
  if (s === "active") return "出道";
  if (s === "injured") return "伤病";
  if (s === "military") return "服役";
  return s;
}
function posName(id: string) {
  return POSITIONS.find((p) => p.id === id)?.name ?? id;
}
function stageLabel(s: string) {
  return ({ concept: "选曲", record: "录音", choreo: "编舞", mv: "MV", promo: "宣发", done: "完成" } as Record<string, string>)[s] ?? s;
}
function stageIndex(s: string) {
  return ["concept", "record", "choreo", "mv", "promo", "done"].indexOf(s) + 1;
}
