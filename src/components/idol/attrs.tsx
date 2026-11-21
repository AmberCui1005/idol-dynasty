import { ATTRS } from "@/game/data";
import type { Attrs } from "@/game/types";

export function statPeaks(attr: Attrs) {
  const values = ATTRS.map((a) => attr[a.key]);
  const top = Math.max(...values);
  const lower = values.filter((v) => v < top);
  const second = lower.length ? Math.max(...lower) : null;
  return { top, second };
}

export function AttrGrid({ attr }: { attr: Attrs }) {
  const { top, second } = statPeaks(attr);
  return (
    <div className="mt-2 grid grid-cols-7 gap-1">
      {ATTRS.map((a) => {
        const value = attr[a.key];
        const rank = value === top ? "top" : second !== null && value === second ? "next" : "";
        return (
          <div key={a.key} className={`rounded-md px-0.5 py-1 text-center ${rank === "top" ? "stat-top" : rank === "next" ? "stat-next" : ""}`}>
            <p className={`text-xs ${rank === "top" ? "" : "text-muted"}`}>{a.name}</p>
            <p className="text-sm font-semibold tabular-nums">{value}</p>
          </div>
        );
      })}
    </div>
  );
}
