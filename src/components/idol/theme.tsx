import { useEffect, useState } from "react";

export type ThemeId = "ink" | "ice";

const KEY = "idolDynasty.theme";
const listeners = new Set<() => void>();

export function readTheme(): ThemeId {
  if (typeof document === "undefined") return "ink";
  return document.documentElement.dataset.theme === "ice" ? "ice" : "ink";
}

export function applyTheme(next: ThemeId) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "ice" ? "#F3F6FB" : "#0E0F13");
  listeners.forEach((fn) => fn());
}

export function useTheme(): [ThemeId, (next: ThemeId) => void] {
  const [theme, setTheme] = useState<ThemeId>("ink");
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      saved = null;
    }
    const next: ThemeId = saved === "ice" || saved === "ink" ? saved : readTheme();
    applyTheme(next);
    setTheme(next);
    const sub = () => setTheme(readTheme());
    listeners.add(sub);
    return () => {
      listeners.delete(sub);
    };
  }, []);
  return [theme, applyTheme];
}

export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  const options: { id: ThemeId; label: string }[] = [
    { id: "ink", label: "黑粉" },
    { id: "ice", label: "蓝白" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="界面配色">
      {options.map((op) => (
        <button
          key={op.id}
          type="button"
          aria-pressed={theme === op.id}
          onClick={() => setTheme(op.id)}
          className={`h-8 rounded-md px-2.5 text-xs font-semibold ${theme === op.id ? "bg-primary text-on-primary" : "text-muted"}`}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
