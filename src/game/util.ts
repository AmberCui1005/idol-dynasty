import type { Game, Group, Member } from "./types";

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function r2(n: number) {
  return Math.round(n * 100) / 100;
}

export function rng(g: { rng: number }) {
  let a = g.rng >>> 0;
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  g.rng = a >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function uid(g: { rng: number }, prefix: string) {
  return prefix + Math.floor(rng(g) * 1e9).toString(36);
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 20261120;
}

export function yearWeek(week: number) {
  const year = Math.floor((week - 1) / 52) + 1;
  const w = ((week - 1) % 52) + 1;
  return { year, w, label: `第 ${year} 年 第 ${String(w).padStart(2, "0")} 周` };
}

export function seasonOf(week: number) {
  const { w, year } = yearWeek(week);
  return { award: w >= 49, summer: w >= 27 && w <= 35, w, year };
}

export function fmtWan(n: number) {
  const v = Math.round(n);
  const sign = v < 0 ? "-" : "";
  return sign + Math.abs(v).toLocaleString("zh-CN");
}

export function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function membersOf(g: Game, groupId: string) {
  return g.members.filter((m) => m.groupId === groupId && m.status !== "left");
}

export function available(m: Member) {
  return m.status === "trainee" || m.status === "active";
}

export function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function getAff(group: Group, a: string, b: string) {
  if (a === b) return 100;
  return group.aff[pairKey(a, b)] ?? 40;
}

export function setAff(group: Group, a: string, b: string, v: number) {
  if (a === b) return;
  group.aff[pairKey(a, b)] = clamp(r2(v), 0, 100);
}

export function findMember(g: Game, id?: string) {
  return g.members.find((m) => m.id === id);
}

export function findGroup(g: Game, id?: string) {
  return g.groups.find((x) => x.id === id);
}

export function companyCut(g: Game, group: Group) {
  if (!group.debuted || !group.debutWeek) return 1;
  const age = g.week - group.debutWeek;
  if (group.renewed) return 0.5;
  if (age <= 104) return 0.7;
  return 0.6;
}
