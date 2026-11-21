import { looksLabel } from "@/game/calc";
import { ATTRS } from "@/game/data";
import type { Attrs } from "@/game/types";

/** 外形是天生的，不参与能力排行，只有「天生丽质」才点亮。 */
const RANKED_ATTRS = ATTRS.filter((a) => a.key !== "VIS");

export function statPeaks(attr: Attrs) {
  const values = RANKED_ATTRS.map((a) => attr[a.key]);
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
        const rank =
          a.key === "VIS"
            ? looksLabel(value) === "天生丽质"
              ? "top"
              : ""
            : value === top
              ? "top"
              : second !== null && value === second
                ? "next"
                : "";
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
