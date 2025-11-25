import { useMemo, useState } from "react";

/* ========================================================================
   TĚLESNÝ ZÁPIS — KOMPLETNÍ PROTOTYP
   - Identifikace hodiny (typ školy → škola → učitel → třída → místo)
   - Úvodní část (zahřátí)
   - Hlavní část (oblast → disciplína/hra → co se dělo → charakter → kdo vedl)
   - „Jiná/Jiný (doplňte ručně)“ u oblasti, disciplíny i zaměření
   - Logika „bez tandemu = vede učitel(ka)“
   - Náhled a základní validace
   ======================================================================== */

/** === Your Apps Script Web App URL (from Deploy → Web app → /exec) === */
const WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbztZ3eItDE9a6ynCbeqn9dYNrzDW9D-j4UB6v_7xQ2cuK_SY369m0tYruPzLVQqYu3o/exec";

/* ===================== ZÁKLADNÍ DATOVÉ TYPY A POMOCNÉ LABELY ===================== */

type SchoolId = "LA" | "HE" | "MO" | "LO" | "ZE" | "RU" | "LY" | "PL" | "VEP";

type School = {
  id: SchoolId;
  name: string;
  teachers: string[];
};

const ALL_SCHOOLS: School[] = [
  { id: "LA",  name: "ZŠ Laštůvkova",          teachers: ["LAPeštálová","LAŠebková","LABuršíková","LAKašpárková"] },
  { id: "HE",  name: "ZŠ Heyrovského",         teachers: ["HEKročilová","HEStudená"] },
  { id: "MO",  name: "ZŠ Mohelnice",           teachers: ["MOZeman"] },
  { id: "LO",  name: "ZŠ Lomnice",             teachers: ["LOHyánková"] },
  { id: "ZE",  name: "ZŠ Žernosecká",          teachers: ["ZETvrdá"] },
  { id: "RU",  name: "ZŠ Rudná",               teachers: ["RUučitelA","RUučitelB"] },
  { id: "LY",  name: "ZŠ Lyčkovo náměstí",     teachers: ["LYučitelA","LYučitelB"] },
  { id: "PL",  name: "ZŠ Plzeň",               teachers: ["PLučitelA","PLučitelB"] },
  { id: "VEP", name: "ZŠ Velké Popovice",      teachers: ["VEPučitel"] },
];

// Mapa: typ školy → povolené školy
const SCHOOLS_BY_TYPE: Record<"tandem5" | "tandem2" | "notandem", SchoolId[]> = {
  tandem5: ["LO","MO","ZE"],
  tandem2: ["HE","LA"],
  notandem: ["PL","RU","LY","VEP"],
};

const SCHOOL_TYPE_LABEL: Record<"tandem5" | "tandem2" | "notandem", string> = {
  tandem5: "Tandem 5× týdně",
  tandem2: "Tandem 2× týdně",
  notandem: "Bez tandemu",
};

// 6 charakterů činnosti (dle české terminologie)
const CHARACTERS = [
  { value: "nacvik",            label: "Nácvik" },
  { value: "prupravna_hra",     label: "Průpravná hra" },
  { value: "prupravne_cviceni", label: "Průpravné cvičení" },
  { value: "vycvik",            label: "Výcvik / opakování" },
  { value: "hra",               label: "Hra / soutěžní forma" },
  { value: "kondicni",          label: "Kondiční / rozvojové cvičení" },
];
const CHARACTER_LABEL = Object.fromEntries(CHARACTERS.map(c => [c.value, c.label])) as Record<string,string>;

// Zahřátí (tvé varianty)
const WARMUPS = [
  "řízené zahřátí hra",
  "řízené zahřátí rozcvičení bez pomůcek",
  "řízené zahřátí rozcvičení s pomůckami (např: míče)",
  "řízené zahřátí rozběhání",
  "neřízené zahřátí s pomůckami",
  "neřízené zahřátí samostatná hra",
  "neřízené zahřátí rozběhání",
];

/* ===================== HLAVNÍ ČÁST — OBLASTI, DISCIPLÍNY, ZAMĚŘENÍ ===================== */
/* Každá oblast má seznam disciplín/her a pro každou disciplínu seznam zaměření („co se dělo“).
   Všechny selecty mají navíc položku „Jiná/Jiný (doplňte ručně)“ s textovým polem.   */

// --- SPORTOVNÍ HRY (širší než jen míčové) ---
const GAMES = [
  "vybijena","hazena","basketbal","volejbal","fotbal","prehazovana","florbal","frisbee","kinball","tchoukball","netball",
  // doplňkové (pro větší šíři):
  "ringtenis","nohejbal","rugby_tag","pálkované_hry","korfbal"
] as const;
type Game = typeof GAMES[number];

const GAME_LABEL: Record<Game,string> = {
  vybijena: "Vybíjená",
  hazena: "Házená",
  basketbal: "Basketbal",
  volejbal: "Volejbal",
  fotbal: "Fotbal",
  prehazovana: "Přehazovaná",
  florbal: "Florbal",
  frisbee: "Frisbee",
  kinball: "Kin-ball",
  tchoukball: "Tchoukball",
  netball: "Netball",
  ringtenis: "Ringtenis",
  nohejbal: "Nohejbal",
  rugby_tag: "Tag rugby",
  pálkované_hry: "Pálkované hry",
  korfbal: "Korfbal",
};

const GAME_CONTENT: Record<Game, { value: string; label: string }[]> = {
  fotbal: [
    { value: "prihravky", label: "Přihrávky" },
    { value: "strelba", label: "Střelba" },
    { value: "vedeni_mice", label: "Vedení míče" },
    { value: "obrana", label: "Obrana" },
    { value: "brankar", label: "Hra brankáře" },
    { value: "taktika", label: "Taktika / rozestavení" },
  ],
  basketbal: [
    { value: "dribling", label: "Dribling" },
    { value: "prihravky", label: "Přihrávky" },
    { value: "strelba", label: "Střelba" },
    { value: "obrana", label: "Obrana (individuální / zónová)" },
    { value: "pohyb_bez_mice", label: "Pohyb bez míče / uvolňování" },
    { value: "doskok", label: "Doskakování" },
  ],
  hazena: [
    { value: "prihravky", label: "Přihrávky" },
    { value: "strelba", label: "Střelba" },
    { value: "dribling", label: "Dribling" },
    { value: "obrana", label: "Obranná postavení" },
    { value: "pohyb_bez_mice", label: "Pohyb bez míče" },
  ],
  volejbal: [
    { value: "odbiti_spodem", label: "Odbití spodem" },
    { value: "odbiti_vrchem", label: "Odbití vrchem" },
    { value: "prihravka", label: "Přihrávka" },
    { value: "podani", label: "Podání" },
    { value: "hra_v_poli", label: "Hra v poli / krytí" },
    { value: "nahravka", label: "Nahrávka" },
    { value: "smeč", label: "Základy útočného úderu" },
  ],
  florbal: [
    { value: "vedeni_micku", label: "Vedení míčku" },
    { value: "prihravky", label: "Přihrávky" },
    { value: "strelba", label: "Střelba" },
    { value: "obrana", label: "Obrana / bránění" },
    { value: "pozicni_hra", label: "Poziční hra" },
  ],
  vybijena: [
    { value: "hazeni", label: "Házení" },
    { value: "chytani", label: "Chytání" },
    { value: "taktika", label: "Taktika (cílení, krytí)" },
    { value: "spoluprace", label: "Spolupráce" },
    { value: "reakce", label: "Reakční rychlost" },
  ],
  prehazovana: [
    { value: "hazeni", label: "Házení" },
    { value: "chytani", label: "Chytání" },
    { value: "umistení_mice", label: "Umísťování míče" },
    { value: "spoluprace", label: "Spolupráce" },
  ],
  frisbee: [
    { value: "hazeni", label: "Hody frisbee" },
    { value: "chytani", label: "Chytání" },
    { value: "taktika", label: "Taktika (stack, zóny)" },
    { value: "spoluprace", label: "Spolupráce / komunikace" },
  ],
  kinball: [
    { value: "spoluprace", label: "Týmová spolupráce" },
    { value: "postaveni", label: "Postavení / rozmístění" },
    { value: "komunikace", label: "Komunikace" },
    { value: "pohyb_k_mici", label: "Pohyb k míči" },
  ],
  tchoukball: [
    { value: "hazeni", label: "Hody na odraznou síť" },
    { value: "chytani_odrazu", label: "Chytání odraženého míče" },
    { value: "pohyb_po_hristi", label: "Pohyb po hřišti" },
    { value: "obranna_pozice", label: "Obranné postavení" },
  ],
  netball: [
    { value: "prihravky_chytani", label: "Přihrávky a chytání" },
    { value: "pohyb_bez_mice", label: "Pohyb bez míče / uvolňování" },
    { value: "strelba_na_kos", label: "Střelba na koš" },
    { value: "taktika_rozestaveni", label: "Taktika a rozestavení" },
    { value: "tymova_spoluprace", label: "Týmová spolupráce" },
  ],
  ringtenis: [
    { value: "nahoz_odhoz", label: "Nához a odhoz kroužku" },
    { value: "umistení", label: "Umísťování do prostoru" },
    { value: "spoluprace", label: "Dvojice / spolupráce" },
  ],
  rugby_tag: [
  { value: "prihravky", label: "Přihrávky / nahrávky" },
  { value: "behani", label: "Běhání s míčem / bez míče" },
  { value: "obrana", label: "Obrana / značení hráče" },
  { value: "prihravka", label: "Předávka míče (tag)" },
  { value: "spoluprace", label: "Spolupráce v týmu" },
  ],
  nohejbal: [
    { value: "prijem", label: "Příjem" },
    { value: "nahravka", label: "Nahrávka" },
    { value: "odpal", label: "Odpaly / útok" },
  ],
  pálkované_hry: [
    { value: "odpal", label: "Odpal" },
    { value: "beh_na_metach", label: "Běh na metách" },
    { value: "chytani", label: "Chytání míče" },
  ],
  korfbal: [
    { value: "prihravky", label: "Přihrávky" },
    { value: "strelba", label: "Střelba" },
    { value: "blokovani", label: "Blokování / obrana" },
  ],
};

// --- ATLETIKA ---
const ATHLETICS = ["beh","skoky","hody","koordinace"] as const;
type Athletics = typeof ATHLETICS[number];

const ATHLETICS_LABEL: Record<Athletics,string> = {
  beh: "Běhy",
  skoky: "Skoky",
  hody: "Hody a vrhy",
  koordinace: "Koordinace",
};

const ATHLETICS_CONTENT: Record<Athletics, { value: string; label: string }[]> = {
  beh: [
    { value: "beh_obecne", label: "Běh (obecně)" },
    { value: "sprinty", label: "Sprinty (krátké tratě)" },
    { value: "vytrvalost", label: "Vytrvalostní běh" },
    { value: "stafety", label: "Štafety (předávky)" },
    { value: "intervaly", label: "Intervalový běh" },
  ],
  skoky: [
    { value: "skok_daleky",   label: "Skok do dálky" },
    { value: "skok_z_mista",  label: "Skok do dálky z místa" },
    { value: "viceskoky",     label: "Víceskoky" },
    { value: "prekazky",      label: "Překážkový běh / překonávání překážek" },
  ],
  hody: [
    { value: "hod_mickem",       label: "Hod míčkem" },
    { value: "hod_medicinbalem", label: "Hod medicinbalem" },
    { value: "vrhy",             label: "Vrhy / hody (obecně)" },
    { value: "hod_na_cil",       label: "Hod na cíl" },
  ],
  koordinace: [
    { value: "atleticka_abeceda", label: "Atletická abeceda" },
    { value: "koord_hry",         label: "Koordinační hry" },
    { value: "agility_hry",       label: "Agility (žebřík, kužely…)" },
    { value: "reakcni_starty",    label: "Reakční starty / rozběhy" },
  ],
};

// --- GYMNASTIKA ---
const GYM = ["zakladni_gym","akrobacie","rovnovaha","lezeni_splh","posilovani_kompenzace"] as const;
type Gym = typeof GYM[number];

const GYM_LABEL: Record<Gym,string> = {
  zakladni_gym: "Základní gymnastika",
  akrobacie: "Akrobacie",
  rovnovaha: "Rovnováha",
  lezeni_splh: "Lezení / šplh",
  posilovani_kompenzace: "Posilování a kompenzace",
};

const GYM_CONTENT: Record<Gym, { value: string; label: string }[]> = {
  zakladni_gym: [
    { value: "kotoul_vpred_vzad", label: "Kotoul vpřed/vzad" },
    { value: "rovnovazne_polohy", label: "Rovnovážné polohy / stoj" },
    { value: "prechody",          label: "Základy přechodů a přepadů" },
  ],
  akrobacie: [
    { value: "pady",         label: "Bezpečné pády" },
    { value: "premety",      label: "Základy přemetů" },
    { value: "most_stojka",  label: "Most / stojka u stěny" },
  ],
  rovnovaha: [
    { value: "lavljena_kladina", label: "Chůze po lavičce/kladině" },
    { value: "balanc_pomucky",   label: "Balanční pomůcky" },
  ],
  lezeni_splh: [
    { value: "splh_lano_tyc", label: "Šplh na laně/tyči" },
    { value: "hrazda_zebriny", label: "Hrazda/žebřiny – přítahy, visy" },
  ],
  posilovani_kompenzace: [
    { value: "vlastni_vaha", label: "Posilování s vlastní vahou" },
    { value: "kompenzacni",  label: "Kompenzační cvičení" },
    { value: "core",         label: "Střed těla (CORE)" },
  ],
};

// --- ÚPOLY ---
const UPOLY = ["bezpecne_pady","uchopy_chvaty","pretahy_pretlaky","obranna_postaveni","kooperace_sila"] as const;
type Upoly = typeof UPOLY[number];

const UPOLY_LABEL: Record<Upoly,string> = {
  bezpecne_pady: "Bezpečné pády",
  uchopy_chvaty: "Úchopy a chvaty",
  pretahy_pretlaky: "Přetahy a přetlaky",
  obranna_postaveni: "Obranné postavení",
  kooperace_sila: "Kooperační hry na sílu",
};

const UPOLY_CONTENT: Record<Upoly, { value: string; label: string }[]> = {
  bezpecne_pady: [
    { value: "pad_vpred", label: "Pád vpřed" },
    { value: "pad_vzad",  label: "Pád vzad" },
    { value: "pad_bokem", label: "Pád bokem" },
  ],
  uchopy_chvaty: [
    { value: "zakladni_uchopy",   label: "Základní úchopy" },
    { value: "uvolneni_z_uchopu", label: "Uvolnění z úchopů" },
  ],
  pretahy_pretlaky: [
    { value: "pretahy_v_paru", label: "Přetahy v páru" },
    { value: "pretlaky_v_paru", label: "Přetlaky v páru" },
  ],
  obranna_postaveni: [
    { value: "obranna_pozice", label: "Obranné postavení" },
    { value: "prace_nohou",    label: "Práce nohou / odstupy" },
  ],
  kooperace_sila: [
    { value: "kooperacni_hry_sila", label: "Kooperační hry na sílu" },
    { value: "tahy_tlaky",          label: "Tahy a tlaky – bezpečně" },
  ],
};

/* ===================== REACT KOMPONENTA ===================== */

export default function App() {
  /* --- Identifikace --- */
  const [schoolType, setSchoolType]   = useState<"" | "tandem5" | "tandem2" | "notandem">("");
  const [schoolId,   setSchoolId]     = useState<"" | SchoolId>("");
  const [teacher,    setTeacher]      = useState("");
  const [classId,    setClassId]      = useState("");
  const [place,      setPlace]        = useState<"tělocvična"|"hřiště"|"venku"|"jiné"|"">("");
  const [placeOther, setPlaceOther]   = useState("");

  /* --- Úvodní část --- */
  const [warmup, setWarmup] = useState("");

  /* --- Hlavní část --- */
  // Oblasti (fixní 4 + „jiná oblast“)
  const AREAS = ["sportovni_hry","atletika","gymnastika","upoly"] as const;
  type Area = typeof AREAS[number];
  const AREA_LABEL: Record<Area,string> = {
    sportovni_hry: "Sportovní hry",
    atletika:      "Atletika",
    gymnastika:    "Gymnastika",
    upoly:         "Úpoly",
  };

  const [area,       setArea]       = useState<"" | Area | "other">("");
  const [areaOther,  setAreaOther]  = useState("");     // text pro „Jiná oblast“
  const [discipline, setDiscipline] = useState("");     // konkrétní hra/okruh nebo „other“
  const [discOther,  setDiscOther]  = useState("");     // text pro „Jiná disciplína“
  const [focus,      setFocus]      = useState("");     // co se dělo (nebo „other“)
  const [focusOther, setFocusOther] = useState("");     // text pro „Jiná činnost“
  const [character,  setCharacter]  = useState("");     // 6 typů
  const [leader,     setLeader]     = useState<"" | "ucitel" | "tandem" | "trener" | "zak">("");

  // Datum pro záznam
  const [date] = useState(() => new Date().toLocaleString("cs-CZ"));

  /* --- Odvozené (Identifikace) --- */
  const filteredSchools = useMemo(() => {
    if (!schoolType) return [];
    const allowed = SCHOOLS_BY_TYPE[schoolType];
    return ALL_SCHOOLS.filter((s) => allowed.includes(s.id));
  }, [schoolType]);

  const teacherOptions = useMemo(() => {
    if (!schoolId) return [];
    return ALL_SCHOOLS.find((s) => s.id === schoolId)?.teachers ?? [];
  }, [schoolId]);

  const isLeaderLockedToTeacher = schoolType === "notandem";

  /* --- Odvozené (Hlavní část) — seznam disciplín dle zvolené oblasti --- */
  const disciplineOptions = useMemo(() => {
    if (area === "other" || !area) return [];
    switch (area) {
      case "sportovni_hry": return GAMES.map(g => ({ value: g, label: GAME_LABEL[g] }));
      case "atletika":      return ATHLETICS.map(a => ({ value: a, label: ATHLETICS_LABEL[a] }));
      case "gymnastika":    return GYM.map(g => ({ value: g, label: GYM_LABEL[g] }));
      case "upoly":         return UPOLY.map(u => ({ value: u, label: UPOLY_LABEL[u] }));
      default:              return [];
    }
  }, [area]);

  /* --- Odvozené (Hlavní část) — seznam zaměření dle disciplíny --- */
  const focusOptions = useMemo(() => {
    if (!discipline || area === "other") return [];
    if (discipline === "other") return [];
    switch (area) {
      case "sportovni_hry":
        return GAME_CONTENT[discipline as any] ?? [];
      case "atletika":
        return ATHLETICS_CONTENT[discipline as any] ?? [];
      case "gymnastika":
        return GYM_CONTENT[discipline as any] ?? [];
      case "upoly":
        return UPOLY_CONTENT[discipline as any] ?? [];
      default:
        return [];
    }
  }, [area, discipline]);

  /* --- Reset závislostí při změnách --- */
  const onChangeSchoolType = (val: "" | "tandem5" | "tandem2" | "notandem") => {
    setSchoolType(val);
    setSchoolId("");
    setTeacher("");
    // Bez tandemu = vede učitel pevně
    if (val === "notandem") setLeader("ucitel");
    else setLeader("");
  };

  const onChangeArea = (val: "" | Area | "other") => {
    setArea(val);
    setAreaOther("");
    setDiscipline("");
    setDiscOther("");
    setFocus("");
    setFocusOther("");
    setCharacter("");
    if (schoolType !== "notandem") setLeader("");
  };

  const onChangeDiscipline = (val: string) => {
    setDiscipline(val);
    setDiscOther("");
    setFocus("");
    setFocusOther("");
    setCharacter("");
  };

  const onChangeFocus = (val: string) => {
    setFocus(val);
    if (val !== "other") setFocusOther("");
    setCharacter("");
  };

  /* --- Utility pro labely do náhledu --- */
  const schoolLabel = (id: string) => ALL_SCHOOLS.find(s => s.id === id)?.name ?? "";

  const areaLabel = (a: typeof area, other: string): string => {
    if (!a) return "";
    if (a === "other") return other || "(jiná oblast – prázdná)";
    return AREA_LABEL[a as Area] ?? String(a);
    };

  const disciplineLabel = (a: typeof area, d: string, dOther: string): string => {
    if (!a || !d) return "";
    if (d === "other") return dOther || "(jiná disciplína – prázdná)";
    switch (a) {
      case "sportovni_hry": return GAME_LABEL[d as any] ?? d;
      case "atletika":      return ATHLETICS_LABEL[d as any] ?? d;
      case "gymnastika":    return GYM_LABEL[d as any] ?? d;
      case "upoly":         return UPOLY_LABEL[d as any] ?? d;
      default: return d;
    }
  };

  const focusPretty = (a: typeof area, d: string, f: string, fOther: string): string => {
    if (!a || !d || !f) return "";
    if (f === "other") return fOther || "(jiná činnost – prázdná)";
    const list =
      a === "sportovni_hry" ? GAME_CONTENT[d as any] :
      a === "atletika"      ? ATHLETICS_CONTENT[d as any] :
      a === "gymnastika"    ? GYM_CONTENT[d as any] :
      a === "upoly"         ? UPOLY_CONTENT[d as any] : [];
    return list.find(x => x.value === f)?.label ?? f;
  };

  /* --- Validace odeslání --- */
  const isMainFilled =
    (area && (area !== "other" ? !!discipline : !!areaOther.trim())) &&
    (discipline !== "other" ? !!focus : true) &&
    ((discipline === "other") || (focus !== "other" ? true : !!focusOther.trim()));

  const canSubmit =
    !!schoolType &&
    !!schoolId &&
    !!teacher &&
    !!classId &&
    !!place &&
    (place !== "jiné" ? true : !!placeOther.trim()) &&
    !!warmup &&
    isMainFilled &&
    !!character &&
    (!!leader || isLeaderLockedToTeacher);

  /* ===================== UI ===================== */

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold">Tělesný zápis</h1>
          <span className="text-xs text-gray-500">prototyp • {new Date(date).toLocaleString?.("cs-CZ") || date}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========== Levý sloupec – FORMULÁŘ ========== */}
        <section className="bg-white rounded-lg shadow border p-4 space-y-6">
          {/* Identifikace */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Identifikace hodiny</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Typ školy */}
              <div>
                <label className="block text-sm font-medium mb-1">Typ školy</label>
                <select
                  className="w-full border rounded p-2"
                  value={schoolType}
                  onChange={(e) => onChangeSchoolType(e.target.value as any)}
                >
                  <option value="">Vyberte</option>
                  <option value="tandem5">Tandem 5× týdně</option>
                  <option value="tandem2">Tandem 2× týdně</option>
                  <option value="notandem">Bez tandemu</option>
                </select>
              </div>

              {/* Škola */}
              <div>
                <label className="block text-sm font-medium mb-1">Škola</label>
                <select
                  className="w-full border rounded p-2"
                  value={schoolId}
                  onChange={(e) => { setSchoolId(e.target.value as SchoolId); setTeacher(""); }}
                  disabled={!schoolType}
                >
                  <option value="">{schoolType ? "Vyberte školu" : "Nejprve zvolte typ školy"}</option>
                  {filteredSchools.map((s) => (
                    <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
                  ))}
                </select>
              </div>

              {/* Učitel */}
              <div>
                <label className="block text-sm font-medium mb-1">Učitel</label>
                <select
                  className="w-full border rounded p-2"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  disabled={!schoolId}
                >
                  <option value="">{schoolId ? "Vyberte učitele" : "Nejprve zvolte školu"}</option>
                  {teacherOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Třída */}
              <div>
                <label className="block text-sm font-medium mb-1">Třída</label>
                <input
                  className="w-full border rounded p-2"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  placeholder="např. 3.A"
                />
              </div>

              {/* Místo */}
              <div>
                <label className="block text-sm font-medium mb-1">Místo</label>
                <select
                  className="w-full border rounded p-2"
                  value={place}
                  onChange={(e) => setPlace(e.target.value as any)}
                >
                  <option value="">Vyberte</option>
                  <option value="tělocvična">Tělocvična</option>
                  <option value="hřiště">Hřiště</option>
                  <option value="venku">Venku</option>
                  <option value="jiné">Jiné</option>
                </select>
              </div>

              {place === "jiné" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Popis místa (jiné)</label>
                  <input
                    className="w-full border rounded p-2"
                    value={placeOther}
                    onChange={(e) => setPlaceOther(e.target.value)}
                    placeholder="Krátký popis místa"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Úvodní část – zahřátí */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Úvodní část – zahřátí</h2>
            <select
              className="w-full border rounded p-2"
              value={warmup}
              onChange={(e) => setWarmup(e.target.value)}
            >
              <option value="">Vyberte variantu zahřátí</option>
              {WARMUPS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          {/* Hlavní část */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Hlavní část</h2>

            {/* 0) OBLAST */}
            <label className="block text-sm font-medium mb-1">Oblast / sport</label>
            <select
              className="w-full border rounded p-2"
              value={area}
              onChange={(e) => onChangeArea(e.target.value as any)}
            >
              <option value="">Vyberte oblast</option>
              <option value="sportovni_hry">Sportovní hry</option>
              <option value="atletika">Atletika</option>
              <option value="gymnastika">Gymnastika</option>
              <option value="upoly">Úpoly</option>
              <option value="other">Jiná oblast (doplňte ručně)</option>
            </select>

            {area === "other" && (
              <input
                className="mt-2 w-full border rounded p-2"
                placeholder="Zadejte jinou oblast / sport…"
                value={areaOther}
                onChange={(e) => setAreaOther(e.target.value)}
              />
            )}

            {/* 1) DISCIPLÍNA / HRA */}
            {area && (
              <>
                <label className="block text-sm font-medium mt-4 mb-1">
                  {area === "sportovni_hry" ? "Sportovní hra" :
                   area === "atletika"      ? "Atletická disciplína" :
                   area === "gymnastika"    ? "Gymnastická oblast" :
                   area === "upoly"         ? "Úpoly – oblast" :
                   "Disciplína / hra"}
                </label>

                {/* Pokud je zvolena jiná oblast, rovnou nabídneme „jinou disciplínu“ (pole) */}
                {area === "other" ? (
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Zadejte disciplínu / hru…"
                    value={discOther}
                    onChange={(e) => setDiscOther(e.target.value)}
                  />
                ) : (
                  <>
                    <select
                      className="w-full border rounded p-2"
                      value={discipline}
                      onChange={(e) => onChangeDiscipline(e.target.value)}
                    >
                      <option value="">Vyberte</option>
                      {disciplineOptions.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                      <option value="other">Jiná disciplína (doplňte ručně)</option>
                    </select>
                    {discipline === "other" && (
                      <input
                        className="mt-2 w-full border rounded p-2"
                        placeholder="Zadejte jinou disciplínu / hru…"
                        value={discOther}
                        onChange={(e) => setDiscOther(e.target.value)}
                      />
                    )}
                  </>
                )}
              </>
            )}

            {/* 2) CO SE DĚLO (ZAMĚŘENÍ) */}
            {(area && ((area === "other" && discOther.trim()) || (area !== "other" && discipline))) && (
              <>
                <label className="block text_sm font-medium mt-4 mb-1">Co se dělo (zaměření)</label>

                {(area === "other" || discipline === "other") ? (
                  <input
                    className="w-full border rounded p-2"
                    placeholder="Popište činnost / zaměření…"
                    value={focusOther}
                    onChange={(e) => setFocusOther(e.target.value)}
                  />
                ) : (
                  <>
                    <select
                      className="w-full border rounded p-2"
                      value={focus}
                      onChange={(e) => onChangeFocus(e.target.value)}
                    >
                      <option value="">Vyberte zaměření</option>
                      {focusOptions.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                      <option value="other">Jiná (doplňte ručně)</option>
                    </select>

                    {focus === "other" && (
                      <input
                        className="mt-2 w-full border rounded p-2"
                        placeholder="Popište jinou činnost…"
                        value={focusOther}
                        onChange={(e) => setFocusOther(e.target.value)}
                      />
                    )}
                  </>
                )}
              </>
            )}

            {/* 3) CHARAKTER ČINNOSTI */}
            {((area === "other" && discOther.trim() && focusOther.trim()) ||
              (area !== "other" && ((discipline === "other" && discOther.trim()) || (discipline && (focus === "other" ? focusOther.trim() : focus))))) && (
              <>
                <label className="block text-sm font-medium mt-4 mb-1">Charakter činnosti</label>
                <select
                  className="w-full border rounded p-2"
                  value={character}
                  onChange={(e) => setCharacter(e.target.value)}
                >
                  <option value="">Vyberte</option>
                  {CHARACTERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </>
            )}

            {/* 4) KDO VEDL */}
            {character && (
              <>
                <div className="flex items-center justify-between mt-4">
                  <label className="block text-sm font-medium">Kdo vedl</label>
                  {isLeaderLockedToTeacher && (
                    <span className="text-xs text-gray-500">Bez tandemu – vede učitel(ka)</span>
                  )}
                </div>
                <select
                  className="w-full border rounded p-2 disabled:bg-gray-100 disabled:text-gray-500"
                  value={leader}
                  onChange={(e) => setLeader(e.target.value as any)}
                  disabled={isLeaderLockedToTeacher}
                >
                  <option value="">{isLeaderLockedToTeacher ? "Učitel (pevně)" : "Vyberte"}</option>
                  <option value="ucitel">Učitel</option>
                  {!isLeaderLockedToTeacher && (
                    <>
                      <option value="tandem">Tandem</option>
                      <option value="trener">Trenér</option>
                      <option value="zak">Žák</option>
                    </>
                  )}
                </select>
              </>
            )}
          </div>
        </section>

        {/* ========== Pravý sloupec – NÁHLED ========== */}
        <aside className="bg-white rounded-lg shadow border p-4">
          <h2 className="text-lg font-semibold mb-3">Náhled záznamu</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Datum:</span> {date}</p>
            <p><span className="font-medium">Typ školy:</span> {schoolType ? SCHOOL_TYPE_LABEL[schoolType] : "—"}</p>
            <p><span className="font-medium">Škola:</span> {schoolId ? `${schoolId} — ${schoolLabel(schoolId)}` : "—"}</p>
            <p><span className="font-medium">Učitel:</span> {teacher || "—"}</p>
            <p><span className="font-medium">Třída:</span> {classId || "—"}</p>
            <p>
              <span className="font-medium">Místo:</span>{" "}
              {place ? (place === "jiné" ? `Jiné — ${placeOther || "bez popisu"}` : place) : "—"}
            </p>
            <hr className="my-2" />
            <p><span className="font-medium">Zahřátí:</span> {warmup || "—"}</p>
            <hr className="my-2" />
            <p><span className="font-medium">Oblast:</span> {area ? areaLabel(area, areaOther) : "—"}</p>
            <p><span className="font-medium">Disciplína / hra:</span> {disciplineLabel(area, discipline, discOther) || "—"}</p>
            <p><span className="font-medium">Zaměření:</span> {focusPretty(area, discipline, focus, focusOther) || "—"}</p>
            <p><span className="font-medium">Charakter:</span> {character ? CHARACTER_LABEL[character] : "—"}</p>
            <p><span className="font-medium">Vedl:</span> {leader || (isLeaderLockedToTeacher ? "ucitel" : "—")}</p>
          </div>
          <button
            className="mt-4 w-full md:w-auto px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
            disabled={!canSubmit}
            onClick={async () => {
              console.log("Kliknuto – odesílám data…");
              const payload = {
                schoolType,
                schoolId,
                teacher,
                classId,
                place,
                placeOther,
                warmup,
                area,
                discipline,
                disciplineOther: discOther, // << z Reactu se jmenuje discOther
                focus,
                focusOther, // << zůstává stejné
                character,
                leader,
              };

              try {
                const response = await fetch(
                  WEB_APP_URL,
                  {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: "data=" + encodeURIComponent(JSON.stringify(payload)),
                  }
                );

                console.log("Fetch dokončen", response);
                alert("✅ Záznam byl odeslán do Google Sheets!");
              } catch (error) {
                console.error("Chyba při fetch:", error);
                alert("❌ Nepodařilo se odeslat data. Zkontrolujte připojení nebo Google Script.");
              }
            }}
          >
            Odeslat záznam do Google Sheets
          </button>
        </aside>
      </main>
    </div>
  );
}
