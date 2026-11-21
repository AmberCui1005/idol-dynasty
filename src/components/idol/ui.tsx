import type { ReactNode } from "react";
import { fmtWan } from "@/game/util";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-surface p-4 ${className}`}>{children}</section>;
}

export function PageTitle({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <header className="mb-4">
      {kicker ? <p className="text-xs tracking-widest text-primary uppercase">{kicker}</p> : null}
      <h1 className="font-display text-3xl leading-tight text-fg">{title}</h1>
      {sub ? <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p> : null}
    </header>
  );
}

export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  const tone = ratio >= 0.7 ? "bg-good" : ratio >= 0.4 ? "bg-warn" : "bg-bad";
  return (
    <div className="meter" aria-hidden>
      <span className={tone} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" | "accent" | "good" | "warn" | "bad" }) {
  const cls =
    tone === "primary"
      ? "bg-primary text-on-primary"
      : tone === "accent"
        ? "bg-accent text-on-primary"
        : tone === "good"
          ? "bg-good text-bg"
          : tone === "warn"
            ? "bg-warn text-bg"
            : tone === "bad"
              ? "bg-bad text-on-primary"
              : "bg-surface-2 text-muted";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Btn({
  children,
  onClick,
  kind = "ghost",
  title,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger" | "accent";
  title?: string;
  type?: "button" | "submit";
}) {
  const cls =
    kind === "primary"
      ? "bg-primary text-on-primary"
      : kind === "danger"
        ? "bg-bad text-on-primary"
        : kind === "accent"
          ? "bg-accent text-on-primary"
          : "border border-border bg-surface-2 text-fg";
  return (
    <button type={type} title={title} onClick={onClick} className={`inline-flex h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold ${cls}`}>
      {children}
    </button>
  );
}

export function Soft({ label, reason, onClick, children }: { label?: string; reason: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm text-muted" title={reason}>
      {children}
      <span className="sr-only">{label || reason}</span>
    </button>
  );
}

export function Money({ n, withUnit = true }: { n: number; withUnit?: boolean }) {
  const tone = n < 0 ? "text-bad" : "text-fg";
  return (
    <span className={`tabular-nums ${tone}`}>
      {fmtWan(n)}
      {withUnit ? <span className="text-xs text-muted"> 万元</span> : null}
    </span>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="scrim fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" role="dialog" aria-modal="true">
      <div className="modal-shadow max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {onClose ? (
            <button type="button" className="text-sm text-muted" onClick={onClose}>
              关闭
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none";
