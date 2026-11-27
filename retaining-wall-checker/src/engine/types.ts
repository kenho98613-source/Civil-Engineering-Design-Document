/**
 * Core engineering data structures for Retaining Wall Design & Checker (v14.0.1).
 * Mirrors the exact state schema (S) and calculation outputs of legacy/Retaining_Wall_Checker_v14.0.1.html.
 */

export type WallType = 'T' | 'L' | 'Li' | 'G';
export type CheckingMethod = 'fc' | 'gg1';
export type KaMode = 'r' | 'c' | 'm';
export type KpMode = 'a' | 'm';
export type WallFrictionMode = 'auto' | 'h' | 't' | 'c';
export type BaseFrictionMode = 'cv' | 'c';
export type GwlCase = 'ant' | 'pos';
export type DfMode = 'front' | 'ogl';
export type ExtraStemLayout = 'ter' | 'U';
export type RcEarthPressureMode = 'ko' | 'ka' | 'env';
export type GravityMeshBasis = '965' | '913t' | '913f';
export type WindZone = 'A' | 'B' | 'C' | 'D';
export type VehicleFloorMode = 'r' | 't' | 'c';
export type BaseCastSurface = 'blind' | 'earth';

export interface SoilParams {
  c: number;
  phi: number;
  g: number;
  gs: number;
}

export interface FoundationSoilParams extends SoilParams {
  cvm: 'v' | 'g' | 'c';
  cv: number;
}

export interface StemInput {
  t: number;
  fb: number;
  rb: number;
  of: number;
  top: number;
  bot: number;
  rc: number | boolean;
  /** Legacy pre-v9.4 field (removed by fillDef) */
  tt?: number;
}

export interface ExtraStemSegmentInput {
  t: number;
  h: number;
}

export interface ExtraStemInput {
  x: number;
  t: number;
  h: number;
  zt: number;
  rc?: number | boolean;
  pp?: number | boolean;
  up?: ExtraStemSegmentInput[];
}

export interface RcBarSet {
  d: number;
  s: number;
  d2: number;
  s2: number;
  d3: number;
  s3: number;
}

export interface BarPair {
  d: number;
  s: number;
}

export interface CheckOverride {
  off?: number | boolean;
  why?: string;
}

export interface DwgSheetRef {
  name: string;
  no: string;
  type: string;
  nts: number;
}

export interface DwgPick {
  v: number | string;
  src: string;
  conf: 'high' | 'med' | 'inferred' | 'missing' | string;
  ci?: number | null;
}

export interface DwgBay {
  name: string;
  tt: 'none' | 'kerb' | 'parapet' | string;
  stT: number | string;
  stTc?: string;
  rc: number | boolean;
  fh: number | string;
  fhc?: string;
  fhs?: string;
  ft: string;
  sol: number | string;
  bar: string;
  barc?: string;
}

export interface DwgCheckEntry {
  lab: string;
  a: string;
  sa: string;
  b: string;
  sb: string;
}

export interface DwgFigExtract {
  t: string;
  ti: string;
  svg: string;
}

export interface DwgState {
  sheets: DwgSheetRef[];
  picks: Record<string, DwgPick>;
  bays: DwgBay[];
  chk: DwgCheckEntry[];
  cf: string[];
  so: string;
  el: string;
  flim?: number | boolean;
  pn0?: string;
  built?: number | null;
  figs?: DwgFigExtract[];
}

export interface WallState {
  ver: number;
  pn: string;
  dsn: string;
  chk: string;
  jno: string;
  acc: CheckingMethod;
  adv: number;
  Fs: number;
  Fo: number;
  Fow: number;
  gwc: GwlCase;
  Fb: number;
  gpon: number;
  gpv: number;
  gpS: number;
  gpO: number;
  gpA: number;
  gpsrc: string;
  ck: Record<string, CheckOverride>;
  cmp: number;
  cQ: number;
  gm: number;
  gq: number;
  br: number;
  bf: number;
  qin: number;
  qinRC: number;
  r: SoilParams;
  f: FoundationSoilParams;
  fsm: number;
  fs: SoilParams;
  brL: number;
  bkfm: number;
  bkf: SoilParams;
  kam: KaMode;
  kaM: number;
  kaMf: number;
  kpm: KpMode;
  kpM: number;
  kpMf: number;
  dwm: WallFrictionMode;
  dcw: number;
  comp: number;
  dbm: BaseFrictionMode;
  dcb: number;
  Hr: number;
  Hf: number;
  fon: number;
  bon: number;
  fw: number;
  dp: number;
  dfm: DfMode;
  ogl: number;
  nopp: number;
  ppS: number;
  ppO: number;
  ppB: number;
  ty: WallType;
  Lt: number;
  Lh: number;
  Zb: number;
  tb: number;
  st: StemInput[];
  skon: number;
  skd: number;
  skw: number;
  skx: number;
  wl: string;
  wlZ: number;
  qcat: string;
  q: number;
  qst: number;
  qj: number;
  lon: number;
  lQv: number;
  lQh: number;
  lx: number;
  wo: number;
  wh: number;
  wsd: number;
  wlen: number;
  wz: WindZone;
  wSt: number;
  bro: number;
  brc: string;
  brF: number;
  bhb: number;
  vM: number;
  vb: number;
  vR: number;
  vObl: number;
  stv: number;
  smb: 'wall' | 'slab';
  tsw: number;
  fxo: string | number;
  fdl: number;
  fdP: number;
  fdS: number | string;
  scon: number;
  scb: number;
  xs: ExtraStemInput[];
  xa: ExtraStemLayout;
  rpf: number;
  vL: number;
  vFl: VehicleFloorMode;
  accI: number;
  vFz: number;
  vStem: number;
  vSO: number;
  kpp: number;
  grmin: number;
  gc: number;
  fcu: number;
  fy: number;
  cvS: 'a' | number | string;
  cvt: number;
  cvb?: number | string;
  cbs: BaseCastSurface;
  rmin: number;
  rck: RcEarthPressureMode;
  ocr: number;
  kom: number;
  koM: number;
  hnr: number;
  cpb: number;
  utgt: number;
  cb: { v: BarPair; h: BarPair; t: BarPair; l: BarPair };
  gmo: string;
  gmr: 'none' | 'cc' | string;
  gB: number;
  gBt: number;
  gbf: number;
  gbr: number;
  gBh: number;
  geo3: number;
  heffm: string;
  heff: number;
  gsz: string;
  grho: number;
  jmu: number;
  jfs: number;
  mshd: number;
  mshs: number;
  gmb: GravityMeshBasis;
  mvd: number;
  mvs: number;
  mhd: number;
  mhs: number;
  mtd: number;
  mts: number;
  mbd: number;
  mbs: number;
  asc: number;
  xrc: number;
  rc: Record<string, RcBarSet>;
  obdp: number;
  dwg: DwgState | null;
  gis: number;
  gir: string;
  flim: number;
  wsdb: string;
  fgm?: string;
}

export interface ProjectMeta {
  pn: string;
  jno: string;
  dsn: string;
  chk: string;
  gis: number;
  gir: string;
}

export interface WallTypeEntry {
  id: string;
  name: string;
  named: number;
  S: WallState;
}

export interface ProjectFile {
  app: 'rwall';
  ver: number;
  model?: string;
  saved?: string;
  project: ProjectMeta;
  types: WallTypeEntry[];
  active: number;
  S?: WallState;
}

export interface FillDefResult {
  state: WallState;
  dropped: string[];
  migrationNote: string;
}

/* ---------------- Geometry ---------------- */

export interface StemGeo {
  i: number;
  s: StemInput;
  t: number;
  fb: number;
  rb: number;
  tt: number;
  h: number;
  bot: number;
  top: number;
  xf0: number;
  xb0: number;
  xf1: number;
  xb1: number;
  xc: number;
  xs0: number;
  xs1: number;
  ts: number;
  ovF: number;
  ovB: number;
}

export interface ExtraStemSegmentGeo {
  k: number;
  x0: number;
  x1: number;
  t: number;
  h: number;
  bot: number;
  top: number;
  p: string;
}

export interface ExtraStemGeo {
  j: number;
  s: ExtraStemInput;
  x0: number;
  x1: number;
  t: number;
  h: number;
  bot: number;
  top: number;
  zt: number;
  xc: number;
  pp: boolean;
  segs: ExtraStemSegmentGeo[];
  A: number;
  xw: number;
  xm: number;
  xn0: number;
  xb: (zz: number) => number;
  xf: (zz: number) => number;
}

export type Point2D = [number, number];

export interface GeometryResult {
  n: number;
  SG: StemGeo[];
  tl: number;
  Lt: number;
  hl: number;
  B: number;
  xb: number;
  bt: number;
  top: number;
  bk: Point2D[];
  fr: Point2D[];
  frM: Point2D[];
  XS: ExtraStemGeo[];
  Lt0: number;
  Lw: number;
  xH: number;
  vb: boolean;
  ftx: number;
  ttw: number;
}

export interface Piece4 {
  k: 'fb' | 'r' | 'rb';
  b: number;
  h: number;
  A: number;
  x: number;
  z: number;
}

export interface SoilBandPart {
  A: number;
  M: number;
  Z: number;
}

export interface SoilBandResult {
  d: SoilBandPart;
  s: SoilBandPart;
}

export interface SectionLoad {
  W: number;
  Me: number;
  Wf?: number;
  Mef?: number;
}

export interface BlockSectionLoad extends SectionLoad {
  xf0: number;
  xb0: number;
  z: number;
}

export type SectionLoadsResult = SectionLoad[] & { blk?: BlockSectionLoad };

export interface ShearKeyGeo {
  dk: number;
  Bk: number;
  xk: number;
}

/* ---------------- Earth pressure & Parameters ---------------- */

export interface WallDeltaResult {
  d: number;
  dRaw: number;
  dmax: number;
  dmaxSec: number;
  soilZ: boolean;
  src: string;
  over: boolean;
  used: number;
}

export interface KaResult {
  Ka: number;
  Kah: number;
  d: number;
  al?: number;
  lab: string;
}

export interface MaterialParams {
  mode: 'k' | 'f';
  gm: number;
  phr: number;
  phf: number;
  phs: number;
  wd: WallDeltaResult;
  al: number;
  Ka: number;
  Kah: number;
  d: number;
  kaLab: string;
  Kp: number;
  Kpf: number;
  cP: number;
  db0: number;
  db: number;
  cF: number;
}

export interface CompactionInfo {
  Q: number;
  phm: number;
  zc: number;
  hc: number;
}

/* ---------------- Loads ---------------- */

export interface WindCalcResult {
  h: number;
  ph: number;
  Z: number;
  Ze: number;
  Qo: number;
  Qz: number;
  Ss: number;
  L: number;
  Cp: number;
  area: number;
  basis: string;
  note: string;
  P: number;
  F: number;
  z: number;
  zone: WindZone;
  steps: [string, string, string, string, string][];
}

export interface VehCalcResult {
  M: number;
  v: number;
  c: number;
  b: number;
  hb: number;
  F1: number;
  Lr: number;
  gm: number;
  F2: number;
  F: number;
  Ld: number;
  Fm: number;
  fl: number;
  zA: number;
}

export interface BarrierCalcResult {
  F: number;
  ha: number;
  z: number;
  veh?: VehCalcResult;
}

export interface TopCase {
  k: 'none' | 'wind' | 'bar';
  F: number;
  z: number;
  Fk?: number;
}

export interface LineLoadResult {
  x: number;
  m: number;
  H: number;
  Qv: number;
  Qh: number;
  Pk: number;
  kf: number;
  nb: number;
  Pv: number;
  yv: number;
  He: number;
  Ph: number;
  yh: number;
  trunc: boolean;
  sig: (z: number) => number;
}

export interface LoadComponent {
  n: string;
  t: string;
  fm: string;
  F: number;
  cat: string;
  dir: 'h' | 'p' | 'v' | 'u';
  arm: number;
  y?: number;
  pav?: number;
}

export interface CompParamsLite {
  Kah: number;
  d: number;
  Kp: number;
  cP: number;
  phr: number;
  al?: number;
  Ka?: number;
  kaLab?: string;
}

export interface CompResult {
  it: LoadComponent[];
  G: GeometryResult;
  P: CompParamsLite;
  al: number;
  q: number;
  qi: number;
  qt: number;
  hs0: number;
  hs: number;
  wb: number;
  Wb: number;
  h1: number;
  gR: number;
  gF: number;
  gFs: number;
  hf: number;
  wf: number;
  ws: number;
  d1: number;
  hf0: number;
  ws0: number;
  d10: number;
  sk: number;
  ub: number;
  uf: number;
  dry: number;
  wh: number;
  dt: number;
  wt: number;
  top: TopCase | null;
  pasOK: boolean;
  LL: LineLoadResult | null;
  KG: ShearKeyGeo | null;
  KaU: number | null;
  UU: boolean;
}

export type LoadFactors = Record<string, number>;

export interface EvalOptions {
  ppM?: number | boolean;
}

export interface EvalResult {
  H: number;
  Hp: number;
  W: number;
  U: number;
  N: number;
  Ms: number;
  Md: number;
  Mp: number;
  Mr: number;
  xbar: number;
  e: number;
  Hc: Record<string, number>;
  Mc: Record<string, number>;
  Vc: Record<string, number>;
  B: number;
}

/* ---------------- Bearing & Stability ---------------- */

export interface SlopeCrestInfo {
  be: number;
  d: number;
  b: number;
  xA: number;
  L4: number;
  Bw: number;
  fcB: boolean;
  qA: number;
  qB: number;
  rA: BearingResult;
  rB: BearingResult;
  t: number;
}

export interface BearingResult {
  eb: number;
  Bp: number;
  Nq: number;
  Nc: number;
  Ng: number;
  Ki: number;
  iq: number;
  ig: number;
  ic: number;
  gq: number;
  gc: number;
  qu: number;
  Qu: number;
  sc?: SlopeCrestInfo;
}

export interface OverburdenResult {
  q: number;
  D: number;
}

export interface QoResult {
  q: number;
  D: number;
  src: string;
}

export interface KeyMechResult {
  kOn: boolean;
  dk: number;
  Bk: number;
  xk: number;
  Zk: number;
  gfb: number;
  sv0: number;
  dPa: number;
  dPq: number;
  dPw: number;
  usePp: boolean;
  sf0: number;
  dPp: number;
  dPpw: number;
  Rp: number;
  Fa: number;
  N1: number;
  Nb: number;
  Ns: number;
  tphi: number;
  Fr: number;
  deep: boolean;
  shallow: boolean;
}

export interface SlsResult {
  tc: TopCase;
  sh: number;
  pv: number;
  fa: LoadFactors;
  s: EvalResult;
  C: CompResult;
}

export interface Gg1SlidingResult {
  tc: TopCase;
  C: CompResult;
  s: EvalResult;
  Fr: number;
  Fa: number;
  u: number;
  gp: number;
  fa: LoadFactors;
  km: KeyMechResult | null;
}

export interface Gg1OverturningResult {
  tc: TopCase;
  s: EvalResult;
  F: number;
  gp: number;
  C: CompResult;
  fa: LoadFactors;
}

export interface Gg1BearingResult {
  tc: TopCase;
  lab: string;
  b: EvalResult;
  r: BearingResult;
  ob: OverburdenResult;
  u: number;
  Hb: number;
  C: CompResult;
  fa: LoadFactors;
}

export interface Gg1Result {
  Pf: MaterialParams;
  Pk: MaterialParams;
  cases: unknown[];
  sl: Gg1SlidingResult;
  ot: Gg1OverturningResult;
  br: Gg1BearingResult;
  sls: SlsResult;
  okE: boolean;
  naE: boolean;
  okS: boolean;
  okO: boolean;
  okB: boolean;
}

export interface FcFactors {
  pos: boolean;
  Fs: number;
  Fsw: number;
  Fo: number;
  Fow: number;
  Fog: number;
  Fu: number;
  Fb: number;
  lab: string;
}

export interface Fc17SlidingResult {
  tc: TopCase;
  s: EvalResult;
  R: number;
  Ha: number;
  Hw: number;
  Ho: number;
  Hreq: number;
  F: number;
  Freq: number;
  u: number;
  C: CompResult;
  fa: LoadFactors;
  km: KeyMechResult | null;
  ref: number;
  Hst: number;
  Fe: number;
}

export interface Fc17OverturningResult {
  tc: TopCase;
  s: EvalResult;
  F: number;
  Freq: number;
  Mw: number;
  Mg: number;
  Mo: number;
  Mreq: number;
  u: number;
  C: CompResult;
  fa: LoadFactors;
  ref: number;
  Mst: number;
  Fe: number;
}

export interface Fc17UpliftResult {
  tc: TopCase;
  s: EvalResult;
  req: number;
  r: number;
}

export interface Fc17BearingResult {
  tc: TopCase;
  b: EvalResult;
  rr: BearingResult;
  qu: number;
  qo: number;
  qoR: QoResult;
  qa: number;
  qap: number;
  F: number;
  ob: OverburdenResult;
  C: CompResult;
  fa: LoadFactors;
  lab: string;
}

export interface Fc17Result extends FcFactors {
  Pk: MaterialParams;
  gS: number;
  gO: number;
  sl: Fc17SlidingResult;
  ot: Fc17OverturningResult;
  up: Fc17UpliftResult;
  br: Fc17BearingResult;
  okS: boolean;
  okO: boolean;
  okU: boolean;
  okB: boolean;
}

export interface UtilResult {
  sl: number;
  ot: number;
  br: number;
  up: number;
  ec: number;
  uls: number;
  okULS: boolean;
  okAll: boolean;
}

export interface AccImpactResult {
  b: BarrierCalcResult;
  C: CompResult;
  s: EvalResult;
  Rr: number;
  Ha: number;
  Fs: number;
  Fo: number;
  br: { F: number; qu: number; qo: number; qap: number; b: EvalResult; r: BearingResult };
  km: KeyMechResult | null;
  ok: boolean;
}

export interface Delta0CheckResult {
  u: UtilResult;
  Fc: Fc17Result;
  A: Gg1Result;
}

export interface SecCheckAct {
  Hs: number;
  Ms: number;
  Hw: number;
  Mw: number;
  Hq: number;
  Mq: number;
  Pv: number;
}

export interface SecCheckResult {
  i: number;
  st: StemInput;
  k: string;
  lab: string;
  Ls: number;
  h: number;
  W: number;
  Me: number;
  Pv: number;
  N: number;
  H: number;
  MR: number;
  Mo: number;
  Mreq: number;
  Fot: number;
  Freq: number;
  uO: number;
  okO: boolean;
  tk: TopCase['k'];
  A: SecCheckAct;
  AK: SecCheckAct;
  ek: number;
  eN: number;
  eMR: number;
  eMD: number;
  okE: boolean;
  rc: boolean;
  Kh: number;
  al: number;
  dd: number;
  uE: number;
  na: boolean;
  ok: boolean;
  sev: number | null;
}

/* ---------------- RC Design, BMD/SFD, Curtailment, Mesh ---------------- */

export interface CoverRow {
  n: string;
  ex: number;
  why: string;
  min: number | null;
  c: number;
  st?: number;
}

export interface CoverResult {
  s: number;
  t: number;
  b: number;
  auto: number;
  sMin: number | null;
  tMin: number | null;
  bMin: number | null;
  sEx: number;
  tEx: number;
  dS: number;
  dB: number;
  rows: CoverRow[];
}

export interface RcActionElement {
  k: string;
  n: string;
  h: number;
  M: number;
  V: number;
  cm: number;
  co: number;
  ty: 's' | 'T' | 'H';
  gv?: boolean | number;
  me?: number;
  bad?: boolean;
  fn?: [string, string] | null;
  span?: number;
  gov: string;
  hnM?: number;
  hnV?: number;
}

export interface RcDesignElement extends RcActionElement {
  wl: boolean;
  rv: number;
  rh: number;
  r: RcBarSet;
  rev: boolean;
  bm: BarPair;
  bo: BarPair;
  cT: number;
  d: number;
  K: number;
  Kp: number;
  z: number;
  x: number;
  Asr: number;
  Asr0: number;
  gpA: number;
  am: number;
  Asm: number;
  he: number | null;
  Asp: number;
  As2: number;
  As3: number;
  secReq: number;
  secProv: number;
  rho: number;
  f4: number;
  vc: number;
  v: number;
  vmax: number;
  sMain: number;
  sSec: number;
  rq: number;
  fs: number;
  crk: boolean;
  Sc: number;
  tf: string;
  of: string;
  st: boolean;
  gv: boolean;
  tab9: number;
  okK: boolean;
  okM: boolean;
  okV: boolean;
  okVm: boolean;
  okSec: boolean;
  okMax: boolean;
  okOpp: boolean;
  okS: boolean;
  okCr: boolean;
  okC: boolean;
  uM: number;
  uV: number;
  ok: boolean;
}

export interface DiagramPoint {
  z?: number;
  x?: number;
  M: number;
  V: number;
}

export type DiagramMap = Record<string, DiagramPoint[]>;

export interface CurtailmentResult {
  none?: number;
  why?: string;
  phi: number;
  s: number;
  zt?: number;
  ext?: number;
  lb?: number;
  d?: number;
  zc?: number;
  need?: number;
  half?: number;
}

export interface MassElement {
  i: number;
  lab: string;
  h: number;
  blk: number;
}

export interface MeshRow {
  sec: string;
  lab: string;
  lab0: string;
  k: 'v' | 'h' | 't' | 'b';
  hm: number;
  he: number;
  Am: number;
  At?: number;
  tot: number;
  rtx: string;
  d: number;
  sp: number;
  Ap: number;
  L: number;
  pair: string;
  okS: boolean;
  prov: number;
  need: number;
  okA: boolean;
  u: number;
  wt: number;
  ok: boolean;
}

export interface AnchorageResult {
  phi: number;
  fy: number;
  fcu: number;
  be: number;
  fb?: number;
  lb: number;
  n?: number;
  L?: number;
  emb: number;
  av: number;
  rcB?: boolean;
  into?: string;
  ok: boolean;
}

/* ---------------- Validation & calcAll ---------------- */

export interface ValidationResult {
  E: string[];
  W: string[];
}

export interface CalcAllErrorResult {
  err: 1;
  G: GeometryResult;
  V: ValidationResult;
  Pk: MaterialParams;
  Pf: MaterialParams;
  q: number;
  P: boolean;
}

export interface CalcAllSuccessResult {
  err?: undefined;
  G: GeometryResult;
  V: ValidationResult;
  Pk: MaterialParams;
  Pf: MaterialParams;
  q: number;
  P: boolean;
  A: Gg1Result;
  Fc: Fc17Result;
  gov: TopCase;
  Ck: CompResult;
  sk: EvalResult;
  ko: number;
  RS: RcDesignElement[];
  PL: SecCheckResult[];
  MS: MeshRow[];
  okMesh: boolean;
  CA: CoverRow[];
  crOK: boolean;
  okRC: boolean;
  okPlain: boolean;
  csO: boolean;
  csE: boolean;
  u: UtilResult;
  fails: string[];
  X: number;
  AI: AccImpactResult | null;
  D0: Delta0CheckResult | null;
  vol: number;
  steel: number;
}

export type CalcAllResult = CalcAllErrorResult | CalcAllSuccessResult;

export interface CheckRegisterRow {
  id: string;
  n: string;
  cl: string;
  st: boolean | 'na' | 'nc' | 'rv';
  pv: string;
  rq: string;
  det: string;
  lk: number;
  u?: number | null;
  gp: 's' | 'r';
}

/* ---------------- Design Tools ---------------- */

export interface LeanErrorResult {
  err: string[];
}

export interface LeanSuccessResult extends UtilResult {
  err?: undefined;
  G: GeometryResult;
  P: boolean;
  A: Gg1Result | { sls: SlsResult };
  Fc: Fc17Result | null;
  vol: number;
}

export type LeanResult = LeanErrorResult | LeanSuccessResult;

export interface FullMetricsSuccess {
  err?: undefined;
  ty: WallType;
  acc: CheckingMethod;
  B: number;
  vol: number;
  steel: number;
  qmax: number;
  u: UtilResult;
  rcU: number | null;
  ok: boolean;
  fails: string[];
  X: number;
}

export type FullMetricsResult = { err: string[] } | FullMetricsSuccess;

export interface OptimizeOptions {
  optTb?: boolean;
  tbMin?: number;
  tbMax?: number;
  optRc?: boolean;
}

export interface OptimizeCandidate {
  Lt?: number;
  Lh?: number;
  tb: number;
  gw?: number;
  m: LeanSuccessResult;
  vol: number;
  B: number;
}

export interface OptimizeResult {
  none?: 1;
  Lmax?: number;
  tbs?: number[] | null;
  key: string;
  G1?: boolean;
  n?: number;
  ms?: number;
  cur?: {
    Lt: number;
    Lh: number;
    tb: number;
    gw: number;
    B: number;
    vol: number;
    m: LeanResult;
  };
  best?: OptimizeCandidate;
}

export interface CriticalLimit {
  none?: 1;
  all?: 1;
  v?: number;
  m?: LeanSuccessResult;
}

export interface CriticalLimitsResult {
  w1: CriticalLimit | null;
  w2: CriticalLimit | null;
  q1: CriticalLimit | null;
  qMax: number;
}

export interface SensitivityRow {
  n: string;
  lab: string;
  lo: LeanSuccessResult | null;
  hi: LeanSuccessResult | null;
}

export interface SensitivityResult {
  key: string;
  base: LeanSuccessResult;
  rows: SensitivityRow[];
}

/* ---------------- DXF Parser & Exporter ---------------- */

export interface DxfEntity {
  t: string;
  g: [number, string][];
}

export interface DxfParsed {
  ver: string;
  k: number;
  E: DxfEntity[];
}

export interface DxfInsert {
  x: number;
  y: number;
  b: string;
  att?: number;
}

export interface DxfTextItem {
  s: string;
  x: number;
  y: number;
  h: number;
  ly: string;
  ins: DxfInsert | null;
}

export interface DxfDimItem {
  v: number;
  dir: 'h' | 'v';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tx: number;
  ty: number;
  txt: string;
  ov: number | null;
  ly: string;
}

export type DxfGeomItem =
  | { k: 'l'; p: Point2D[]; c?: number }
  | { k: 'c' | 'a'; x: number; y: number; r: number; a0: number; a1: number };

export interface DxfExtracted {
  T: DxfTextItem[];
  Dm: DxfDimItem[];
  Gm: DxfGeomItem[];
  I: DxfInsert[];
  k?: number;
  name?: string;
  V?: DxfView[];
  C?: DxfCandidates;
}

export interface DxfView {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  T: number[];
  D: number[];
  G: number[];
  title: string;
  type: 'elevation' | 'section' | 'plan' | 'other' | 'ignore';
  dat?: { c: number; s: number } | null;
}

export interface DxfLevelCand {
  z: number;
  x: number;
  y: number;
  v: number;
  src: string;
  ti?: number;
  dj?: number;
  dz?: number;
}

export interface DxfDimCand {
  v: number;
  dir: 'h' | 'v';
  x: number;
  y: number;
  v_: number;
  j: number;
  txt: string;
  ov: number | null;
}

export interface DxfCandidates {
  lv: DxfLevelCand[];
  dm: DxfDimCand[];
  bad?: string[];
}

export interface DxfGuessPick {
  c: number;
  conf: 'high' | 'med';
}

export interface DxfGuessBay {
  name: string;
  tt: 'parapet' | 'kerb' | 'none';
  stTop?: DxfGuessPick;
  Hr?: DxfGuessPick;
  fh: { v: number | string; conf: 'high' | 'med' | 'missing'; txt?: string };
  bar: string;
}

export interface DxfGuessResult {
  gwl?: DxfGuessPick;
  Hf?: DxfGuessPick;
  top?: DxfGuessPick;
  Zb?: DxfGuessPick;
  B?: DxfGuessPick;
  bays: DxfGuessBay[];
}

export interface DxfExportOptions {
  sc?: number;
  name?: string;
  bars?: boolean;
}

/* ---------------- Benchmarks ---------------- */

export interface BenchmarkCase {
  id: string;
  t: string;
  s: Record<string, unknown>;
  q: [string, number][];
}

export interface BenchmarkQuantityResult {
  key: string;
  l: string;
  u: string;
  ref: number;
  m: number;
  d: number;
  ok: boolean;
}

export interface BenchmarkCaseResult {
  c: BenchmarkCase;
  er: string;
  rows: BenchmarkQuantityResult[];
  ok: boolean;
  mx: number;
}
