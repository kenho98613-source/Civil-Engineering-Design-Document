/**
 * Code tables, constants, and factory default states.
 * Preserved verbatim from legacy/Retaining_Wall_Checker_v14.0.1.html (RULES.md #1 & #2).
 */
import type { WallState, WallType, WindZone } from './types';

export const G_WATER = 9.81;
export const DEG2RAD = Math.PI / 180;
export const MODEL_VERSION = 'v14.0.1';

export const PJF = ['pn', 'jno', 'dsn', 'chk', 'gis', 'gir'] as const;

export const DEFAULT_STATE: WallState = {
  ver: 9,
  pn: '',
  dsn: '',
  chk: '',
  jno: '',
  acc: 'fc',
  adv: 0,
  Fs: 1.5,
  Fo: 2,
  Fow: 1.5,
  gwc: 'ant',
  Fb: 3,
  gpon: 0,
  gpv: 1.3,
  gpS: 1,
  gpO: 1,
  gpA: 1,
  gpsrc: '',
  ck: {},
  cmp: 1,
  cQ: 10,
  gm: 1.2,
  gq: 1.5,
  br: 0,
  bf: 0,
  qin: 10,
  qinRC: 1,
  r: { c: 0, phi: 30, g: 19, gs: 20 },
  f: { c: 0, phi: 35, cvm: 'v', cv: 30, g: 19, gs: 20 },
  fsm: 1,
  fs: { c: 0, phi: 35, g: 19, gs: 20 },
  brL: 0,
  bkfm: 0,
  bkf: { c: 0, phi: 30, g: 19, gs: 19 },
  kam: 'r',
  kaM: 0.333,
  kaMf: 0.395,
  kpm: 'a',
  kpM: 3.69,
  kpMf: 3.03,
  dwm: 'auto',
  dcw: 15,
  comp: 0,
  dbm: 'cv',
  dcb: 30,
  Hr: 10,
  Hf: 8,
  fon: 1,
  bon: 1,
  fw: 6.5,
  dp: 1,
  dfm: 'front',
  ogl: 8,
  nopp: 0,
  ppS: 1,
  ppO: 0,
  ppB: 0,
  ty: 'T',
  Lt: 1.2,
  Lh: 3.2,
  Zb: 6,
  tb: 0.6,
  st: [
    { t: 0.3, fb: 0, rb: 0, of: 0, top: 10, bot: 8.5, rc: 1 },
    { t: 0.45, fb: 0, rb: 0, of: 0, top: 8.5, bot: 6.6, rc: 1 },
  ],
  skon: 0,
  skd: 0.5,
  skw: 0.5,
  skx: 1.2,
  wl: '0.5',
  wlZ: 8,
  qcat: 'priv',
  q: 10,
  qst: 1,
  qj: 0,
  lon: 0,
  lQv: 10,
  lQh: 0,
  lx: 1,
  wo: 0,
  wh: 1.5,
  wsd: 1,
  wlen: 20,
  wz: 'A',
  wSt: 1,
  bro: 0,
  brc: '1.5',
  brF: 1.5,
  bhb: 1.1,
  vM: 38000,
  vb: 0,
  vR: 0,
  vObl: 0,
  stv: 10,
  smb: 'wall',
  tsw: 1,
  fxo: '',
  fdl: 0,
  fdP: 5,
  fdS: 3,
  scon: 0,
  scb: 2,
  xs: [],
  xa: 'ter',
  rpf: 0,
  vL: 10,
  vFl: 'r',
  accI: 0,
  vFz: 0,
  vStem: 0,
  vSO: 0,
  kpp: 1,
  grmin: 0.13,
  gc: 24,
  fcu: 40,
  fy: 500,
  cvS: 'a',
  cvt: 40,
  cbs: 'blind',
  rmin: 0.13,
  rck: 'ko',
  ocr: 1,
  kom: 0,
  koM: 0.5,
  hnr: 0,
  cpb: 0,
  utgt: 80,
  cb: {
    v: { d: 12, s: 200 },
    h: { d: 12, s: 200 },
    t: { d: 12, s: 200 },
    l: { d: 12, s: 200 },
  },
  gmo: 'B',
  gmr: 'none',
  gB: 2.8,
  gBt: 1.2,
  gbf: 1.6,
  gbr: 0,
  gBh: 3.2,
  geo3: 1,
  heffm: '250',
  heff: 250,
  gsz: 'sz',
  grho: 0.25,
  jmu: 0.6,
  jfs: 1.5,
  mshd: 12,
  mshs: 175,
  gmb: '965',
  mvd: 12,
  mvs: 175,
  mhd: 12,
  mhs: 175,
  mtd: 12,
  mts: 175,
  mbd: 12,
  mbs: 175,
  asc: 1,
  xrc: 1,
  rc: {},
  obdp: 1,
  dwg: null,
  gis: 0,
  gir: '',
  flim: 0,
  wsdb: '',
};

/** Optional checks that the designer may switch off (with a reason) */
export const CKL: [string, string][] = [
  ['ecc', 'Eccentricity – middle-third rule'],
  ['rc', 'Structural – RC / minimum steel'],
  ['mesh', 'Anti-crack mesh (detailing)'],
];

/** Wind Code 2019 Table 4-2 (open frameworks, phi < 0.8, solid area) */
export const T42: [number, number][] = [
  [0.01, 2],
  [0.1, 1.8],
  [0.2, 1.7],
  [0.3, 1.6],
  [0.5, 1.5],
  [0.8, 1.5],
  [0.9, 1.6],
  [1, 2],
];

/** Wind Code 2019 Table B3-1 (free-standing walls, phi = 1, without return corners): l/h = 3, 5, >= 10 */
export const B31: Record<WindZone, [number, number, number]> = {
  A: [2.3, 2.9, 3.4],
  B: [1.4, 1.8, 2.1],
  C: [1.2, 1.4, 1.7],
  D: [1.2, 1.2, 1.2],
};

export const B31R: Record<WindZone, number> = { A: 2.1, B: 1.8, C: 1.4, D: 1.2 };

/** CoP SUC 2013 Table 4.2 nominal cover (other members) by exposure / grade C25..>=C55 */
export const T42c: Record<number, (number | null)[]> = {
  1: [35, 30, 30, 30, 25, 25, 25],
  2: [null, 40, 35, 35, 30, 30, 30],
  3: [null, null, null, 50, 45, 45, 45],
  4: [null, null, null, null, null, 55, 50],
};

export const GR = [25, 30, 35, 40, 45, 50, 55] as const;
export const EXN = ['', 'Mild', 'Moderate', 'Severe', 'Very severe'] as const;
export const CVO = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75] as const;

/** DIL 2011 Table 3.17 surcharge */
export const QCAT: Record<string, [string, number | null]> = {
  pub: ['Public road (DIL Table 3.17)', 20],
  priv: ['Private road (DIL Table 3.17)', 10],
  foot: ['Footpath / cycle track / play area (DIL Table 3.17)', 5],
  bldg: ['Building, shallow fdn: 10 kPa/storey (DIL 3.9.2, GG1 Table 16)', null],
  c: ['Custom', null],
};

/** DIL 2011 Table 3.13 barrier line load */
export const BCAT: Record<string, string> = {
  '0.75': 'Pedestrian – congregation not expected (0.75 kN/m, Table 3.13)',
  '1.5': 'Pedestrian – may congregate, no overcrowding (1.5 kN/m, Table 3.13)',
  '3.0': 'Pedestrian – susceptible to overcrowding (3.0 kN/m, Table 3.13)',
  c: 'Pedestrian – custom line load',
  v6A: 'Vehicle barrier – Class 6A (3,000 kg) – DIL Cl 3.8.3',
  v6B: 'Vehicle barrier – Class 6B (5,500 kg) – DIL Cl 3.8.3',
  v6C: 'Vehicle barrier – Class 6C (24,000 kg) – DIL Cl 3.8.3',
  v6D: 'Vehicle barrier – Class 6D (30,000 kg) – DIL Cl 3.8.3',
  v6E: 'Vehicle barrier – Class 6E (M per Road Traffic Regs) – DIL Cl 3.8.3',
};

/** DIL 2011 Table 3.14 (M kg, v m/s) and Table 3.16 (bumper height mm) */
export const VEH: Record<string, [number | null, number, number]> = {
  v6A: [3000, 3.0, 600],
  v6B: [5500, 2.5, 800],
  v6C: [24000, 1.5, 1200],
  v6D: [30000, 1.5, 1200],
  v6E: [null, 1.5, 1200],
};

/** CoP SUC 2013 ULS load combinations */
export interface UlsCombination {
  id: string;
  n: string;
  gE: number;
  gQ: number;
  gW: number;
  gGa: number;
  gGb: number;
}

export const COMBS: UlsCombination[] = [
  { id: '1', n: '1.4G + 1.6Q + 1.4E', gE: 1.4, gQ: 1.6, gW: 0, gGa: 1.4, gGb: 1 },
  { id: '2', n: '1.4G + 1.4W + 1.4E', gE: 1.4, gQ: 0, gW: 1.4, gGa: 1.4, gGb: 1 },
  { id: '3', n: '1.2(G + Q + W + E)', gE: 1.2, gQ: 1.2, gW: 1.2, gGa: 1.2, gGb: 1 },
];

export const MBN: Record<string, string> = {
  '965': 'CoP Cl 9.6.5 – crack control, surface zone h_eff',
  '913t': 'CoP Cl 9.3.1.1(a) – ρmin of b·h, total both faces each direction',
  '913f': 'CoP Cl 9.3.1.1(a) – ρmin of b·h at each face (conservative)',
};

export const REFS: string[] = [
  'Geoguide 1: Guide to Retaining Wall Design (2020 Version) – CEDD / GEO',
  'Code of Practice for Foundations 2017 – BD',
  'Code of Practice for Structural Use of Concrete 2013 (2020 Edition) – BD',
  'Code of Practice on Wind Effects in Hong Kong 2019 – BD',
  'Code of Practice for Dead and Imposed Loads 2011 (2021 Edition) – BD',
  'Geotechnical Manual for Slopes – GEO',
];

export const TYN: Record<WallType, string> = {
  T: 'Cantilever – inverted T (toe + heel)',
  L: 'L-wall (heel only)',
  Li: 'Reversed L (toe only)',
  G: 'Gravity – mass concrete',
};

/** Default design per wall type – passes every check with factory soil / loads */
export const DFLT: Record<WallType, Partial<WallState>> = {
  T: {},
  L: {},
  G: {},
  Li: {
    Hr: 8.5,
    Hf: 7.5,
    fw: 6.5,
    Lt: 3.2,
    st: [{ t: 0.3, fb: 0, rb: 0, of: 0, top: 8.5, bot: 6.6, rc: 1 }],
    skon: 1,
    skd: 0.8,
    skw: 0.6,
    skx: 2.4,
  },
};

export const ABD = [12, 16, 20, 25, 32, 40] as const;
export const ABS = [100, 125, 150, 175, 200, 225, 250, 275, 300] as const;
export const ABD2 = [10, 12, 16, 20, 25] as const;

export const UN: Record<string, string> = {
  sl: 'Sliding',
  ot: 'Overturning',
  br: 'Bearing',
  up: 'Uplift',
  ec: 'Eccentricity',
};

export const DWP: [string, string, 'lv' | 'dm', string][] = [
  ['Zb', 'Founding level (wall bottom)', 'lv', 'mPD'],
  ['Hf', 'Front ground level', 'lv', 'mPD'],
  ['top', 'Mass concrete wall top', 'lv', 'mPD'],
  ['B', 'Wall width B', 'dm', 'm'],
  ['gwl', 'Design GWL (D.G.W.L.)', 'lv', 'mPD'],
];

export const DWT: [string, string][] = [
  ['none', 'None'],
  ['kerb', 'Planter kerb (stem)'],
  ['parapet', 'Parapet barrier (stem)'],
];

export const DWF: [string, string, number | null][] = [
  ['g', 'Vertical grille – φ 0.2', 0.2],
  ['m', 'Mesh + climbers – φ 0.6', 0.6],
  ['s', 'Solid panel – φ 1.0', 1],
  ['c', 'Custom', null],
];

export const DWV: [string, string][] = [
  ['', '– select –'],
  ['none', 'None'],
  ['ped', 'Pedestrian (1.5 kN/m)'],
  ['v6A', 'Vehicle 6A'],
  ['v6B', 'Vehicle 6B'],
  ['v6C', 'Vehicle 6C'],
  ['v6D', 'Vehicle 6D'],
];

export const DWVT: [string, string][] = [
  ['section', 'Section'],
  ['elevation', 'Elevation'],
  ['plan', 'Plan'],
  ['other', 'Other'],
  ['ignore', 'Ignore'],
];
