import { useEffect, useState } from "react";
import {
  BarChart3,
  Briefcase,
  CalendarRange,
  Flag,
  Heart,
  LayoutDashboard,
  Music,
  ScrollText,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { DATA } from "@/game/data";
import { runwayOf, warnings } from "@/game/calc";
import { yearWeek } from "@/game/util";
import type { PageId } from "@/game/store";
import { useIdol } from "@/game/store";
import { Onboard } from "./onboard";
import { Page } from "./screens";
import { Btn, Modal } from "./ui";
import { ThemeSwitch } from "./theme";

const NAV: { id: PageId; label: string; icon: typeof Users }[] = [
  { id: "overview", label: "总览", icon: LayoutDashboard },
  { id: "members", label: "成员", icon: Users },
  { id: "group", label: "团体", icon: Flag },
  { id: "schedule", label: "排程", icon: CalendarRange },
  { id: "gigs", label: "通告", icon: Briefcase },
  { id: "studio", label: "作品", icon: Music },
  { id: "market", label: "市场", icon: BarChart3 },
  { id: "cp", label: "CP", icon: Heart },
  { id: "finance", label: "财务", icon: Wallet },
  { id: "hr", label: "人事", icon: UserPlus },
  { id: "log", label: "事件", icon: ScrollText },
  { id: "settings", label: "设置", icon: Settings },
];

export function App() {
  const booted = useIdol((s) => s.booted);
  const game = useIdol((s) => s.game);
  useEffect(() => {
    useIdol.getState().boot();
  }, []);
  if (!booted) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg">
        <div>
          <p className="text-xs tracking-[0.28em] text-primary">IDOL DYNASTY</p>
          <h1 className="font-display text-4xl">偶像纪元</h1>
        </div>
      </main>
    );
  }
  if (!game) return <Onboard />;
  return <Shell />;
}

function Shell() {
  const game = useIdol((s) => s.game)!;
  const page = useIdol((s) => s.page);
  const go = useIdol((s) => s.go);
  const toast = useIdol((s) => s.toast);
  const clear = useIdol((s) => s.clearToast);
  const [more, setMore] = useState(false);
  const [ask, setAsk] = useState(false);
  const when = yearWeek(game.week);
  const run = runwayOf(game);
  const low = run.weeks !== null && run.weeks < 8;
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(clear, 3200);
    return () => window.clearTimeout(t);
  }, [toast, clear]);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="flex h-16 items-center gap-2 px-3 md:gap-4 md:px-4">
          <div className="hidden w-56 shrink-0 md:block">
            <p className="font-display text-xl leading-none">偶像纪元</p>
            <p className="text-xs tracking-[0.18em] text-muted">IDOL DYNASTY</p>
          </div>
          <button type="button" className="min-w-0 text-left" onClick={() => go("overview")} title={`本年还剩 ${52 - when.w} 周`}>
            <p className="truncate text-xs text-muted">{game.company}</p>
            <p className="truncate text-sm font-semibold">{when.label}</p>
          </button>
          <button type="button" className="shrink-0 text-left" onClick={() => go("finance")}>
            <p className="text-xs text-muted">现金</p>
            <p className={`text-sm font-semibold tabular-nums ${game.cash < 0 || game.debt > DATA.DEBT_PRESSURE ? "text-bad" : ""}`}>{Math.round(game.cash).toLocaleString("zh-CN")} 万</p>
          </button>
          <button type="button" className="hidden text-left sm:block" onClick={() => go("finance")} title={run.detail}>
            <p className="text-xs text-muted">跑道</p>
            <p className={`text-sm font-semibold ${low ? "blink text-warn" : ""}`}>{run.label}</p>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden md:block">
              <ThemeSwitch />
            </div>
            <div className="hidden items-center gap-1 md:flex" title="管理行动点，每周 2 点，不累积">
              {[0, 1].map((i) => (
                <span key={i} className={`size-2.5 rounded-full ${i < game.ap ? "bg-primary" : "bg-line"}`} />
              ))}
            </div>
            {game.phase === "play" ? (
              <Btn kind="primary" onClick={() => setAsk(true)}>
                结束本周
              </Btn>
            ) : (
              <Btn onClick={() => go("overview")}>{game.phase === "report" ? "看周报" : "有待办"}</Btn>
            )}
          </div>
        </div>
      </header>
      <div className="md:grid md:grid-cols-[15rem_1fr]">
        <nav className="hidden border-r border-border md:block">
          <ul className="sticky top-16 space-y-1 p-3">
            {NAV.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => go(item.id)} className={`flex h-11 w-full items-center gap-2 rounded-lg px-3 text-sm ${page === item.id ? "bg-surface-2 font-semibold text-fg" : "text-muted"}`}>
                  <item.icon size={16} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className="page-in min-w-0 px-3 py-4 pb-24 md:px-6 md:pb-10">
          <Page />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg md:hidden">
        {NAV.slice(0, 4).map((item) => (
          <button key={item.id} type="button" className={`flex h-16 flex-col items-center justify-center text-xs ${page === item.id ? "text-primary" : "text-muted"}`} onClick={() => go(item.id)}>
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
        <button type="button" className="flex h-16 flex-col items-center justify-center text-xs text-muted" onClick={() => setMore(true)}>
          <Settings size={18} />
          更多
        </button>
      </nav>
      {more ? (
        <Modal title="更多" onClose={() => setMore(false)}>
          <div className="mb-3">
            <p className="mb-1 text-xs text-muted">配色</p>
            <ThemeSwitch />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {NAV.slice(4).map((item) => (
              <Btn
                key={item.id}
                onClick={() => {
                  go(item.id);
                  setMore(false);
                }}
              >
                {item.label}
              </Btn>
            ))}
          </div>
        </Modal>
      ) : null}
      {ask ? <Confirm onClose={() => setAsk(false)} /> : null}
      <Blockers />
      {toast ? <p className="fixed bottom-20 left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-sm md:bottom-6">{toast}</p> : null}
    </div>
  );
}

function Confirm({ onClose }: { onClose: () => void }) {
  const game = useIdol((s) => s.game)!;
  const end = useIdol((s) => s.endWeek);
  const idle = game.members.filter((m) => m.status !== "left" && m.status !== "military" && !game.schedules[m.id]);
  const warns = warnings(game);
  return (
    <Modal title="结束本周" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">结算不可撤销。读档才能回到这一周之前。</p>
      <ul className="mb-3 space-y-1 text-sm">
        <li>{idle.length ? `${idle.length} 人未排程，将视为跳过。` : "个人行程已填满。"}</li>
        <li>{game.bids.length ? `${game.bids.length} 笔竞标将在结算时揭晓。` : "本周没有在途竞标。"}</li>
        {warns.slice(0, 3).map((w) => (
          <li key={w.text} className={w.tone === "bad" ? "text-bad" : "text-warn"}>
            {w.text}
          </li>
        ))}
      </ul>
      <Btn
        kind="primary"
        onClick={() => {
          end();
          onClose();
        }}
      >
        确认结算
      </Btn>
    </Modal>
  );
}

function Blockers() {
  const game = useIdol((s) => s.game)!;
  const pick = useIdol((s) => s.pickEvent);
  const done = useIdol((s) => s.dismissReport);
  const cut = useIdol((s) => s.doRestructure);
  if (game.phase === "restructure") {
    return (
      <Modal title="破产重组">
        <p className="mb-3 text-sm text-muted">负债已到 {DATA.BANKRUPT_DEBT.toLocaleString("zh-CN")} 万。三个选择都会把负债清零，现金回到 500 万，声望 -40。</p>
        <div className="grid gap-2">
          <Btn kind="danger" onClick={() => cut("sell")}>
            出售粉丝最高的团体
          </Btn>
          <Btn kind="danger" onClick={() => cut("cut")}>
            解约人气最高的两名成员
          </Btn>
          <Btn onClick={() => cut("keep")}>裁撤企划和 CP，留下所有人</Btn>
        </div>
      </Modal>
    );
  }
  const ev = game.eventQueue[0];
  if (game.phase === "event" && ev) {
    return (
      <Modal title={ev.title}>
        <p className="mb-1 text-xs text-muted">{ev.category}</p>
        <p className="mb-3 text-sm">{ev.text}</p>
        <div className="grid gap-2">
          {ev.options.map((op, i) => (
            <button key={op.label} type="button" onClick={() => pick(i)} className="rounded-lg border border-border bg-surface-2 px-3 py-3 text-left">
              <p className={`text-sm font-semibold ${op.danger ? "text-bad" : ""}`}>{op.label}</p>
              <p className="text-xs text-muted">{op.detail}</p>
              {op.needAp && game.ap < op.needAp ? <p className="text-xs text-warn">行动点不足，点开会提示原因</p> : null}
            </button>
          ))}
        </div>
      </Modal>
    );
  }
  if (game.phase === "report" && game.lastReport) return <Report onClose={done} />;
  return null;
}

function Report({ onClose }: { onClose: () => void }) {
  const report = useIdol((s) => s.game)!.lastReport!;
  const [n, setN] = useState(1);
  useEffect(() => {
    let i = 1;
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      if (t - last > 90) {
        last = t;
        i += 1;
        setN(i);
      }
      if (i < report.lines.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [report]);
  const shown = report.lines.slice(0, n);
  return (
    <Modal title={report.headline}>
      <div className="mb-3 flex gap-2">
        <Btn
          onClick={() => {
            setN(report.lines.length);
          }}
        >
          跳过动画
        </Btn>
        <Btn kind="primary" onClick={onClose}>
          进入下一周
        </Btn>
      </div>
      <ul className="space-y-2">
        {shown.map((line, i) => (
          <li key={`${line.title}-${i}`} className="rounded-lg border border-border px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm">
                <span className="mr-2 text-xs text-muted">{line.stage}</span>
                {line.title}
              </p>
              <p className={`text-sm font-semibold ${line.tone === "good" ? "text-good" : line.tone === "bad" ? "text-bad" : "text-muted"}`}>{line.delta}</p>
            </div>
            <p className="text-xs text-muted">{line.detail}</p>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

