import { useMemo, useState } from "react";
import { DATA } from "@/game/data";
import { ageBand, makePool, poolSplit } from "@/game/create";
import { attrLabel, looksLabel, talentBand } from "@/game/calc";
import type { GroupType, Scout } from "@/game/types";
import { hashSeed } from "@/game/util";
import { useIdol } from "@/game/store";
import { AttrGrid } from "./attrs";
import { ThemeSwitch } from "./theme";
import { Btn, Card, Field, inputCls, Tag } from "./ui";

export function Onboard() {
  const start = useIdol((s) => s.start);
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState("灯塔娱乐");
  const [groupName, setGroupName] = useState("NOVA");
  const [type, setType] = useState<GroupType>("girl");
  const [size, setSize] = useState(5);
  const [wantTrainee, setWantTrainee] = useState(true);
  const [wantVeteran, setWantVeteran] = useState(false);
  const [traineeMin, setTraineeMin] = useState(10);
  const [traineeMax, setTraineeMax] = useState(18);
  const [veteranMin, setVeteranMin] = useState(16);
  const [veteranMax, setVeteranMax] = useState(22);
  const [seed, setSeed] = useState(20261120);
  const [pool, setPool] = useState<Scout[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  const audition = size * 3;
  const split = poolSplit(audition, wantTrainee, wantVeteran);
  const chosen = pool.filter((s) => picked.includes(s.id));
  const cost = chosen.reduce((s, m) => s + m.signCost, 0);
  const preview = useMemo(() => pool, [pool]);

  function openPool() {
    const next = hashSeed(`${company}|${groupName}|${type}|${size}|${wantTrainee}|${wantVeteran}|${traineeMin}|${traineeMax}|${veteranMin}|${veteranMax}|${Date.now()}`);
    setSeed(next);
    setPool(
      makePool(next, type, audition, {
        trainee: wantTrainee,
        veteran: wantVeteran,
        traineeMin,
        traineeMax,
        veteranMin,
        veteranMax,
      }),
    );
    setPicked([]);
    setStep(1);
  }

  function quick() {
    const ranked = pool.slice().sort((a, b) => meanAttr(b) - meanAttr(a));
    setPicked(ranked.slice(0, size).map((s) => s.id));
  }

  function toggle(id: string) {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= size) return cur;
      return [...cur, id];
    });
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.28em] text-primary">IDOL DYNASTY</p>
          <h1 className="font-display text-5xl text-fg">偶像纪元</h1>
        </div>
        <ThemeSwitch />
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted">你是经纪公司社长。一周一次结算，练得越狠就越没钱，没钱就得接烂通告，烂通告会反噬下一张专辑。</p>
      {step === 0 ? (
        <Card className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="公司名">
              <input className={inputCls} value={company} maxLength={16} onChange={(e) => setCompany(e.target.value)} />
            </Field>
            <Field label="第一支团的名字">
              <input className={inputCls} value={groupName} maxLength={16} onChange={(e) => setGroupName(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["girl", "女团"],
                ["boy", "男团"],
                ["mixed", "混合团"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setType(id)} className={`h-11 rounded-lg border text-sm font-semibold ${type === id ? "border-primary bg-primary text-on-primary" : "border-border bg-surface-2"}`}>
                {label}
              </button>
            ))}
          </div>
          <Field label={`预计出道 ${size} 人`}>
            <input className="w-full accent-primary" type="range" min={2} max={9} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </Field>
          <p className="text-xs text-muted">{size <= 3 ? "2–3 人曝光高，但一个人倒下就停摆。" : size >= 7 ? "7–9 人巡演更赚，固定成本和内斗都更高。" : "4–6 人是最稳的编制。"} 海选报名人数是计划出道的 3 倍，这一轮是 {audition} 人。开局现金 {DATA.START_CASH.toLocaleString("zh-CN")} 万元。</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={wantTrainee}
              onClick={() => {
                if (wantTrainee && !wantVeteran) return;
                setWantTrainee((v) => !v);
              }}
              className={`rounded-xl border p-3 text-left ${wantTrainee ? "border-primary bg-surface-2" : "border-border"}`}
            >
              <p className="text-sm font-semibold">素人练习生{wantTrainee ? " · 已选" : ""}</p>
              <p className="mt-1 text-xs text-muted">默认来源。10–18 岁，零基础，潜力更高，签约便宜。</p>
            </button>
            <button
              type="button"
              aria-pressed={wantVeteran}
              onClick={() => {
                if (wantVeteran && !wantTrainee) return;
                setWantVeteran((v) => !v);
              }}
              className={`rounded-xl border p-3 text-left ${wantVeteran ? "border-primary bg-surface-2" : "border-border"}`}
            >
              <p className="text-sm font-semibold">挖角熟手{wantVeteran ? " · 已选" : ""}</p>
              <p className="mt-1 text-xs text-muted">可与素人同时选。16–22 岁，只占报名人数的 20%。</p>
            </button>
          </div>
          {wantTrainee ? (
            <AgeRange label="素人年龄" min={ageBand("trainee").min} max={ageBand("trainee").max} lo={traineeMin} hi={traineeMax} onChange={(lo, hi) => { setTraineeMin(lo); setTraineeMax(hi); }} />
          ) : null}
          {wantVeteran ? (
            <AgeRange label="挖角年龄" min={ageBand("veteran").min} max={ageBand("veteran").max} lo={veteranMin} hi={veteranMax} onChange={(lo, hi) => { setVeteranMin(lo); setVeteranMax(hi); }} />
          ) : null}
          <p className="text-xs text-muted">
            {wantTrainee && wantVeteran
              ? `这一轮 ${audition} 人：素人 ${split.trainee} 人（${traineeMin}–${traineeMax} 岁），挖角 ${split.vet} 人（${veteranMin}–${veteranMax} 岁，占 20%）。`
              : wantVeteran
                ? `这一轮全是挖角，${audition} 人，年龄 ${veteranMin}–${veteranMax} 岁。`
                : `这一轮全是素人，${audition} 人，年龄 ${traineeMin}–${traineeMax} 岁。`}
            男团挖角越靠近 22 岁，兵役越近。
          </p>
          <Btn kind="primary" onClick={openPool}>
            进入海选（{audition} 人）
          </Btn>
        </Card>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Btn onClick={quick}>按能力留下 {size} 人</Btn>
            <Btn onClick={() => setStep(0)}>返回改条件</Btn>
            <span className="text-sm text-muted">
              报名 {pool.length} · 素人 {pool.filter((s) => s.track !== "veteran").length} · 挖角 {pool.filter((s) => s.track === "veteran").length} · 已选 {picked.length}/{size} · 签约金 {cost} 万元
            </span>
          </div>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="stat-top rounded-md px-1.5 py-0.5">最高</span>
            可训练能力里最强的一项
            <span className="stat-next rounded-md px-1.5 py-0.5">次高</span>
            第二强。外形是天生的，排在最左、不参与排行，只有天生丽质才会点亮。
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {preview.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} className={`rounded-xl border p-3 text-left ${on ? "border-primary bg-surface" : "border-border bg-surface"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold">
                        {s.name} <span className="text-xs text-muted">{s.gender === "f" ? "女" : "男"} · {s.age} 岁</span>
                      </p>
                      <p className="text-xs text-muted">
                        {attrLabel(s)} · {looksLabel(s.attr.VIS)} · 天赋估计 {talentBand(s.tal, false)}
                        {s.track === "veteran" ? " · 挖角熟手" : " · 素人"}
                      </p>
                    </div>
                    <Tag tone={on ? "primary" : "muted"}>{on ? "留下" : `${s.signCost} 万`}</Tag>
                  </div>
                  <AttrGrid attr={s.attr} />
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            {picked.length === size ? (
              <Btn
                kind="primary"
                onClick={() =>
                  start({
                    company,
                    groupName,
                    type,
                    seed,
                    members: chosen.map((s) => ({
                      name: s.name,
                      gender: s.gender,
                      age: s.age,
                      attr: s.attr,
                      tal: s.tal,
                      pot: s.pot,
                      amb: s.amb,
                      loyal: s.loyal,
                      examined: false,
                      signCost: s.signCost,
                      track: s.track === "veteran" ? "veteran" : "trainee",
                    })),
                  })
                }
              >
                支付 {cost} 万，开业
              </Btn>
            ) : (
              <p className="text-sm text-muted">海选要留下 {size} 人，还差 {size - picked.length} 人。签约金按可见属性算，天赋仍是区间。</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function meanAttr(s: Scout) {
  return (s.attr.VOC + s.attr.DAN + s.attr.RAP + s.attr.VIS + s.attr.VAR + s.attr.ACT + s.attr.STA) / 7;
}

function AgeRange({ label, min, max, lo, hi, onChange }: { label: string; min: number; max: number; lo: number; hi: number; onChange: (lo: number, hi: number) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block text-muted">
          {label}最小 {lo} 岁
        </span>
        <input className="w-full accent-primary" type="range" min={min} max={max} value={lo} onChange={(e) => onChange(Math.min(Number(e.target.value), hi), hi)} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">
          {label}最大 {hi} 岁
        </span>
        <input className="w-full accent-primary" type="range" min={min} max={max} value={hi} onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo))} />
      </label>
    </div>
  );
}
