import { create } from "zustand";
import * as act from "./actions";
import { createGame } from "./create";
import { DATA } from "./data";
import { applyChoice } from "./events";
import { continueAfterEvent, settle } from "./settle";
import type { Game, Genre, GroupType, Scale, StartConfig } from "./types";

export type PageId =
  | "overview"
  | "members"
  | "group"
  | "schedule"
  | "gigs"
  | "studio"
  | "market"
  | "cp"
  | "finance"
  | "hr"
  | "log"
  | "settings";

type Result = { ok: boolean; message: string };

type Store = {
  booted: boolean;
  loaded: boolean;
  game: Game | null;
  page: PageId;
  toast: string;
  focusGroup: string;
  focusMember: string;
  boot: () => void;
  start: (cfg: StartConfig) => void;
  go: (page: PageId) => void;
  clearToast: () => void;
  run: (fn: (g: Game) => Result | void) => void;
  endWeek: () => void;
  pickEvent: (index: number) => void;
  doRestructure: (mode: "sell" | "cut" | "keep") => void;
  dismissReport: () => void;
  setFocusGroup: (id: string) => void;
  setFocusMember: (id: string) => void;
  saveNow: () => void;
  exportText: () => string;
  importText: (raw: string) => void;
  restart: () => void;
  schedule: (id: string, activity: string) => void;
  team: (id: string, activity: string) => void;
  template: (id: string, tpl: "vocal" | "rest" | "balance" | "clear") => void;
  bid: (offerId: string, groupId: string, memberIds: string[], quote: number) => void;
  unbid: (id: string) => void;
  position: (groupId: string, pos: string, memberId: string | null) => void;
  center: (groupId: string, memberId: string | null) => void;
  debut: (groupId: string) => void;
  found: (name: string, type: GroupType, ids: string[]) => void;
  sign: (id: string) => void;
  assign: (memberId: string, groupId: string) => void;
  ap: (kind: string, targetId?: string) => void;
  coach: (c: Game["coach"]) => void;
  loan: (n: number) => void;
  project: (groupId: string, scale: Scale, genre: Genre, tier: 0 | 1 | 2 | 3) => void;
  ship: (groupId: string, a: string, b: string) => void;
  biz: (shipId: string, actionId: string) => void;
  unbiz: (shipId: string) => void;
  unbind: (shipId: string, mode: "peace" | "cut") => void;
  surgery: (memberId: string) => void;
};

function valid(data: unknown): data is Game {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<Game>;
  return d.version === 1 && typeof d.seed === "number" && typeof d.rng === "number" && Array.isArray(d.members) && Array.isArray(d.groups);
}

function write(g: Game | null) {
  try {
    if (!g) localStorage.removeItem(DATA.SAVE_KEY);
    else localStorage.setItem(DATA.SAVE_KEY, JSON.stringify(g));
  } catch {
    /* ignore quota */
  }
}

export const useIdol = create<Store>((set, get) => {
  const commit = (g: Game, message?: string) => {
    write(g);
    set({
      game: g,
      toast: message || "",
      focusGroup: g.groups.some((x) => x.id === get().focusGroup) ? get().focusGroup : g.groups[0]?.id || "",
    });
  };
  const run: Store["run"] = (fn) => {
    const cur = get().game;
    if (!cur) return;
    const g = structuredClone(cur);
    const res = fn(g);
    if (res && res.ok === false) {
      set({ toast: res.message });
      return;
    }
    commit(g, res?.message);
  };
  return {
    booted: true,
  loaded: false,
    game: null,
    page: "overview",
    toast: "",
    focusGroup: "",
    focusMember: "",
    boot: () => {
      if (get().loaded) return;
      try {
        const raw = localStorage.getItem(DATA.SAVE_KEY);
        if (raw) {
          const data = JSON.parse(raw) as unknown;
          if (valid(data)) {
            set({ loaded: true, booted: true, game: data, focusGroup: data.groups[0]?.id ?? "" });
            return;
          }
        }
      } catch {
        /* fresh */
      }
      set({ loaded: true, booted: true, game: null });
    },
    start: (cfg) => {
      const g = createGame(cfg);
      commit(g, `${g.company} 开业`);
      set({ page: "overview" });
    },
    go: (page) => set({ page }),
    clearToast: () => set({ toast: "" }),
    run,
    endWeek: () => {
      const cur = get().game;
      if (!cur) return;
      const g = structuredClone(cur);
      const res = settle(g);
      if (!res.ok) {
        set({ toast: res.message });
        return;
      }
      commit(g, res.message);
    },
    pickEvent: (index) => {
      const cur = get().game;
      if (!cur) return;
      const g = structuredClone(cur);
      const before = g.eventQueue.length;
      applyChoice(g, index);
      if (g.eventQueue.length === before) {
        set({ toast: "这个选项现在做不到（通常是行动点不够）" });
        return;
      }
      continueAfterEvent(g);
      commit(g);
    },
    doRestructure: (mode) => {
      run((g) => {
        const res = act.restructure(g, mode);
        if (res.ok) continueAfterEvent(g);
        return res;
      });
    },
    dismissReport: () => {
      const cur = get().game;
      if (!cur) return;
      const g = structuredClone(cur);
      if (g.phase === "report") g.phase = "play";
      commit(g, "");
    },
    setFocusGroup: (id) => set({ focusGroup: id }),
    setFocusMember: (id) => set({ focusMember: id }),
    saveNow: () => {
      const g = get().game;
      if (!g) return;
      write(g);
      set({ toast: "已写入本地存档" });
    },
    exportText: () => (get().game ? JSON.stringify(get().game, null, 2) : ""),
    importText: (raw) => {
      try {
        const data = JSON.parse(raw) as unknown;
        if (!valid(data)) {
          set({ toast: "存档缺少 version、seed、members 或 groups，已拒绝" });
          return;
        }
        commit(data, "存档已载入");
        set({ page: "overview" });
      } catch {
        set({ toast: "这不是一份可读的存档" });
      }
    },
    restart: () => {
      write(null);
      set({ game: null, page: "overview", toast: "", focusGroup: "", focusMember: "" });
    },
    schedule: (id, activity) => run((g) => act.setSchedule(g, id, activity)),
    team: (id, activity) => run((g) => act.setTeam(g, id, activity)),
    template: (id, tpl) => run((g) => act.applyTemplate(g, id, tpl)),
    bid: (offerId, groupId, memberIds, quote) => run((g) => act.placeBid(g, offerId, groupId, memberIds, quote)),
    unbid: (id) => run((g) => act.cancelBid(g, id)),
    position: (groupId, pos, memberId) => run((g) => act.setPosition(g, groupId, pos, memberId)),
    center: (groupId, memberId) => run((g) => act.setCenter(g, groupId, memberId)),
    debut: (groupId) => run((g) => act.debut(g, groupId)),
    found: (name, type, ids) => run((g) => act.foundGroup(g, name, type, ids)),
    sign: (id) => run((g) => act.signScout(g, id)),
    assign: (memberId, groupId) => run((g) => act.assignToGroup(g, memberId, groupId)),
    ap: (kind, targetId) => run((g) => act.spendAp(g, kind, targetId)),
    coach: (c) => run((g) => act.setCoach(g, c)),
    loan: (n) => run((g) => act.takeLoan(g, n)),
    project: (groupId, scale, genre, tier) => run((g) => act.startProject(g, groupId, scale, genre, tier)),
    ship: (groupId, a, b) => run((g) => act.createShip(g, groupId, a, b)),
    biz: (shipId, actionId) => run((g) => act.planShipBiz(g, shipId, actionId)),
    unbiz: (shipId) => run((g) => act.cancelShipBiz(g, shipId)),
    unbind: (shipId, mode) => run((g) => act.unbindShip(g, shipId, mode)),
    surgery: (memberId) => run((g) => act.doSurgery(g, memberId)),
  };
});
