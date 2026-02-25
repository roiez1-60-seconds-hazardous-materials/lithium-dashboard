"use client";
// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area } from "recharts";

interface Incident {
  id: number;
  incident_date: string;
  city: string;
  district: string | null;
  device_type: string;
  severity: string;
  fatalities: number;
  injuries: number;
  description: string | null;
  source_name: string | null;
  source_url: string | null;
  verified: boolean;
  data_source: string;
}

// ============================================================
// 🔥 LITHIUM FIRE DASHBOARD v3 — SUPABASE LIVE
// כבאות והצלה לישראל
// Maps exactly to: incident_date, fatalities, injuries, city,
// district, device_type, severity, description, source_name
// ============================================================

const DEVICE_COLORS: Record<string, string> = {
  "אופניים חשמליים": "#f97316",
  "קורקינט חשמלי": "#8b5cf6",
  "רכב חשמלי": "#3b82f6",
  "סוללת נייד": "#ec4899",
  "UPS/גיבוי": "#10b981",
  "כלי שיט חשמלי": "#06b6d4",
  "סוללת מחשב": "#f59e0b",
  "אחר": "#6b7280",
};
const DEVICE_ICONS: Record<string, string> = {
  "אופניים חשמליים": "🚲",
  "קורקינט חשמלי": "🛴",
  "רכב חשמלי": "🚗",
  "סוללת נייד": "📱",
  "UPS/גיבוי": "🔋",
  "כלי שיט חשמלי": "🚤",
  "סוללת מחשב": "💻",
  "אחר": "⚡",
};
const SEV_COLORS: Record<string, string> = { "קל": "#22c55e", "בינוני": "#f59e0b", "חמור": "#f97316", "קריטי": "#ef4444" };
const SEV_BG: Record<string, string> = { "קל": "rgba(34,197,94,0.12)", "בינוני": "rgba(245,158,11,0.12)", "חמור": "rgba(249,115,22,0.12)", "קריטי": "rgba(239,68,68,0.12)" };
const DIST_COLORS: Record<string, string> = { "מרכז": "#3b82f6", "דן": "#f97316", "חוף": "#06b6d4", "צפון": "#22c55e", "דרום": "#f59e0b", "ירושלים": "#a855f7", "שפלה": "#ec4899", "שרון": "#14b8a6", 'יו"ש': "#6366f1" };
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const TABS = [
  { id: "home", icon: "🏠", label: "ראשי" },
  { id: "chart", icon: "📊", label: "גרפים" },
  { id: "list", icon: "📋", label: "אירועים" },
  { id: "map", icon: "🗺️", label: "מפה" },
  { id: "system", icon: "⚙️", label: "מערכת" },
];

/* ============ small helpers ============ */
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(12px)" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 13, color: p.color || "#fff", fontWeight: 600 }}>{p.name}: {p.value}</div>)}
    </div>
  );
}

function Stat({ icon, label, value, sub, color = "#f97316", trend }: any) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -20, left: -20, width: 70, height: 70, borderRadius: "50%", background: `${color}08` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 10, color: "#78716c", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#f8fafc", letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#57534e", marginTop: 2 }}>{sub}</div>}
      {trend != null && <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: trend > 0 ? "#ef4444" : "#22c55e" }}>{trend > 0 ? "▲" : "▼"} {Math.abs(trend)}%</div>}
    </div>
  );
}

function Glass({ children, style = {} }: any) {
  return <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: 16, ...style }}>{children}</div>;
}

function YearBar({ years, sel, onChange }: any) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
      {["הכל", ...years].map(y => (
        <button key={y} onClick={() => onChange(y)} style={{
          padding: "6px 14px", borderRadius: 10, border: "1px solid",
          borderColor: sel === y ? "#f97316" : "rgba(255,255,255,0.08)",
          background: sel === y ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)",
          color: sel === y ? "#f97316" : "#94a3b8",
          fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
        }}>{y}</button>
      ))}
    </div>
  );
}

/* ============ Incident Card ============ */
function IncCard({ inc, onClick }: { inc: Incident; onClick: () => void }) {
  const sc = SEV_COLORS[inc.severity] || "#6b7280";
  const dc = DEVICE_COLORS[inc.device_type] || "#6b7280";
  const di = DEVICE_ICONS[inc.device_type] || "⚡";
  return (
    <div onClick={onClick} className="inc-card" style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14, padding: "12px 14px", cursor: "pointer", borderRight: `3px solid ${sc}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>{di}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: `${dc}18`, color: dc, whiteSpace: "nowrap" }}>{inc.device_type}</span>
        </div>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 700, background: SEV_BG[inc.severity], color: sc, whiteSpace: "nowrap" }}>{inc.severity}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {inc.description}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#64748b" }}>
          <span>📍 {inc.city}</span>
          <span>📅 {new Date(inc.incident_date).toLocaleDateString("he-IL")}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {inc.fatalities > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", background: "rgba(239,68,68,0.12)", padding: "1px 6px", borderRadius: 6 }}>💀 {inc.fatalities}</span>}
          {inc.injuries > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#f97316", background: "rgba(249,115,22,0.12)", padding: "1px 6px", borderRadius: 6 }}>🤕 {inc.injuries}</span>}
        </div>
      </div>
    </div>
  );
}

/* ============ Modal ============ */
function Modal({ inc, onClose }: { inc: Incident | null; onClose: () => void }) {
  if (!inc) return null;
  const sc = SEV_COLORS[inc.severity] || "#6b7280";
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} className="slide-up" style={{
        width: "100%", maxWidth: 500, maxHeight: "85vh", overflowY: "auto",
        background: "linear-gradient(180deg, #1a1a2e 0%, #0f172a 100%)",
        borderRadius: "24px 24px 0 0", padding: "20px 20px 40px",
        border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none",
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 16px" }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: `${DEVICE_COLORS[inc.device_type] || "#6b7280"}18`, color: DEVICE_COLORS[inc.device_type] || "#6b7280" }}>{DEVICE_ICONS[inc.device_type]} {inc.device_type}</span>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 10, background: SEV_BG[inc.severity], color: sc }}>{inc.severity}</span>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.5, marginBottom: 14 }}>{inc.description}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { i: "📍", l: "עיר", v: inc.city },
            { i: "🏛️", l: "מחוז", v: inc.district || "—" },
            { i: "📅", l: "תאריך", v: new Date(inc.incident_date).toLocaleDateString("he-IL") },
            { i: "📰", l: "מקור", v: inc.source_name || "—" },
          ].map(f => (
            <div key={f.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "#64748b" }}>{f.i} {f.l}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{f.v}</div>
            </div>
          ))}
        </div>
        {(inc.fatalities > 0 || inc.injuries > 0) && (
          <div style={{ display: "flex", gap: 16, padding: "12px 14px", borderRadius: 12, marginBottom: 16, background: inc.fatalities > 0 ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)", border: `1px solid ${inc.fatalities > 0 ? "rgba(239,68,68,0.2)" : "rgba(249,115,22,0.2)"}` }}>
            {inc.fatalities > 0 && <div><div style={{ fontSize: 26, fontWeight: 800, color: "#ef4444" }}>{inc.fatalities}</div><div style={{ fontSize: 11, color: "#ef4444" }}>הרוגים</div></div>}
            {inc.injuries > 0 && <div><div style={{ fontSize: 26, fontWeight: 800, color: "#f97316" }}>{inc.injuries}</div><div style={{ fontSize: 11, color: "#f97316" }}>פצועים</div></div>}
          </div>
        )}
        {inc.source_url && <a href={inc.source_url} target="_blank" rel="noopener" style={{ display: "block", textAlign: "center", fontSize: 12, color: "#3b82f6", marginBottom: 12 }}>🔗 קישור לכתבה</a>}
        <button onClick={onClose} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>סגור</button>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN
   ============================================================ */
export default function Dashboard() {
  const [tab, setTab] = useState("home");
  const [data, setData] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selInc, setSelInc] = useState<Incident | null>(null);
  const [devF, setDevF] = useState("הכל");
  const [sevF, setSevF] = useState("הכל");
  const [year, setYear] = useState("הכל");
  const [lastUp, setLastUp] = useState(null);
  const now = new Date();

  /* ---- fetch from Supabase via API ---- */
  useEffect(() => {
    let iv;
    async function load() {
      try {
        const r = await fetch("/api/incidents?limit=1000");
        if (r.ok) {
          const j = await r.json();
          const list = j.incidents || j.data || j;
          if (Array.isArray(list) && list.length > 0) {
            setData(list);
            setLastUp(new Date().toISOString());
            setLoading(false);
            return;
          }
        }
      } catch (e) { /* ignore */ }
      setData([]);
      setLoading(false);
    }
    load();
    iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, []);

  /* ---- years ---- */
  const years = useMemo(() => Array.from(new Set(data.map(i => new Date(i.incident_date).getFullYear()))).sort((a, b) => b - a), [data]);

  /* ---- year-filtered ---- */
  const yf = useMemo(() => year === "הכל" ? data : data.filter(i => new Date(i.incident_date).getFullYear() === Number(year)), [data, year]);

  /* ---- stats ---- */
  const S = useMemo(() => {
    if (!yf.length) return null;
    const totalF = yf.reduce((s, i) => s + (i.fatalities || 0), 0);
    const totalI = yf.reduce((s, i) => s + (i.injuries || 0), 0);

    const byDev: Record<string, number> = {}; yf.forEach(i => { byDev[i.device_type] = (byDev[i.device_type] || 0) + 1; });
    const devData = Object.entries(byDev).map(([n, v]: [string, number]) => ({ name: n, value: v, color: DEVICE_COLORS[n] || "#6b7280" })).sort((a, b) => b.value - a.value);

    const bySev: Record<string, number> = {}; yf.forEach(i => { bySev[i.severity] = (bySev[i.severity] || 0) + 1; });
    const sevData = Object.entries(bySev).map(([n, v]: [string, number]) => ({ name: n, value: v, color: SEV_COLORS[n] || "#6b7280" })).sort((a, b) => b.value - a.value);

    const byDist: Record<string, number> = {}; yf.forEach(i => { if (i.district) byDist[i.district] = (byDist[i.district] || 0) + 1; });
    const distData = Object.entries(byDist).map(([n, v]: [string, number]) => ({ name: n, value: v, fill: DIST_COLORS[n] || "#6b7280" })).sort((a, b) => b.value - a.value);

    /* monthly */
    const monthly = [];
    if (year !== "הכל") {
      for (let m = 0; m < 12; m++) {
        const mi = yf.filter(i => new Date(i.incident_date).getMonth() === m);
        monthly.push({ month: MONTHS_HE[m], count: mi.length, fatalities: mi.reduce((s, x) => s + (x.fatalities || 0), 0), injuries: mi.reduce((s, x) => s + (x.injuries || 0), 0) });
      }
    } else {
      const bm: Record<string, {c:number,f:number,inj:number}> = {};
      yf.forEach(i => {
        const d = new Date(i.incident_date);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!bm[k]) bm[k] = { c: 0, f: 0, inj: 0 };
        bm[k].c++; bm[k].f += i.fatalities || 0; bm[k].inj += i.injuries || 0;
      });
      Object.entries(bm).sort((a, b) => a[0].localeCompare(b[0])).slice(-18).forEach(([k, v]) => {
        const [y2, m2] = k.split("-");
        monthly.push({ month: `${MONTHS_HE[+m2 - 1]} ${y2}`, count: v.c, fatalities: v.f, injuries: v.inj });
      });
    }

    /* yearly (always full) */
    const byYr: Record<string, {year:number,total:number,fatalities:number,injuries:number}> = {};
    data.forEach(i => {
      const y2 = new Date(i.incident_date).getFullYear();
      if (!byYr[y2]) byYr[y2] = { year: y2, total: 0, fatalities: 0, injuries: 0 };
      byYr[y2].total++; byYr[y2].fatalities += i.fatalities || 0; byYr[y2].injuries += i.injuries || 0;
    });
    const yrData = Object.values(byYr).sort((a, b) => a.year - b.year);

    /* cities */
    const byCity: Record<string, {c:number,f:number,inj:number}> = {};
    yf.forEach(i => {
      if (!byCity[i.city]) byCity[i.city] = { c: 0, f: 0, inj: 0 };
      byCity[i.city].c++; byCity[i.city].f += i.fatalities || 0; byCity[i.city].inj += i.injuries || 0;
    });
    const cities = Object.entries(byCity).map(([city, d]) => ({ city, count: d.c, fatalities: d.f, injuries: d.inj })).sort((a, b) => b.count - a.count).slice(0, 10);

    const ty = now.getFullYear();
    const tyC = data.filter(i => new Date(i.incident_date).getFullYear() === ty).length;
    const lyC = data.filter(i => new Date(i.incident_date).getFullYear() === ty - 1).length;
    const trend = lyC > 0 ? Math.round(((tyC - lyC) / lyC) * 100) : null;

    return { total: yf.length, totalF, totalI, devData, sevData, distData, monthly, yrData, cities, tyC, trend, nCities: new Set(yf.map(i => i.city)).size };
  }, [yf, data, year]);

  /* ---- filtered list ---- */
  const filtered = useMemo(() => {
    let l = [...yf];
    if (devF !== "הכל") l = l.filter(i => i.device_type === devF);
    if (sevF !== "הכל") l = l.filter(i => i.severity === sevF);
    return l.sort((a, b) => b.incident_date.localeCompare(a.incident_date));
  }, [yf, devF, sevF]);

  const fatal = useMemo(() => yf.filter(i => i.fatalities > 0).sort((a, b) => b.incident_date.localeCompare(a.incident_date)), [yf]);

  /* ---- loading ---- */
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a1a", color: "#f97316", fontFamily: "'Heebo',sans-serif", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48, animation: "pulse 1.5s infinite" }}>🔥</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>טוען נתונים מ-Supabase...</div>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:.7}}`}</style>
    </div>
  );

  /* ---- empty ---- */
  if (!data.length) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a1a", color: "#94a3b8", fontFamily: "'Heebo',sans-serif", flexDirection: "column", gap: 12, padding: 20, textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#f97316" }}>לא נמצאו נתונים</div>
      <div style={{ fontSize: 13 }}>בדוק שה-API route פועל ושה-Supabase מחובר</div>
      <div style={{ fontSize: 11, color: "#57534e", marginTop: 8 }}>GET /api/incidents צריך להחזיר את רשימת האירועים</div>
    </div>
  );

  /* ============================================================ */
  return (
    <div dir="rtl" style={{ minHeight: "100vh", fontFamily: "'Heebo',sans-serif", background: "linear-gradient(180deg,#0a0a1a 0%,#0f172a 50%,#0a0a1a 100%)", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a1a;overflow-x:hidden}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
        .inc-card:active{background:rgba(255,255,255,.06)!important}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn .35s ease}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .slide-up{animation:slideUp .3s ease}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.15);opacity:.7}}
        @media(max-width:640px){
          .sg{grid-template-columns:1fr 1fr!important}
          .cg{grid-template-columns:1fr!important}
          .pf{flex-direction:column!important}
        }
      `}</style>

      {/* ambient */}
      <div style={{ position: "fixed", top: -120, left: "50%", transform: "translateX(-50%)", width: 500, height: 350, background: "radial-gradient(ellipse,rgba(249,115,22,.08) 0%,rgba(239,68,68,.04) 40%,transparent 70%)", pointerEvents: "none" }} />

      {/* ===== HEADER ===== */}
      <header style={{ padding: "max(env(safe-area-inset-top,12px),46px) 16px 12px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#ef4444,#f97316,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 20px rgba(249,115,22,.3)" }}>🔥</div>
            <div>
              <div style={{ fontSize: 9, color: "#78716c", fontWeight: 600, textTransform: "uppercase", letterSpacing: 2 }}>כבאות והצלה לישראל</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>מעקב שריפות ליתיום</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 14, background: "rgba(34,197,94,.08)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 10px rgba(34,197,94,.5)", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>LIVE</span>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#57534e", marginTop: 5 }}>
          {data.length} אירועים אמיתיים מ-Supabase • {now.toLocaleDateString("he-IL")}
          {year !== "הכל" && <span style={{ color: "#f97316", fontWeight: 700 }}> • שנת {year}</span>}
        </div>
      </header>

      {/* ===== CONTENT ===== */}
      <main style={{ padding: "0 14px 110px", position: "relative", zIndex: 10 }}>

        {/* year bar */}
        {["home","chart","list","map"].includes(tab) && <div style={{ marginBottom: 12 }}><YearBar years={years} sel={year} onChange={setYear} /></div>}

        {/* ==================== HOME ==================== */}
        {tab === "home" && S && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* alert */}
            {fatal.length > 0 && (
              <div style={{ padding: "10px 14px", borderRadius: 14, background: "linear-gradient(135deg,rgba(239,68,68,.12),rgba(249,115,22,.08))", border: "1px solid rgba(239,68,68,.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span>⚠️</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#ef4444" }}>{S.totalF} הרוגים • {S.totalI} פצועים{year !== "הכל" ? ` בשנת ${year}` : " סה״כ"}</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>אירוע קטלני אחרון: {fatal[0].city} — {fatal[0].description?.slice(0, 60)}...</div>
              </div>
            )}

            {/* stats */}
            <div className="sg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <Stat icon="🔥" label="אירועים" value={S.total} color="#f97316" trend={year === "הכל" ? S.trend : null} />
              <Stat icon="💀" label="הרוגים" value={S.totalF} color="#ef4444" sub={`${fatal.length} אירועים קטלניים`} />
              <Stat icon="🤕" label="פצועים" value={S.totalI} color="#f59e0b" />
              <Stat icon="🏙️" label="ערים" value={S.nCities} color="#3b82f6" />
            </div>

            {/* device pie */}
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📱 פילוח לפי סוג מכשיר</div>
              <div className="pf" style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 200, height: 200, flexShrink: 0, margin: "0 auto" }}>
                  <ResponsiveContainer>
                    <PieChart><Pie data={S.devData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} stroke="rgba(10,10,26,.8)">
                      {S.devData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie><Tooltip content={<Tip />} /></PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 6 }}>
                  {S.devData.map(d => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{DEVICE_ICONS[d.name]} {d.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{d.value}</span>
                      <span style={{ fontSize: 10, color: "#57534e", minWidth: 30 }}>{Math.round(d.value / S.total * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Glass>

            {/* monthly */}
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📅 {year !== "הכל" ? `פילוח חודשי — ${year}` : "מגמה חודשית"}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>אירועים, הרוגים ופצועים</div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={S.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#64748b" }} angle={year === "הכל" ? -35 : 0} textAnchor="end" height={year === "הכל" ? 55 : 30} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count" name="אירועים" fill="#f97316" radius={[4,4,0,0]} />
                    <Bar dataKey="injuries" name="פצועים" fill="#f59e0b" radius={[4,4,0,0]} />
                    <Bar dataKey="fatalities" name="הרוגים" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Glass>

            {/* fatal list */}
            {fatal.length > 0 && (
              <Glass style={{ borderColor: "rgba(239,68,68,.15)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#ef4444" }}>💀 אירועים קטלניים ({fatal.length})</div>
                {fatal.slice(0, 6).map(inc => (
                  <div key={inc.id} onClick={() => setSelInc(inc)} className="inc-card" style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", background: "rgba(239,68,68,.05)", border: "1px solid rgba(239,68,68,.1)", marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", flex: 1 }}>{inc.description?.slice(0, 70)}</div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#ef4444", flexShrink: 0 }}>💀{inc.fatalities}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>📍 {inc.city} • 📅 {new Date(inc.incident_date).toLocaleDateString("he-IL")}</div>
                  </div>
                ))}
              </Glass>
            )}

            {/* recent */}
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🕐 אירועים אחרונים</div>
              {filtered.slice(0, 5).map(i => <IncCard key={i.id} inc={i} onClick={() => setSelInc(i)} />)}
            </Glass>
          </div>
        )}

        {/* ==================== CHARTS ==================== */}
        {tab === "chart" && S && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📅 {year !== "הכל" ? `מגמה חודשית — ${year}` : "מגמה חודשית"}</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <AreaChart data={S.monthly}>
                    <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={.3}/><stop offset="100%" stopColor="#f97316" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#64748b" }} angle={year === "הכל" ? -35 : 0} textAnchor="end" height={year === "הכל" ? 55 : 30} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip content={<Tip />} />
                    <Area type="monotone" dataKey="count" name="אירועים" stroke="#f97316" fill="url(#gr)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Glass>

            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🎯 חומרה</div>
              <div className="pf" style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 180, height: 180, flexShrink: 0, margin: "0 auto" }}>
                  <ResponsiveContainer><PieChart><Pie data={S.sevData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" strokeWidth={2} stroke="rgba(10,10,26,.8)">{S.sevData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip content={<Tip />} /></PieChart></ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 8 }}>
                  {S.sevData.map(d => <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} /><span style={{ fontSize: 12, color: "#94a3b8", flex: 1 }}>{d.name}</span><span style={{ fontSize: 13, fontWeight: 700 }}>{d.value}</span></div>)}
                </div>
              </div>
            </Glass>

            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🏛️ מחוזות</div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={S.distData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} width={55} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey="value" name="אירועים" radius={[0,6,6,0]}>{S.distData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Glass>

            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📈 מגמה שנתית (כל השנים)</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={S.yrData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip content={<Tip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="total" name="אירועים" fill="#f97316" radius={[4,4,0,0]} />
                    <Bar dataKey="fatalities" name="הרוגים" fill="#ef4444" radius={[4,4,0,0]} />
                    <Bar dataKey="injuries" name="פצועים" fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Glass>

            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🏙️ דירוג ערים</div>
              {S.cities.map((c, i) => (
                <div key={c.city} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: i === 0 ? "rgba(249,115,22,.08)" : "transparent" }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: i < 3 ? "#f97316" : "#57534e", minWidth: 24 }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.city}</span>
                  {c.fatalities > 0 && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>💀{c.fatalities}</span>}
                  {c.injuries > 0 && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>🤕{c.injuries}</span>}
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#f97316", background: "rgba(249,115,22,.12)", padding: "2px 8px", borderRadius: 6 }}>{c.count}</span>
                </div>
              ))}
            </Glass>
          </div>
        )}

        {/* ==================== LIST ==================== */}
        {tab === "list" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* device filter */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {["הכל", ...Object.keys(DEVICE_COLORS)].map(d => (
                <button key={d} onClick={() => setDevF(d)} style={{
                  padding: "6px 12px", borderRadius: 10, border: "1px solid",
                  borderColor: devF === d ? "#f97316" : "rgba(255,255,255,.08)",
                  background: devF === d ? "rgba(249,115,22,.15)" : "rgba(255,255,255,.03)",
                  color: devF === d ? "#f97316" : "#94a3b8",
                  fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0,
                }}>{d === "הכל" ? "🔥 הכל" : `${DEVICE_ICONS[d]||""} ${d}`}</button>
              ))}
            </div>
            {/* severity filter */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["הכל","קריטי","חמור","בינוני","קל"].map(s => (
                <button key={s} onClick={() => setSevF(s)} style={{
                  padding: "4px 10px", borderRadius: 8, border: "1px solid",
                  borderColor: sevF === s ? (SEV_COLORS[s]||"#f97316") : "rgba(255,255,255,.06)",
                  background: sevF === s ? (SEV_BG[s]||"rgba(249,115,22,.12)") : "transparent",
                  color: sevF === s ? (SEV_COLORS[s]||"#f97316") : "#64748b",
                  fontSize: 10, fontWeight: 600, cursor: "pointer",
                }}>{s}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} מתוך {data.length} אירועים</div>
            {filtered.map(i => <IncCard key={i.id} inc={i} onClick={() => setSelInc(i)} />)}
            {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#57534e" }}>אין אירועים להצגה</div>}
          </div>
        )}

        {/* ==================== MAP ==================== */}
        {tab === "map" && S && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🗺️ התפלגות לפי מחוז</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {S.distData.map(d => {
                  const mx = Math.max(...S.distData.map(x => x.value));
                  const int = d.value / mx;
                  return (
                    <div key={d.name} style={{ padding: 12, borderRadius: 12, background: `${d.fill}${Math.round(int * 25 + 5).toString(16).padStart(2,"0")}`, border: `1px solid ${d.fill}30` }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2 }}>{d.name}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: d.fill }}>{d.value}</div>
                      <div style={{ fontSize: 10, color: "#57534e" }}>אירועים</div>
                    </div>
                  );
                })}
              </div>
            </Glass>
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🏙️ ערים מובילות</div>
              {S.cities.map((c, i) => {
                const mx = S.cities[0]?.count || 1;
                return (
                  <div key={c.city} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 60 }}>{c.city}</span>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.05)", overflow: "hidden" }}>
                      <div style={{ width: `${(c.count / mx) * 100}%`, height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#f97316,#ef4444)" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316", minWidth: 28 }}>{c.count}</span>
                  </div>
                );
              })}
            </Glass>
          </div>
        )}

        {/* ==================== SYSTEM ==================== */}
        {tab === "system" && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🤖 מערכת אוטונומית</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.8, marginBottom: 14 }}>
                המערכת סורקת, מנתחת ומסווגת אירועי שריפה הקשורים לסוללות ליתיום <strong style={{ color: "#f1f5f9" }}>באופן אוטומטי לחלוטין</strong>.
              </div>
              <div className="cg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { i: "🔍", t: "סריקה", d: "Gemini AI + RSS סורק חדשות בעברית ואנגלית" },
                  { i: "🧠", t: "ניתוח", d: "כל אירוע עובר סיווג: מכשיר, חומרה, מחוז" },
                  { i: "📊", t: "תצוגה", d: "דשבורד חי שמתעדכן כל 5 דקות" },
                ].map(s => (
                  <div key={s.t} style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.04)" }}>
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{s.i}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{s.t}</div>
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{s.d}</div>
                  </div>
                ))}
              </div>
            </Glass>
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📋 סטטוס</div>
              {[
                { l: "Supabase DB", v: `${data.length} אירועים אמיתיים`, ok: true },
                { l: "הרוגים", v: `${data.reduce((s, i) => s + (i.fatalities || 0), 0)} סה"כ`, ok: true },
                { l: "פצועים", v: `${data.reduce((s, i) => s + (i.injuries || 0), 0)} סה"כ`, ok: true },
                { l: "שנים", v: `${years[years.length - 1] || "?"} — ${years[0] || "?"}`, ok: true },
                { l: "עדכון אחרון", v: lastUp ? new Date(lastUp).toLocaleString("he-IL") : "—", ok: !!lastUp },
                { l: "Cron", v: "כל 6 שעות", ok: true },
              ].map(s => (
                <div key={s.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,.02)", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.ok ? "#22c55e" : "#f59e0b" }} />
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.l}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.v}</span>
                </div>
              ))}
            </Glass>
            <Glass>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📡 מקורות</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Array.from(new Set(data.map(i => i.source_name).filter(Boolean))).map(s => (
                  <span key={s} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,.04)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.06)" }}>{s}</span>
                ))}
              </div>
            </Glass>
          </div>
        )}
      </main>

      {/* ===== TAB BAR ===== */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,10,26,.92)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,.06)", paddingBottom: "env(safe-area-inset-bottom,8px)", zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-around", padding: "8px 10px 4px", maxWidth: 500, margin: "0 auto" }}>
          {TABS.map(t => {
            const a = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: a ? "#f97316" : "#57534e", padding: "4px 12px" }}>
                <span style={{ fontSize: 20, filter: a ? "drop-shadow(0 0 6px rgba(249,115,22,.4))" : "none" }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: a ? 700 : 500 }}>{t.label}</span>
                {a && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#f97316", marginTop: 1 }} />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* modal */}
      {selInc && <Modal inc={selInc} onClose={() => setSelInc(null)} />}

      {/* footer */}
      <footer style={{ textAlign: "center", padding: "20px 14px 120px", fontSize: 10, color: "#3f3f46", borderTop: "1px solid rgba(255,255,255,.03)" }}>
        דשבורד שריפות ליתיום • כבאות והצלה לישראל • נתונים אמיתיים מ-Supabase
      </footer>
    </div>
  );
}
