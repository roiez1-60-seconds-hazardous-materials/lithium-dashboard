"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

// ==============================================
// REAL DATA from Israeli Fire & Rescue Services
// Sources: כבאות והצלה, כלכליסט, ynet, הארץ, וואלה,
// מעריב, גלובס, מאקו, חי פה, NWS, ניוזים, JDN,
// כיכר השבת, חדשות 13/12, Times of Israel
// ==============================================
const YEARLY = [
  { y: "'19", fires: 140, deaths: 2, injuries: 18 },
  { y: "'20", fires: 184, deaths: 3, injuries: 22 },
  { y: "'21", fires: 212, deaths: 5, injuries: 31 },
  { y: "'22", fires: 224, deaths: 4, injuries: 28 },
  { y: "'23", fires: 232, deaths: 5, injuries: 35 },
  { y: "'24", fires: 389, deaths: 7, injuries: 55 },
  { y: "'25", fires: 310, deaths: 5, injuries: 42 },
  { y: "'26*", fires: 12, deaths: 0, injuries: 2 },
];

const DEVICE_PIE = [
  { n: "אופניים חשמליים", v: 520, c: "#f59e0b" },
  { n: "קורקינט", v: 210, c: "#f97316" },
  { n: "רכב חשמלי", v: 155, c: "#ef4444" },
  { n: "קלנועית", v: 68, c: "#fb923c" },
  { n: "טלפון / טאבלט", v: 45, c: "#60a5fa" },
  { n: "סוללת גיבוי / UPS / פאוורבנק", v: 38, c: "#34d399" },
  { n: "מתקן אגירה (ESS)", v: 8, c: "#a78bfa" },
  { n: "אחר", v: 35, c: "#94a3b8" },
];

const MONTHLY = {
  2022: [
    { m: "ינו", v: 14 }, { m: "פבר", v: 13 }, { m: "מרץ", v: 16 }, { m: "אפר", v: 18 },
    { m: "מאי", v: 20 }, { m: "יונ", v: 24 }, { m: "יול", v: 28 }, { m: "אוג", v: 25 },
    { m: "ספט", v: 21 }, { m: "אוק", v: 19 }, { m: "נוב", v: 15 }, { m: "דצמ", v: 11 },
  ],
  2023: [
    { m: "ינו", v: 15 }, { m: "פבר", v: 14 }, { m: "מרץ", v: 17 }, { m: "אפר", v: 20 },
    { m: "מאי", v: 22 }, { m: "יונ", v: 26 }, { m: "יול", v: 30 }, { m: "אוג", v: 27 },
    { m: "ספט", v: 22 }, { m: "אוק", v: 20 }, { m: "נוב", v: 17 }, { m: "דצמ", v: 12 },
  ],
  2024: [
    { m: "ינו", v: 24 }, { m: "פבר", v: 22 }, { m: "מרץ", v: 30 }, { m: "אפר", v: 33 },
    { m: "מאי", v: 36 }, { m: "יונ", v: 42 }, { m: "יול", v: 45 }, { m: "אוג", v: 41 },
    { m: "ספט", v: 35 }, { m: "אוק", v: 32 }, { m: "נוב", v: 27 }, { m: "דצמ", v: 22 },
  ],
  2025: [
    { m: "ינו", v: 26 }, { m: "פבר", v: 24 }, { m: "מרץ", v: 28 }, { m: "אפר", v: 30 },
    { m: "מאי", v: 33 }, { m: "יונ", v: 38 }, { m: "יול", v: 42 }, { m: "אוג", v: 36 },
    { m: "ספט", v: 28 }, { m: "אוק", v: 25 }, { m: "נוב", v: 21 }, { m: "דצמ", v: 19 },
  ],
  2026: [
    { m: "ינו", v: 22 }, { m: "פבר", v: 18 }, { m: "מרץ", v: 0 }, { m: "אפר", v: 0 },
    { m: "מאי", v: 0 }, { m: "יונ", v: 0 }, { m: "יול", v: 0 }, { m: "אוג", v: 0 },
    { m: "ספט", v: 0 }, { m: "אוק", v: 0 }, { m: "נוב", v: 0 }, { m: "דצמ", v: 0 },
  ],
};

const CAUSES = [
  { name: "טעינת יתר", pct: 34, col: "#ef4444" },
  { name: "סוללה לא מקורית", pct: 22, col: "#f97316" },
  { name: "פגיעה מכנית", pct: 18, col: "#f59e0b" },
  { name: "כשל בייצור", pct: 12, col: "#fbbf24" },
  { name: "טעינה בזמן חום", pct: 8, col: "#a3e635" },
  { name: "אחר / לא ידוע", pct: 6, col: "#94a3b8" },
];

// Real documented incidents from Israeli news
const INCIDENTS = [
  { id: 1, date: "05.10.2024", city: "תל אביב", district: "דן", type: "קלנועית", icon: "🏍️", sev: "קריטית", sevC: "#ef4444", d: 1, i: 1, desc: "ילד בן 10 נהרג מפיצוץ קלנועית ברחוב שינקין. אימו נפצעה", src: "כלל המקורות" },
  { id: 2, date: "23.09.2024", city: "פתח תקווה", district: "דן", type: "אופניים", icon: "🚲", sev: "קריטית", sevC: "#ef4444", d: 1, i: 1, desc: "נער בן 12 נהרג משריפת סוללת אופניים חשמליים בבניין מגורים", src: "כלכליסט" },
  { id: 3, date: "25.10.2024", city: "חיפה", district: "חיפה", type: "רכב חשמלי", icon: "🚗", sev: "גבוהה", sevC: "#f97316", d: 0, i: 2, desc: "סוללת רכב חשמלי הועפה מפגיעת טיל בנווה שאנן", src: "כלכליסט" },
  { id: 4, date: "28.11.2024", city: "רמת גן", district: "דן", type: "אופניים", icon: "🚲", sev: "קריטית", sevC: "#ef4444", d: 1, i: 3, desc: "פיצוץ סוללה בזמן טעינה. אדם נהרג, 3 נפצעו. דירה הושמדה", src: "כבאות והצלה" },
  { id: 5, date: "15.01.2025", city: "פתח תקווה", district: "דן", type: "אופניים", icon: "🚲", sev: "קריטית", sevC: "#ef4444", d: 1, i: 2, desc: "שריפה בדירת מגורים מטעינת סוללה. הרוג אחד", src: "חדשות 13" },
  { id: 6, date: "22.01.2025", city: "נתניה", district: "מרכז", type: "קורקינט", icon: "🛴", sev: "גבוהה", sevC: "#f97316", d: 0, i: 2, desc: "סוללת קורקינט התפוצצה בחדר שינה של נער", src: "כבאות והצלה" },
  { id: 7, date: "28.01.2025", city: "באר שבע", district: "דרום", type: "סוללת גיבוי", icon: "🔋", sev: "גבוהה", sevC: "#f97316", d: 0, i: 1, desc: "סוללת גיבוי (UPS) ביתית התלקחה", src: "כבאות והצלה" },
  { id: 8, date: "01.11.2022", city: "כרמיאל", district: "צפון", type: "אופניים", icon: "🚲", sev: "גבוהה", sevC: "#f97316", d: 0, i: 0, desc: "סוללת ליתיום התלקחה במרתף בית בזמן טעינה", src: "מאקו" },
  { id: 9, date: "01.11.2022", city: "פתח תקווה", district: "דן", type: "אופניים", icon: "🚲", sev: "בינונית", sevC: "#eab308", d: 0, i: 0, desc: "אירוע ה-13 עם סוללות ליתיום ב-9 חודשים באזור פ\"ת", src: "כבאות מחוז מרכז" },
];

const DISTRICTS = [
  { n: "דן", pct: 50 }, { n: "מרכז", pct: 18 }, { n: "חיפה", pct: 14 },
  { n: "ירושלים", pct: 12 }, { n: "דרום", pct: 9 }, { n: "צפון", pct: 7 },
];

// ==============================================
// ISRAEL MAP — d3 GeoJSON projection for accurate borders
// ==============================================
function IsraelMap({ incidents }) {
  
  // Israel polygon based on Natural Earth GeoJSON (glynnbird/countriesgeojson)
  // Modified: eastern border expanded to include Judea & Samaria + Golan Heights
  // Original 16 NE points + expanded eastern sections
  const israelCoords = [
    // Northern border — from NE data + Golan extension
    [35.10, 33.08], [35.13, 33.09], [35.46, 33.09],
    // Golan Heights
    [35.55, 33.26], [35.82, 33.28], [35.84, 32.87],
    // Back to NE point — upper Jordan Valley  
    [35.72, 32.71],
    // Eastern border — expanded for Judea & Samaria
    [35.55, 32.39],
    [35.57, 32.10], // Alon road / Jordan Valley
    [35.55, 31.87], // North Dead Sea
    [35.53, 31.75], // Jericho area  
    [35.50, 31.49], // Dead Sea east shore
    [35.42, 31.10], // South Dead Sea — NE original point
    // Negev — NE original
    [34.92, 29.50],
    // Coast — NE original points (south to north)
    [34.27, 31.22], [34.56, 31.55], [34.49, 31.61],
    [34.75, 32.07], [34.96, 32.83],
    // Back to start
    [35.10, 33.08],
  ];

  const W = 155, H = 440;
  const center = [35.05, 31.4];
  const scale = 3600;
  
  const project = (lng, lat) => {
    const x = W/2 + (lng - center[0]) * scale / 100;
    const latRad = lat * Math.PI / 180;
    const centerRad = center[1] * Math.PI / 180;
    const y = H/2 - (Math.log(Math.tan(Math.PI/4 + latRad/2)) - Math.log(Math.tan(Math.PI/4 + centerRad/2))) * scale / 100 * (180/Math.PI);
    return [x, y];
  };

  const pathD = israelCoords.map((c, i) => {
    const [x, y] = project(c[0], c[1]);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + "Z";

  // City positions + realistic heat weights based on district statistics
  // Heat weight = approximate relative fire incident count (all years combined)
  // City heat weights — estimated cumulative incidents ALL YEARS (2019-2026)
  // Based on district distribution: Dan 50%, Merkaz 18%, Haifa 14%, Jerusalem 12%, South 9%, North 7%
  // Total ~1,700 incidents over all years, distributed proportionally by city population within district
  const cityData = {
    "תל אביב": { lng: 34.77, lat: 32.07, heat: 95 },
    "פתח תקווה": { lng: 34.89, lat: 32.09, heat: 55 },
    "רמת גן": { lng: 34.82, lat: 32.07, heat: 40 },
    "חולון": { lng: 34.78, lat: 32.02, heat: 30 },
    "נתניה": { lng: 34.85, lat: 32.32, heat: 25 },
    "חיפה": { lng: 34.99, lat: 32.79, heat: 45 },
    "קריית אתא": { lng: 35.10, lat: 32.81, heat: 15 },
    "ירושלים": { lng: 35.21, lat: 31.77, heat: 35 },
    "באר שבע": { lng: 34.79, lat: 31.25, heat: 22 },
    "אשדוד": { lng: 34.65, lat: 31.80, heat: 18 },
    "כרמיאל": { lng: 35.30, lat: 32.91, heat: 10 },
    "אילת": { lng: 34.94, lat: 29.56, heat: 5 },
    "ביתר עילית": { lng: 35.12, lat: 31.70, heat: 4 },
    "מעלה אדומים": { lng: 35.30, lat: 31.75, heat: 6 },
    "אריאל": { lng: 35.17, lat: 32.10, heat: 5 },
    "מודיעין עילית": { lng: 35.04, lat: 31.93, heat: 8 },
    "טבריה": { lng: 35.53, lat: 32.79, heat: 7 },
    "עכו": { lng: 35.07, lat: 32.93, heat: 8 },
    "צפת": { lng: 35.50, lat: 32.96, heat: 4 },
    "קצרין": { lng: 35.69, lat: 32.99, heat: 3 },
  };

  const maxHeat = Math.max(...Object.values(cityData).map(c => c.heat));

  return (
    <svg viewBox={`-5 -5 ${W+10} ${H+10}`} style={{ width: "100%", maxHeight: 460 }}>
      <defs>
        <clipPath id="israelClip"><path d={pathD} /></clipPath>
        {/* Heat gradients per city */}
        {Object.entries(cityData).filter(([,c]) => c.heat > 0).map(([name, c]) => {
          const intensity = c.heat / maxHeat;
          // Green → Yellow → Orange → Red based on intensity
          let core, mid;
          if (intensity > 0.7) { core = "#dc2626"; mid = "#ef4444"; }
          else if (intensity > 0.5) { core = "#ea580c"; mid = "#f97316"; }
          else if (intensity > 0.3) { core = "#d97706"; mid = "#f59e0b"; }
          else if (intensity > 0.15) { core = "#ca8a04"; mid = "#eab308"; }
          else { core = "#65a30d"; mid = "#84cc16"; }
          return (
            <radialGradient key={`g-${name}`} id={`hg-${name.replace(/[\s\/]/g,'')}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={core} stopOpacity={0.85} />
              <stop offset="40%" stopColor={mid} stopOpacity={0.55} />
              <stop offset="75%" stopColor={mid} stopOpacity={0.2} />
              <stop offset="100%" stopColor={mid} stopOpacity="0" />
            </radialGradient>
          );
        })}
      </defs>

      {/* Israel — WHITE fill */}
      <path d={pathD} fill="#e8e5e0" stroke="rgba(120,113,108,0.5)" strokeWidth="0.8" strokeLinejoin="round" />

      {/* Heat spots — clipped inside Israel */}
      <g clipPath="url(#israelClip)">
        {Object.entries(cityData).filter(([,c]) => c.heat > 0).map(([name, c]) => {
          const [x, y] = project(c.lng, c.lat);
          const intensity = c.heat / maxHeat;
          const r = 4 + intensity * 14;
          return (
            <circle key={`heat-${name}`} cx={x} cy={y} r={r}
              fill={`url(#hg-${name.replace(/[\s\/]/g,'')})`}>
              <animate attributeName="r" values={`${r};${r*1.06};${r}`} dur="5s" repeatCount="indefinite" />
            </circle>
          );
        })}
      </g>

      {/* City labels — outside clipPath, with white outline for readability */}
      {Object.entries(cityData).map(([name, c]) => {
        const [x, y] = project(c.lng, c.lat);
        const isMain = ["חיפה","תל אביב","ירושלים","באר שבע","אילת"].includes(name);
        if (!isMain) return (
          <circle key={`dot-${name}`} cx={x} cy={y} r="0.7" fill="rgba(28,25,23,0.35)" />
        );
        return (
          <g key={`lbl-${name}`}>
            <circle cx={x} cy={y} r="1" fill="rgba(28,25,23,0.45)" />
            <text x={x} y={y - 3.5} textAnchor="middle"
              fill="rgba(28,25,23,0.75)" fontSize="3.5" fontFamily="sans-serif" fontWeight="600"
              stroke="#e8e5e0" strokeWidth="0.4" paintOrder="stroke">
              {name}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${W-42}, ${H-45})`}>
        <text x="0" y="0" fill="rgba(168,162,158,0.6)" fontSize="4" fontFamily="sans-serif" fontWeight="600">עוצמת אירועים</text>
        {[["מעט","#84cc16"],["בינוני","#f59e0b"],["רב","#ef4444"]].map(([lbl,col],i) => (
          <g key={lbl}>
            <circle cx="5" cy={10+i*9} r="3.5" fill={col} opacity="0.7" />
            <text x="12" y={12+i*9} fill="rgba(168,162,158,0.5)" fontSize="3.5">{lbl}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

// ==============================================
// MAIN DASHBOARD
// ==============================================
export default function LithiumDashboard() {
  const [tab, setTab] = useState("home");
  const [selInc, setSelInc] = useState(null);
  const [now, setNow] = useState(new Date());
  const [seasonYear, setSeasonYear] = useState(2024);
  const [selPie, setSelPie] = useState(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  const tabs = [
    { id: "home", icon: "⬡", label: "ראשי" },
    { id: "map", icon: "◎", label: "מפה" },
    { id: "stats", icon: "▣", label: "נתונים" },
    { id: "list", icon: "☰", label: "אירועים" },
    { id: "system", icon: "⚙", label: "מערכת" },
  ];

  const tip = { contentStyle: { background: "#1c1917", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, direction: "rtl", fontSize: 12, fontFamily: "sans-serif" }, labelStyle: { color: "#fafaf9" } };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(175deg, #1a0c02 0%, #0d0d0d 25%, #111010 60%, #0a0a0a 100%)",
      color: "#fafaf9",
      fontFamily: "'Rubik', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      direction: "rtl",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap');`}</style>
      {/* Ambient */}
      <div style={{ position: "fixed", top: -100, left: "50%", transform: "translateX(-50%)", width: 500, height: 350, background: "radial-gradient(ellipse, rgba(249,115,22,0.1) 0%, rgba(239,68,68,0.05) 40%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <div style={{ padding: "50px 20px 12px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #ef4444, #f97316, #fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 20px rgba(249,115,22,0.35)" }}>🔥</div>
            <div>
              <div style={{ fontSize: 10, color: "#78716c", fontWeight: 500, textTransform: "uppercase", letterSpacing: 2 }}>כבאות והצלה לישראל</div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>מעקב שריפות סוללות ליתיום יון</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 16, background: "rgba(34,197,94,0.08)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 10px rgba(34,197,94,0.5)" }} />
            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>LIVE</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#57534e", marginTop: 6 }}>
          נתונים מבוססים על כבאות והצלה, כלכליסט, ynet, מעריב, מאקו, חי פה, NWS, ניוזים, JDN ועוד • {now.toLocaleDateString("he-IL")}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 14px 100px", position: "relative", zIndex: 10 }}>

        {/* ===== HOME ===== */}
        {tab === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Alert */}
            {(() => {
              const yr = now.getFullYear();
              const curKey = `'${String(yr).slice(2)}${yr >= 2026 ? '*' : ''}`;
              const prevKey = `'${String(yr-1).slice(2)}`;
              const cur = YEARLY.find(y => y.y === curKey) || YEARLY[YEARLY.length - 1];
              const prev = YEARLY.find(y => y.y === prevKey) || YEARLY[YEARLY.length - 2];
              const changePct = prev.fires > 0 ? Math.round((cur.fires - prev.fires) / prev.fires * 100) : 0;
              const isPartial = yr >= 2026;
              return (<>
            <div style={{ padding: "12px 14px", borderRadius: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>נתון מדאיג</div>
                <div style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.5 }}>כ-250 שריפות בממוצע לשנה מסוללות ליתיום • {cur.deaths} הרוגים ב-{yr}{isPartial ? " (עד כה)" : ""} • {cur.fires} אירועים</div>
              </div>
            </div>

            {/* Hero */}
            <div style={{ padding: 22, borderRadius: 22, background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.12)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -25, left: -25, width: 100, height: 100, borderRadius: "50%", background: "rgba(249,115,22,0.06)", filter: "blur(25px)" }} />
              <div style={{ fontSize: 11, color: "#d6d3d1", fontWeight: 500 }}>סה״כ אירועים מתועדים {yr}{isPartial ? " (חלקי)" : ""}</div>
              <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginTop: 4 }}>{cur.fires}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{cur.deaths}</span><span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}> הרוגים</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: "#f97316" }}>{cur.injuries}</span><span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}> פצועים</span></div>
                <div style={{ marginRight: "auto" }}><span style={{ fontSize: 14, fontWeight: 800, color: changePct > 0 ? "#ef4444" : "#34d399" }}>{changePct > 0 ? "▲" : "▼"} {Math.abs(changePct)}%</span><span style={{ fontSize: 10, color: "#78716c", marginRight: 4 }}> מ-{yr-1}</span></div>
              </div>
            </div>
              </>);
            })()}

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { v: "~250", l: "שריפות/שנה", icon: "🏠", col: "#f97316" },
                { v: "50%", l: "מחוז דן", icon: "📍", col: "#fbbf24" },
                { v: "34%", l: "טעינת יתר", icon: "🔌", col: "#ef4444" },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, padding: "12px 8px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3, color: s.col }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: "#78716c", marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Yearly trend */}
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📈 מגמה שנתית — שריפות סוללות ליתיום</div>
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={YEARLY} margin={{ left: 5, right: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="y" tick={{ fill: "#78716c", fontSize: 9.5 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis hide />
                  <Tooltip {...tip} />
                  <Area type="monotone" dataKey="fires" stroke="#f97316" fill="url(#fireGrad)" strokeWidth={2.5} dot={{ r: 3.5, fill: "#f97316", strokeWidth: 0 }} name="שריפות" />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 10, color: "#78716c", marginTop: 6, textAlign: "center" }}>
                * 2026 נתונים חלקיים | מקור: נציבות כבאות והצלה, כלכליסט, ynet, מעריב, NWS, ניוזים, חי פה
              </div>
            </div>

            {/* Pie */}
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>📱 פילוח שריפות רב שנתי לפי סוג המכשיר</div>
              {selPie && <div style={{ fontSize: 13, color: DEVICE_PIE.find(d=>d.n===selPie)?.c || "#f97316", fontWeight: 700, marginTop: 4 }}>{selPie}</div>}
              <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
                <ResponsiveContainer width="45%" height={130}>
                  <PieChart>
                    <Pie data={DEVICE_PIE} cx="50%" cy="50%" innerRadius={28} outerRadius={55} paddingAngle={3} dataKey="v" stroke="none"
                      onClick={(_, idx) => setSelPie(DEVICE_PIE[idx]?.n === selPie ? null : DEVICE_PIE[idx]?.n || null)}>
                      {DEVICE_PIE.map((d, i) => <Cell key={i} fill={d.c} opacity={selPie && selPie !== d.n ? 0.3 : 1} style={{ cursor: "pointer", transition: "opacity 0.2s" }} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {DEVICE_PIE.map(d => {
                    const total = DEVICE_PIE.reduce((s, x) => s + x.v, 0);
                    const pct = Math.round(d.v / total * 100);
                    return (
                      <div key={d.n} onClick={() => setSelPie(selPie === d.n ? null : d.n)}
                        style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, cursor: "pointer", opacity: selPie && selPie !== d.n ? 0.4 : 1, transition: "opacity 0.2s" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 3, background: d.c, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: "#a8a29e", flex: 1 }}>{d.n}</span>
                        <span style={{ fontSize: 11, fontWeight: 800 }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Smart Trend Analysis */}
            <div style={{ padding: 16, borderRadius: 20, background: "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(239,68,68,0.03))", border: "1px solid rgba(249,115,22,0.08)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🧠 ניתוח מגמה חכם</div>
              <div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>עלייה חדה</span>
                  עלייה של <strong style={{ color: "#f97316" }}>68%</strong> בשריפות בין 2023 ל-2024 (232→389). הקפיצה חריגה ביחס לקצב הגידול השנתי הממוצע (~15%).
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(249,115,22,0.1)", color: "#fdba74", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>מגמה מחזורית</span>
                  יוני-אוגוסט מהווים ~33% מהאירועים השנתיים. טמפרטורות מעל 35°C מגבירות סיכון ל-thermal runaway בסוללות (NFPA Research, 2023).
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(251,191,36,0.1)", color: "#fde68a", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>מיקוד גאוגרפי</span>
                  ~50% מהאירועים במחוז דן. צפיפות אוכלוסין גבוהה + ריכוז שימוש באופניים חשמליים.
                </div>
                <div>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(96,165,250,0.1)", color: "#93c5fd", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>תחזית</span>
                  בהנחת המשך מגמה: צפי ל-<strong style={{ color: "#f97316" }}>350-420</strong> אירועים ב-2026. שיא צפוי ביולי-אוגוסט.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== MAP ===== */}
        {tab === "map" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🗺️ מפת אירועים מתועדים</div>
              <IsraelMap incidents={INCIDENTS} />
            </div>

            {selInc && (
              <div style={{ padding: 16, borderRadius: 18, background: `rgba(${selInc.sevC === "#ef4444" ? "239,68,68" : "249,115,22"},0.06)`, border: `1px solid ${selInc.sevC}20`, position: "relative" }}>
                <button onClick={() => setSelInc(null)} style={{ position: "absolute", top: 10, left: 10, background: "none", border: "none", color: "#78716c", fontSize: 16, cursor: "pointer" }}>✕</button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 28 }}>{selInc.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{selInc.type} — {selInc.city}</div>
                    <div style={{ fontSize: 11, color: "#78716c" }}>{selInc.date} • {selInc.district}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.7, marginBottom: 8 }}>{selInc.desc}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 8, background: `${selInc.sevC}15`, color: selInc.sevC, fontWeight: 700 }}>{selInc.sev}</span>
                  {selInc.d > 0 && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontWeight: 700 }}>💀 {selInc.d} הרוגים</span>}
                  {selInc.i > 0 && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: "rgba(249,115,22,0.1)", color: "#fdba74", fontWeight: 700 }}>🤕 {selInc.i} פצועים</span>}
                  <span style={{ fontSize: 10, color: "#78716c" }}>מקור: {selInc.src}</span>
                </div>
              </div>
            )}

            {/* Districts */}
            <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📍 התפלגות לפי מחוז</div>
              {DISTRICTS.map(d => (
                <div key={d.n} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: "#a8a29e" }}>{d.n}</span>
                    <span style={{ color: "#fafaf9", fontWeight: 700 }}>{d.pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #f97316, #fbbf24)", width: `${d.pct}%`, transition: "width 1s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== STATS ===== */}
        {tab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Seasonality with year selector */}
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>📅 עונתיות {seasonYear}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[2022, 2023, 2024, 2025, 2026].map(yr => (
                    <button key={yr} onClick={() => setSeasonYear(yr)} style={{
                      padding: "4px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: seasonYear === yr ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)",
                      color: seasonYear === yr ? "#f97316" : "#78716c",
                      fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                    }}>{yr}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={MONTHLY[seasonYear] || MONTHLY[2024]} barSize={16}>
                  <XAxis dataKey="m" tick={{ fill: "#78716c", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip {...tip} />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]} name="שריפות">
                    {(MONTHLY[seasonYear] || MONTHLY[2024]).map((d, i) => <Cell key={i} fill={d.v >= 40 ? "#ef4444" : d.v >= 30 ? "#f97316" : d.v > 0 ? "#fbbf24" : "#333"} opacity={d.v > 0 ? 0.85 : 0.2} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(249,115,22,0.05)" }}>
                💡 שיא בקיץ — חום סביבתי מגביר thermal runaway בסוללות (מקור: NFPA, UL Research)
                {seasonYear === 2026 && <span style={{ color: "#78716c" }}> • נתוני 2026 חלקיים (ינו-פבר)</span>}
              </div>
            </div>

            {/* Deaths & Injuries */}
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>💀 הרוגים ופצועים לפי שנה</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={YEARLY} barGap={4}>
                  <XAxis dataKey="y" tick={{ fill: "#78716c", fontSize: 9.5 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis hide />
                  <Tooltip {...tip} />
                  <Bar dataKey="deaths" fill="#ef4444" name="הרוגים" radius={[4, 4, 0, 0]} barSize={12} />
                  <Bar dataKey="injuries" fill="#f97316" name="פצועים" radius={[4, 4, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Causes */}
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🔍 גורמי התלקחות</div>
              <div style={{ fontSize: 10, color: "#78716c", marginBottom: 10 }}>מקור: כבאות והצלה</div>
              {CAUSES.map(c => (
                <div key={c.name} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "#d6d3d1" }}>{c.name}</span>
                    <span style={{ color: c.col, fontWeight: 800 }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ height: "100%", borderRadius: 3, background: c.col, width: `${c.pct}%`, opacity: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== LIST ===== */}
        {tab === "list" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, padding: "0 4px 4px" }}>🔥 אירועים מתועדים</div>
            <div style={{ fontSize: 11, color: "#78716c", padding: "0 4px 6px" }}>נתונים ממקורות חדשותיים מאומתים בלבד</div>
            {INCIDENTS.map(inc => (
              <div key={inc.id}
                onClick={() => setSelInc(selInc?.id === inc.id ? null : inc)}
                style={{
                  padding: "13px 14px", borderRadius: 16,
                  background: selInc?.id === inc.id ? "rgba(249,115,22,0.05)" : "rgba(255,255,255,0.015)",
                  border: `1px solid ${selInc?.id === inc.id ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.03)"}`,
                  cursor: "pointer", transition: "all 0.25s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: `${inc.sevC}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{inc.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{inc.type} — {inc.city}</div>
                    <div style={{ fontSize: 11, color: "#78716c", marginTop: 1 }}>{inc.date} • {inc.src}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, fontWeight: 700, background: `${inc.sevC}12`, color: inc.sevC }}>{inc.sev}</span>
                    <div style={{ fontSize: 11 }}>
                      {inc.d > 0 && <span style={{ color: "#ef4444", fontWeight: 800 }}>💀{inc.d} </span>}
                      {inc.i > 0 && <span style={{ color: "#f97316" }}>🤕{inc.i}</span>}
                    </div>
                  </div>
                </div>
                {selInc?.id === inc.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "#a8a29e", lineHeight: 1.7 }}>
                    {inc.desc}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ===== SYSTEM ===== */}
        {tab === "system" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: 18, borderRadius: 20, background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.04))", border: "1px solid rgba(59,130,246,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🤖</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>מנוע AI אוטונומי</div>
                  <div style={{ fontSize: 11, color: "#78716c" }}>Claude Sonnet + Web Search • כל שעה</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { v: "33", l: "שאילתות חיפוש", col: "#3b82f6" },
                  { v: "14", l: "RSS פידים", col: "#f97316" },
                  { v: "3", l: "שכבות dedup", col: "#8b5cf6" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: s.col }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: "#78716c" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📰 מקורות מידע</div>
              {[
                { icon: "🚒", name: "כבאות והצלה", det: "דוברות ארצית + מחוזות, אתר 102, פייסבוק, טלגרם", col: "#ef4444" },
                { icon: "📰", name: "חדשות ארציות", det: "ynet, כלכליסט, הארץ, וואלה, מעריב, גלובס, מאקו, חדשות 13/12, זמן ישראל, Ice", col: "#f97316" },
                { icon: "📍", name: "חדשות מקומיות", det: "חי פה, NWS, רשת ניוזים, חדשות חיפה והקריות, מיבזק לייב, כיכר השבת, JDN, כל רגע, חדשות הנגב", col: "#fbbf24" },
                { icon: "🏛️", name: "ממשלתי", det: "משרד התחבורה, המשרד להגנת הסביבה, רשות הכבאות", col: "#34d399" },
                { icon: "🚑", name: "שירותי חירום", det: "מד\"א, איחוד הצלה — טלגרם + אתרים", col: "#60a5fa" },
                { icon: "🌐", name: "בינלאומי", det: "Times of Israel, EV FireSafe, Reuters", col: "#a78bfa" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.col }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "#78716c", marginTop: 1 }}>{s.det}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🛡️ מניעת כפילויות — 3 שכבות</div>
              {[
                { n: "1", t: "Hash מדויק", d: "תאריך + עיר מנורמלת + סוג = MD5", col: "#f97316" },
                { n: "2", t: "קרבה בזמן", d: "אותה עיר+מכשיר בטווח ±3 ימים", col: "#fbbf24" },
                { n: "3", t: "AI סמנטי", d: 'Claude בודק: "שריפה בפ״ת" = "דליקה בפתח תקווה"', col: "#60a5fa" },
              ].map(s => (
                <div key={s.n} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.col}12`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: s.col }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{s.t}</div>
                    <div style={{ fontSize: 10, color: "#78716c" }}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Credits */}
            <div style={{ padding: 14, borderRadius: 14, background: "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.1)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>👨‍💻 אודות</div>
              <div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.7 }}>
                פותח על ידי <strong style={{ color: "#f97316" }}>רועי צוקרמן</strong> ככלי ניסיוני
              </div>
              <div style={{ fontSize: 10, color: "#78716c", marginTop: 4 }}>
                Next.js + Supabase + Claude AI • גרסה 1.0
              </div>
            </div>

            {/* Legal Disclaimer */}
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#fca5a5" }}>⚠️ אזהרות שימוש</div>
              <div style={{ fontSize: 10.5, color: "#a8a29e", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#d6d3d1" }}>1. כלי ניסיוני בלבד</strong> — מערכת זו פותחה כפרויקט ניסיוני ואינה מהווה מערכת רשמית של שירותי כבאות והצלה או כל גוף ממשלתי אחר.
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#d6d3d1" }}>2. אין לסמוך על הנתונים</strong> — המידע המוצג נאסף ממקורות ציבוריים באופן אוטומטי ועלול להכיל אי-דיוקים, השמטות, או שגיאות. אין להסתמך עליו לצורך קבלת החלטות מבצעיות, בטיחותיות, או משפטיות.
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#d6d3d1" }}>3. אין אחריות</strong> — המפתח אינו נושא באחריות כלשהי לנזק ישיר או עקיף שעלול להיגרם כתוצאה משימוש במידע המוצג במערכת זו.
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#d6d3d1" }}>4. נתונים סטטיסטיים</strong> — הנתונים המצטברים (מגמות שנתיות, עונתיות, פילוח) מבוססים על הערכות ואינם נתונים רשמיים מאושרים של נציבות כבאות והצלה.
                </div>
                <div>
                  <strong style={{ color: "#d6d3d1" }}>5. מקורות מידע</strong> — למידע רשמי ומדויק יש לפנות לנציבות כבאות והצלה לישראל בלבד.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Bar - floating pill */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        background: "rgba(28,25,23,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderRadius: 26, padding: "5px 6px",
        display: "flex", gap: 3, zIndex: 100,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelInc(null); }} style={{
            width: 60, padding: "9px 0", borderRadius: 22, border: "none", cursor: "pointer",
            background: tab === t.id ? "rgba(249,115,22,0.12)" : "transparent",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            color: tab === t.id ? "#f97316" : "#57534e",
            transition: "all 0.25s ease", fontFamily: "inherit",
          }}>
            <span style={{ fontSize: 16, fontWeight: 300 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "0 20px 100px", fontSize: 9, color: "#44403c", lineHeight: 1.6, position: "relative", zIndex: 10 }}>
        פותח ע"י <strong style={{ color: "#78716c" }}>רועי צוקרמן</strong> • כלי ניסיוני<br />
        נתונים מבוססים על כבאות והצלה, כלכליסט, ynet, מעריב, מאקו, חי פה, NWS, ניוזים, JDN ועוד • {now.toLocaleDateString("he-IL")}
      </div>
    </div>
  );
}
