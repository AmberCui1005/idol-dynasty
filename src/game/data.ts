import type { AttrKey, Genre, GroupType, Scale } from "./types";

export const DATA = {
  VERSION: 1 as const,
  SAVE_KEY: "idolDynasty.v1",
  START_CASH: 8000,
  START_REP: 80,
  AP: 2,
  GROWTH_BASE: 5.5,
  GROWTH_EXP: 1.15,
  KE: [1, 0.8, 0.55] as const,
  KM: [1, 0.85, 0.6] as const,
  KC: { basic: 1, mid: 1.25, high: 1.5 } as const,
  COACH_FEE: { basic: 0, mid: 8, high: 25 } as const,
  SALARY: 25,
  SALARY_SENIOR: 35,
  TRAINEE_FEE: 3,
  VENUE: 60,
  VENUE_EXTRA: 30,
  ADMIN: 50,
  BROKER: 35,
  STYLING: 40,
  DEBUT_FEE: 200,
  INTEREST: 0.02,
  DEBT_PRESSURE: 5000,
  BANKRUPT_DEBT: 12000,
  CP_DECAY: 6,
  CP_DECAY_ACTIVE: 3,
  SUGAR_DECAY: 3,
  SUGAR_LIMIT: 85,
  SUGAR_SOFT: 60,
  CHART_Q_WEIGHT: 6,
  LOG_KEEP: 104,
  AI_COUNT: 8,
  COMEBACK_GAP: 12,
  CONTRACT_WEEKS: 260,
  MILITARY_WEEKS: 78,
  CENTER_CD: 8,
  MAX_GROUPS: 4,
  MAX_SHIPS: 3,
  BID_W_QUOTE: 0.55,
  BID_W_KNOWN: 0.3,
  BID_W_REL: 0.15,
  ALBUM_UNIT: 40,
  STREAM_COEF: 0.5,
  FAME_CAP: 1000,
  KNOWN_CAP: 1000,
  SURGERY_COST: 120,
  SURGERY_GAIN: 6,
  SURGERY_CAP: 12,
  SURGERY_RISK: 0.2,
  SURGERY_DROP: 20,
  SURGERY_REST: 2,
  SURGERY_CD: 8,
  SURGERY_MAX: 2,
};

export const ATTRS: { key: AttrKey; name: string }[] = [
  { key: "VIS", name: "外形" },
  { key: "VOC", name: "唱功" },
  { key: "DAN", name: "舞蹈" },
  { key: "RAP", name: "说唱" },
  { key: "VAR", name: "综艺" },
  { key: "ACT", name: "演技" },
  { key: "STA", name: "舞台" },
];

export const ACTIVITIES: Record<
  string,
  { name: string; attr?: AttrKey; energy: number; mood: number; hint: string }
> = {
  vocal: { name: "声乐训练", attr: "VOC", energy: -12, mood: -3, hint: "唱功成长" },
  dance: { name: "舞蹈训练", attr: "DAN", energy: -12, mood: -3, hint: "舞蹈成长" },
  rap: { name: "说唱训练", attr: "RAP", energy: -12, mood: -3, hint: "说唱成长" },
  visual: { name: "形体镜头", energy: -8, mood: -1, hint: "外形是天生的，这周只熟悉机位，不改脸" },
  variety: { name: "综艺训练", attr: "VAR", energy: -9, mood: -2, hint: "综艺感成长" },
  acting: { name: "演技训练", attr: "ACT", energy: -9, mood: -2, hint: "演技成长" },
  stamina: { name: "体能训练", energy: -14, mood: -1, hint: "体力上限 +2，最高 120" },
  rest: { name: "休息", energy: 25, mood: 12, hint: "连续休息第二周情绪额外 +10" },
  channel: { name: "个人频道", energy: -6, mood: 1, hint: "综艺感 ≥ 50，周收入约 20 万" },
  skip: { name: "跳过", energy: 0, mood: -1, hint: "空出档期，情绪 -1" },
};

export const TEAM_ACTS: Record<string, { name: string; hint: string }> = {
  practice: { name: "团体练习", hint: "体力 -8，情绪 +2，凝聚力积累 +1" },
  camp: { name: "合宿", hint: "每 8 周一次，好感 +3，情绪 +20" },
  skip: { name: "跳过团活", hint: "本周不进行团体活动" },
};

export const POSITIONS: {
  id: string;
  name: string;
  unique: boolean;
  attr?: AttrKey;
  min?: number;
  loyal?: number;
  good: string;
  miss: string;
}[] = [
  { id: "leader", name: "队长", unique: true, loyal: 70, good: "凝聚力 +8，冲突概率 -20%", miss: "凝聚力 -10，冲突 +30%" },
  { id: "mainVocal", name: "主唱", unique: true, attr: "VOC", min: 70, good: "音源指数 +12%", miss: "音源指数 -15%" },
  { id: "leadVocal", name: "领唱", unique: false, attr: "VOC", min: 55, good: "音源 +4%", miss: "无" },
  { id: "mainDancer", name: "主舞", unique: true, attr: "DAN", min: 75, good: "舞台 +12%", miss: "舞台 -12%" },
  { id: "leadDancer", name: "领舞", unique: false, attr: "DAN", min: 55, good: "舞台 +4%", miss: "无" },
  { id: "mainRap", name: "主 Rapper", unique: true, attr: "RAP", min: 70, good: "音源 +6%，嘻哈额外 +15%", miss: "嘻哈音源 -10%" },
  { id: "visual", name: "门面", unique: true, attr: "VIS", min: 75, good: "首周曝光 +20%", miss: "首周曝光 -10%" },
  { id: "maknae", name: "忙内", unique: true, good: "粉丝好感 +5%，负面冲击 -10%", miss: "无" },
  { id: "variety", name: "综艺担当", unique: false, attr: "VAR", min: 60, good: "综艺通告 +15%", miss: "综艺收益 -5%" },
  { id: "mood", name: "气氛担当", unique: false, good: "全员情绪每周 +3", miss: "无" },
];

export const BUDGETS: { tier: 0 | 1 | 2 | 3; name: string; coef: number; cost: number; promo: number }[] = [
  { tier: 0, name: "节俭", coef: 0.9, cost: 0.8, promo: 0.85 },
  { tier: 1, name: "标准", coef: 1, cost: 1, promo: 1.05 },
  { tier: 2, name: "豪华", coef: 1.15, cost: 1.45, promo: 1.2 },
  { tier: 3, name: "顶配", coef: 1.25, cost: 1.8, promo: 1.35 },
];

export const SCALES: Record<Scale, { name: string }> = {
  single: { name: "单曲" },
  mini: { name: "迷你专辑" },
  full: { name: "正规专辑" },
};

export const GENRES: Record<Genre, { name: string }> = {
  pop: { name: "流行" },
  hiphop: { name: "嘻哈" },
  ballad: { name: "抒情" },
  dance: { name: "舞曲" },
  rnb: { name: "R&B" },
};

export const STAGE_WEEKS: Record<string, Record<Scale, number>> = {
  concept: { single: 1, mini: 1, full: 1 },
  record: { single: 2, mini: 3, full: 4 },
  choreo: { single: 2, mini: 2, full: 2 },
  mv: { single: 1, mini: 1, full: 1 },
  promo: { single: 2, mini: 3, full: 4 },
};

export const STAGE_COST: Record<string, Record<Scale, number>> = {
  concept: { single: 100, mini: 250, full: 500 },
  record: { single: 60, mini: 180, full: 350 },
  choreo: { single: 40, mini: 80, full: 120 },
  mv: { single: 80, mini: 180, full: 300 },
  promo: { single: 50, mini: 150, full: 300 },
};

export const STAGE_NAME: Record<string, string> = {
  concept: "选曲立项",
  record: "录音制作",
  choreo: "编舞排练",
  mv: "MV 拍摄",
  promo: "宣发预热",
  done: "已发行",
};

export const STAGE_ORDER = ["concept", "record", "choreo", "mv", "promo"] as const;

export type GigDef = {
  type: string;
  name: string;
  scope: "member" | "group";
  weeks: number;
  pay: [number, number];
  exposure: number;
  energy: number;
  mood: number;
  tier: number;
  blocksTeam?: boolean;
  attr?: AttrKey;
  altAttr?: AttrKey;
  min?: number;
  known?: number;
  fandom?: number;
  charting?: boolean;
  sta?: number;
  special?: "concert" | "tour";
};

export const GIGS: GigDef[] = [
  { type: "street", name: "街区快闪", scope: "member", weeks: 1, pay: [18, 36], exposure: 28, energy: -8, mood: -2, tier: 0, attr: "VIS", min: 40 },
  { type: "traineeShow", name: "练习生公演", scope: "group", weeks: 1, pay: [24, 40], exposure: 22, energy: -10, mood: 2, tier: 0 },
  { type: "radio", name: "地方电台", scope: "member", weeks: 1, pay: [16, 30], exposure: 20, energy: -6, mood: 1, tier: 0, attr: "VAR", min: 35 },
  { type: "brand", name: "品牌站台", scope: "member", weeks: 1, pay: [40, 70], exposure: 50, energy: -6, mood: -2, tier: 0, attr: "VIS", min: 55 },
  { type: "magazine", name: "杂志画报", scope: "member", weeks: 1, pay: [20, 48], exposure: 60, energy: -8, mood: -2, tier: 1, attr: "VIS", min: 65 },
  { type: "variety", name: "综艺嘉宾", scope: "member", weeks: 1, pay: [50, 150], exposure: 80, energy: -18, mood: -8, tier: 1, attr: "VAR", min: 40 },
  { type: "music", name: "音乐节目打歌", scope: "group", weeks: 1, pay: [30, 60], exposure: 40, energy: -12, mood: -5, tier: 1, attr: "VOC", altAttr: "DAN", min: 60, charting: true },
  { type: "fansign", name: "粉丝见面会", scope: "group", weeks: 1, pay: [80, 120], exposure: 80, energy: -10, mood: 4, tier: 1, fandom: 150 },
  { type: "ost", name: "OST 演唱", scope: "member", weeks: 2, pay: [150, 220], exposure: 100, energy: -8, mood: -2, tier: 1, attr: "VOC", min: 65 },
  { type: "varietyFix", name: "综艺固定", scope: "group", weeks: 8, pay: [400, 520], exposure: 36, energy: -10, mood: -4, tier: 2, attr: "VAR", min: 55, blocksTeam: true },
  { type: "cf", name: "广告代言", scope: "group", weeks: 12, pay: [600, 2000], exposure: 24, energy: -5, mood: 1, tier: 2, attr: "VIS", min: 60, known: 200 },
  { type: "dramaSup", name: "影视配角", scope: "member", weeks: 6, pay: [300, 420], exposure: 20, energy: -12, mood: -4, tier: 2, attr: "ACT", min: 50 },
  { type: "concert", name: "演唱会", scope: "group", weeks: 2, pay: [300, 1500], exposure: 120, energy: -16, mood: -4, tier: 2, sta: 65, fandom: 300, blocksTeam: true, special: "concert" },
  { type: "dramaLead", name: "影视主角", scope: "member", weeks: 12, pay: [1000, 1400], exposure: 28, energy: -15, mood: -6, tier: 3, attr: "ACT", min: 70, known: 400 },
  { type: "tour", name: "海外巡演", scope: "group", weeks: 4, pay: [800, 3000], exposure: 100, energy: -14, mood: -5, tier: 3, known: 400, blocksTeam: true, special: "tour" },
];

export const CP_ACTIONS: { id: string; name: string; cost: number; heat: number; sugar: number; cd: number }[] = [
  { id: "variety", name: "合体综艺", cost: 80, heat: 15, sugar: 8, cd: 4 },
  { id: "photo", name: "双人写真", cost: 40, heat: 12, sugar: 10, cd: 3 },
  { id: "sns", name: "社交互动", cost: 5, heat: 6, sugar: 6, cd: 1 },
  { id: "live", name: "直播连麦", cost: 20, heat: 10, sugar: 7, cd: 2 },
  { id: "benefit", name: "粉丝福利", cost: 0, heat: 8, sugar: 12, cd: 8 },
  { id: "stage", name: "小分队舞台", cost: 100, heat: 18, sugar: 5, cd: 6 },
];

export const GIRL_NAMES = ["Sena", "Yuna", "Haerin", "Rina", "Mira", "Soyeon", "Nari", "Jiwon", "Chaewon", "Eunbi", "Harin", "Yeseo", "Minju", "Ara", "Lia", "Hyeon", "Doyeon", "Sumin", "Naeun", "Bora", "Seul", "Hani", "Yeri", "Iro", "Kyra"];
export const BOY_NAMES = ["Jun", "Hyun", "Tae", "Minho", "Seong", "Kai", "Woo", "Jae", "Leo", "Rin", "Noah", "Ian", "Haru", "Eden", "Zion", "Siwoo", "Ren", "Mark", "Elio", "Juhan", "On", "Kye", "Sol", "Doyoung", "Haneul"];

export const SONGS = ["午夜地铁", "GLASS HEART", "粉红噪音", "AFTERIMAGE", "我们的季节", "NEON RAIN", "无声应援", "BLUE HOUR", "糖与刀", "FIRST LIGHT", "回声旅馆", "VELVET LINE", "夏日误点", "未公开彩排", "灯塔练习室"];

export const CLIENTS = ["Melon", "Inkigayo", "Music Bank", "SBS", "Vogue KR", "Dazed", "Olive Young", "CJ ENM", "Netflix KR", "Spotify", "Dispatch", "W Korea"];

export const AI_SEED: { name: string; type: GroupType; fandom: number; known: number; base: number; debut: number; back: number }[] = [
  { name: "LUMIÈRE", type: "girl", fandom: 920, known: 860, base: 780, debut: 180, back: 6 },
  { name: "AXION", type: "boy", fandom: 880, known: 840, base: 760, debut: 160, back: 14 },
  { name: "KITE", type: "girl", fandom: 640, known: 600, base: 520, debut: 90, back: 20 },
  { name: "VELVET", type: "boy", fandom: 700, known: 680, base: 560, debut: 120, back: 9 },
  { name: "MONO", type: "mixed", fandom: 500, known: 540, base: 430, debut: 70, back: 28 },
  { name: "HALO DEPT.", type: "girl", fandom: 280, known: 240, base: 300, debut: 18, back: 24 },
  { name: "REDLINE", type: "boy", fandom: 610, known: 590, base: 480, debut: 110, back: 16 },
  { name: "AURORA LANE", type: "girl", fandom: 450, known: 420, base: 360, debut: 60, back: 11 },
];

export const SIZE_RULE: Record<string, { expo: number; cost: number; clash: string }> = {
  small: { expo: 1.4, cost: 0.75, clash: "低。一人缺席就无法接团活" },
  mid: { expo: 1, cost: 1, clash: "标准" },
  large: { expo: 0.78, cost: 1.45, clash: "高，综艺与巡演收益 +25%" },
};

export function sizeBand(n: number): "small" | "mid" | "large" {
  if (n <= 3) return "small";
  if (n <= 6) return "mid";
  return "large";
}
