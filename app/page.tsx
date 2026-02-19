"use client";
import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { createClient } from "@supabase/supabase-js";

// ==============================================
// SUPABASE CONNECTION
// ==============================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);

// ==============================================
// STATIC DATA (causes, districts — these don't come from DB)
// ==============================================
const CAUSES = [
  { name: "טעינת יתר", pct: 34, col: "#ef4444" },
  { name: "סוללה לא מקורית", pct: 22, col: "#f97316" },
  { name: "פגיעה מכנית", pct: 18, col: "#f59e0b" },
  { name: "כשל בייצור", pct: 12, col: "#fbbf24" },
  { name: "טעינה בזמן חום", pct: 8, col: "#a3e635" },
  { name: "אחר / לא ידוע", pct: 6, col: "#94a3b8" },
];

// Device type → color + icon mapping
const DEVICE_META: Record<string, { icon: string; color: string }> = {
  "אופניים חשמליים": { icon: "🚲", color: "#f59e0b" },
  "קורקינט חשמלי": { icon: "🛴", color: "#f97316" },
  "רכב חשמלי": { icon: "🚗", color: "#ef4444" },
  "טלפון נייד": { icon: "📱", color: "#60a5fa" },
  "מחשב נייד": { icon: "💻", color: "#818cf8" },
  "UPS/גיבוי": { icon: "🔋", color: "#34d399" },
  "סוללת כוח": { icon: "🔋", color: "#2dd4bf" },
  "כלי עבודה": { icon: "🔧", color: "#a78bfa" },
  "אחר": { icon: "⚡", color: "#94a3b8" },
};

const SEVERITY_COLOR: Record<string, string> = {
  "קל": "#22c55e",
  "בינוני": "#eab308",
  "חמור": "#f97316",
  "קריטי": "#ef4444",
};

// District name mapping for DB
const DISTRICT_ORDER = ["דן", "מרכז", "חוף", "ירושלים", "דרום", "צפון", "יו\"ש"];

// ==============================================
// HELPER: Process raw incidents into dashboard data
// ==============================================
function processIncidents(incidents: any[]) {
  // Yearly aggregation
  const yearMap: Record<number, { fires: number; deaths: number; injuries: number }> = {};
  incidents.forEach(inc => {
    const yr = new Date(inc.incident_date).getFullYear();
    if (!yearMap[yr]) yearMap[yr] = { fires: 0, deaths: 0, injuries: 0 };
    yearMap[yr].fires++;
    yearMap[yr].deaths += inc.fatalities || 0;
    yearMap[yr].injuries += inc.injuries || 0;
  });

  const currentYear = new Date().getFullYear();
  const years = Object.keys(yearMap).map(Number).sort();
  const YEARLY = years.map(yr => ({
    y: yr === currentYear ? `'${String(yr).slice(2)}*` : `'${String(yr).slice(2)}`,
    year: yr,
    fires: yearMap[yr].fires,
    deaths: yearMap[yr].deaths,
    injuries: yearMap[yr].injuries,
  }));

  // Device pie
  const deviceMap: Record<string, number> = {};
  incidents.forEach(inc => {
    const dt = inc.device_type || "אחר";
    deviceMap[dt] = (deviceMap[dt] || 0) + 1;
  });
  const DEVICE_PIE = Object.entries(deviceMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      n: name,
      v: count,
      c: DEVICE_META[name]?.color || "#94a3b8",
    }));

  // Monthly by year
  const MONTHLY: Record<number, { m: string; v: number }[]> = {};
  const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  years.forEach(yr => {
    const monthCounts = new Array(12).fill(0);
    incidents.forEach(inc => {
      const d = new Date(inc.incident_date);
      if (d.getFullYear() === yr) monthCounts[d.getMonth()]++;
    });
    MONTHLY[yr] = monthNames.map((m, i) => ({ m, v: monthCounts[i] }));
  });

  // District distribution
  const districtMap: Record<string, number> = {};
  incidents.forEach(inc => {
    const d = inc.district || "אחר";
    districtMap[d] = (districtMap[d] || 0) + 1;
  });
  const total = incidents.length;
  const DISTRICTS = Object.entries(districtMap)
    .sort((a, b) => b[1] - a[1])
    .map(([n, count]) => ({ n, pct: Math.round(count / total * 100) }));

  // Recent notable incidents for list view
  const INCIDENTS_LIST = incidents
    .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime())
    .slice(0, 50)
    .map((inc, i) => ({
      id: inc.id,
      date: new Date(inc.incident_date).toLocaleDateString("he-IL"),
      city: inc.city,
      district: inc.district,
      type: inc.device_type,
      icon: DEVICE_META[inc.device_type]?.icon || "⚡",
      sev: inc.severity || "בינוני",
      sevC: SEVERITY_COLOR[inc.severity] || "#eab308",
      d: inc.fatalities || 0,
      i: inc.injuries || 0,
      desc: inc.description || "",
      src: inc.source_name || "כבאות והצלה",
      verified: inc.verified,
    }));

  return { YEARLY, DEVICE_PIE, MONTHLY, DISTRICTS, INCIDENTS_LIST, years };
}

// ==============================================
// ISRAEL MAP
// ==============================================
function IsraelMap({ incidents }: { incidents: any[] }) {
  const israelCoords = [
    [35.10, 33.08], [35.13, 33.09], [35.46, 33.09],
    [35.55, 33.26], [35.82, 33.28], [35.84, 32.87],
    [35.72, 32.71],
    [35.55, 32.39],
    [35.57, 32.10], [35.55, 31.87], [35.53, 31.75],
    [35.50, 31.49], [35.42, 31.10],
    [34.92, 29.50],
    [34.27, 31.22], [34.56, 31.55], [34.49, 31.61],
    [34.75, 32.07], [34.96, 32.83],
    [35.10, 33.08],
  ];

  const W = 155, H = 440;
  const center = [35.05, 31.4];
  const scale = 3600;

  const project = (lng: number, lat: number) => {
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

  // Build heat from actual incident city counts
  const cityHeat: Record<string, number> = {};
  incidents.forEach(inc => {
    cityHeat[inc.city] = (cityHeat[inc.city] || 0) + 1;
  });

  const cityCoords: Record<string, [number, number]> = {
    "תל אביב": [34.77, 32.07], "פתח תקווה": [34.89, 32.09], "רמת גן": [34.82, 32.07],
    "חולון": [34.78, 32.02], "נתניה": [34.85, 32.32], "חיפה": [34.99, 32.79],
    "ירושלים": [35.21, 31.77], "באר שבע": [34.79, 31.25], "אשדוד": [34.65, 31.80],
    "ראשון לציון": [34.80, 31.97], "בני ברק": [34.83, 32.08], "בת ים": [34.75, 32.02],
    "הרצליה": [34.79, 32.16], "כפר סבא": [34.91, 32.18], "רעננה": [34.87, 32.19],
    "לוד": [34.90, 31.95], "רמלה": [34.87, 31.93], "אשקלון": [34.57, 31.67],
    "עכו": [35.07, 32.93], "נצרת": [35.30, 32.70], "עפולה": [35.29, 32.61],
    "כרמיאל": [35.30, 32.91], "טבריה": [35.53, 32.79], "אילת": [34.94, 29.56],
    "רחובות": [34.81, 31.90], "יבנה": [34.74, 31.88], "חדרה": [34.92, 32.44],
    "קריית גת": [34.76, 31.61], "הוד השרון": [34.89, 32.15], "נהריה": [35.10, 33.00],
  };

  const maxHeat = Math.max(...Object.values(cityHeat), 1);

  const cityData = Object.entries(cityHeat).map(([name, heat]) => ({
    name,
    coords: cityCoords[name],
    heat,
  })).filter(c => c.coords);

  return (
    <svg viewBox={`-5 -5 ${W+10} ${H+10}`} style={{ width: "100%", maxHeight: 460 }}>
      <defs>
        <clipPath id="israelClip"><path d={pathD} /></clipPath>
        {cityData.map(c => {
          const intensity = c.heat / maxHeat;
          let core, mid;
          if (intensity > 0.7) { core = "#dc2626"; mid = "#ef4444"; }
          else if (intensity > 0.5) { core = "#ea580c"; mid = "#f97316"; }
          else if (intensity > 0.3) { core = "#d97706"; mid = "#f59e0b"; }
          else if (intensity > 0.15) { core = "#ca8a04"; mid = "#eab308"; }
          else { core = "#65a30d"; mid = "#84cc16"; }
          return (
            <radialGradient key={`g-${c.name}`} id={`hg-${c.name.replace(/[\s\/\"]/g,'')}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={core} stopOpacity={0.85} />
              <stop offset="40%" stopColor={mid} stopOpacity={0.55} />
              <stop offset="75%" stopColor={mid} stopOpacity={0.2} />
              <stop offset="100%" stopColor={mid} stopOpacity="0" />
            </radialGradient>
          );
        })}
      </defs>

      <path d={pathD} fill="#e8e5e0" stroke="rgba(120,113,108,0.5)" strokeWidth="0.8" strokeLinejoin="round" />

      <g clipPath="url(#israelClip)">
        {cityData.map(c => {
          const [x, y] = project(c.coords![0], c.coords![1]);
          const intensity = c.heat / maxHeat;
          const r = 4 + intensity * 14;
          return (
            <circle key={`heat-${c.name}`} cx={x} cy={y} r={r}
              fill={`url(#hg-${c.name.replace(/[\s\/\"]/g,'')})`}>
              <animate attributeName="r" values={`${r};${r*1.06};${r}`} dur="5s" repeatCount="indefinite" />
            </circle>
          );
        })}
      </g>

      {Object.entries(cityCoords).map(([name, coords]) => {
        const [x, y] = project(coords[0], coords[1]);
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

      <g transform={`translate(${W-42}, ${H-45})`}>
        <text x="0" y="0" fill="rgba(168,162,158,0.6)" fontSize="4" fontFamily="sans-serif" fontWeight="600">עוצמת אירועים</text>
        {[["מעט","#84cc16"],["בינוני","#f59e0b"],["רב","#ef4444"]].map(([lbl,col],i) => (
          <g key={String(lbl)}>
            <circle cx="5" cy={10+i*9} r="3.5" fill={String(col)} opacity="0.7" />
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
  const [selInc, setSelInc] = useState<any>(null);
  const [now, setNow] = useState(new Date());
  const [seasonYear, setSeasonYear] = useState(2024);
  const [selPie, setSelPie] = useState<string | null>(null);
  const [rawIncidents, setRawIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  // Fetch from Supabase
  useEffect(() => {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from("incidents")
          .select("*")
          .order("incident_date", { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          setRawIncidents(data);
          setDbConnected(true);
        }
      } catch (err) {
        console.error("Supabase error:", err);
        setDbConnected(false);
      } finally {
        setLoading(false);
      }
    }

    async function fetchLastScan() {
      try {
        const { data } = await supabase
          .from("scan_log")
          .select("scan_time, incidents_added")
          .order("scan_time", { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          setLastScan(new Date(data[0].scan_time).toLocaleString("he-IL"));
        }
      } catch {}
    }

    fetchData();
    fetchLastScan();

    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Process data
  const { YEARLY, DEVICE_PIE, MONTHLY, DISTRICTS, INCIDENTS_LIST, years } = useMemo(
    () => processIncidents(rawIncidents),
    [rawIncidents]
  );

  const tabs = [
    { id: "home", icon: "⬡", label: "ראשי" },
    { id: "map", icon: "◎", label: "מפה" },
    { id: "stats", icon: "▣", label: "נתונים" },
    { id: "list", icon: "☰", label: "אירועים" },
    { id: "system", icon: "⚙", label: "מערכת" },
  ];

  const tip = { contentStyle: { background: "#1c1917", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, fontSize: 12, fontFamily: "sans-serif" }, labelStyle: { color: "#fafaf9" } };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fafaf9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Rubik', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔥</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>טוען נתונים...</div>
          <div style={{ fontSize: 12, color: "#78716c", marginTop: 6 }}>מתחבר למסד הנתונים</div>
        </div>
      </div>
    );
  }

  // Current year stats
  const currentYear = now.getFullYear();
  const curYearData = YEARLY.find(y => y.year === currentYear);
  const prevYearData = YEARLY.find(y => y.year === currentYear - 1);
  const changePct = prevYearData && prevYearData.fires > 0
    ? Math.round(((curYearData?.fires || 0) - prevYearData.fires) / prevYearData.fires * 100)
    : 0;
  const isPartial = true; // current year is always partial until Dec 31

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(175deg, #1a0c02 0%, #0d0d0d 25%, #111010 60%, #0a0a0a 100%)",
      color: "#fafaf9",
      fontFamily: "'Rubik', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap');`}</style>
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
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 16, background: dbConnected ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: dbConnected ? "#22c55e" : "#ef4444", boxShadow: `0 0 10px ${dbConnected ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}` }} />
            <span style={{ fontSize: 11, color: dbConnected ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{dbConnected ? "LIVE DB" : "OFFLINE"}</span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#57534e", marginTop: 6 }}>
          {dbConnected ? `${rawIncidents.length} אירועים במסד הנתונים` : "נתונים סטטיים"} • {now.toLocaleDateString("he-IL")}
          {lastScan && <span> • סריקה אחרונה: {lastScan}</span>}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0 14px 100px", position: "relative", zIndex: 10 }}>

        {/* ===== HOME ===== */}
        {tab === "home" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Alert */}
            <div style={{ padding: "12px 14px", borderRadius: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>נתון מדאיג</div>
                <div style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.5 }}>
                  {rawIncidents.length} אירועים מתועדים • {curYearData?.deaths || 0} הרוגים ב-{currentYear}{isPartial ? " (עד כה)" : ""} • {curYearData?.fires || 0} שריפות
                </div>
              </div>
            </div>

            {/* Hero */}
            <div style={{ padding: 22, borderRadius: 22, background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.12)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -25, left: -25, width: 100, height: 100, borderRadius: "50%", background: "rgba(249,115,22,0.06)", filter: "blur(25px)" }} />
              <div style={{ fontSize: 11, color: "#d6d3d1", fontWeight: 500 }}>סה״כ אירועים מתועדים {currentYear}{isPartial ? " (חלקי)" : ""}</div>
              <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginTop: 4 }}>{curYearData?.fires || 0}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{curYearData?.deaths || 0}</span><span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}> הרוגים</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: "#f97316" }}>{curYearData?.injuries || 0}</span><span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}> פצועים</span></div>
                <div style={{ marginRight: "auto" }}><span style={{ fontSize: 14, fontWeight: 800, color: changePct > 0 ? "#ef4444" : "#34d399" }}>{changePct > 0 ? "▲" : "▼"} {Math.abs(changePct)}%</span><span style={{ fontSize: 10, color: "#78716c", marginRight: 4 }}> מ-{currentYear-1}</span></div>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { v: `${rawIncidents.length}`, l: "סה״כ אירועים", icon: "🏠", col: "#f97316" },
                { v: `${DISTRICTS[0]?.pct || 0}%`, l: `${DISTRICTS[0]?.n || ""}`, icon: "📍", col: "#fbbf24" },
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
                * {currentYear} נתונים חלקיים | מקור: Supabase DB — {rawIncidents.length} אירועים
              </div>
            </div>

            {/* Pie */}
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>📱 פילוח שריפות לפי סוג המכשיר</div>
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
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>מסד נתונים</span>
                  <strong style={{ color: "#f97316" }}>{rawIncidents.length}</strong> אירועים מתועדים ב-DB. נתונים מ-{years[0] || "?"} עד {currentYear}.
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(249,115,22,0.1)", color: "#fdba74", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>מגמה מחזורית</span>
                  יוני-אוגוסט מהווים ~33% מהאירועים השנתיים. טמפרטורות מעל 35°C מגבירות סיכון ל-thermal runaway.
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(251,191,36,0.1)", color: "#fde68a", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>מיקוד גאוגרפי</span>
                  {DISTRICTS[0] && <>~{DISTRICTS[0].pct}% מהאירועים ב{DISTRICTS[0].n}. צפיפות אוכלוסין + ריכוז שימוש באופניים חשמליים.</>}
                </div>
                <div>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#93c5fd", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>חיבור DB</span>
                  {dbConnected ? "✅ מחובר ל-Supabase — נתונים חיים" : "⚠️ לא מחובר — נתונים סטטיים"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== MAP ===== */}
        {tab === "map" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🗺️ מפת חום — אירועים לפי עיר</div>
              <IsraelMap incidents={rawIncidents} />
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
                </div>
              </div>
            )}

            {/* Districts */}
            <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📍 התפלגות לפי מחוז (מחושב מ-DB)</div>
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
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>📅 עונתיות {seasonYear}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {years.map(yr => (
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
                <BarChart data={MONTHLY[seasonYear] || []} barSize={16}>
                  <XAxis dataKey="m" tick={{ fill: "#78716c", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip {...tip} />
                  <Bar dataKey="v" radius={[6, 6, 0, 0]} name="שריפות">
                    {(MONTHLY[seasonYear] || []).map((d, i) => <Cell key={i} fill={d.v >= 10 ? "#ef4444" : d.v >= 5 ? "#f97316" : d.v > 0 ? "#fbbf24" : "#333"} opacity={d.v > 0 ? 0.85 : 0.2} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: "#a8a29e", marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(249,115,22,0.05)" }}>
                💡 שיא בקיץ — חום סביבתי מגביר thermal runaway בסוללות
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
            <div style={{ fontSize: 15, fontWeight: 700, padding: "0 4px 4px" }}>🔥 אירועים מתועדים ({INCIDENTS_LIST.length})</div>
            <div style={{ fontSize: 11, color: "#78716c", padding: "0 4px 6px" }}>נתונים מ-Supabase • ממוינים מהחדש לישן</div>
            {INCIDENTS_LIST.map(inc => (
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
                    {inc.verified && <span style={{ marginRight: 8, fontSize: 10, color: "#22c55e" }}>✅ מאומת</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ===== SYSTEM ===== */}
        {tab === "system" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* DB Status */}
            <div style={{ padding: 18, borderRadius: 20, background: "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(59,130,246,0.04))", border: `1px solid ${dbConnected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: dbConnected ? "linear-gradient(135deg, #22c55e, #3b82f6)" : "linear-gradient(135deg, #ef4444, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🗄️</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Supabase Database</div>
                  <div style={{ fontSize: 11, color: "#78716c" }}>{dbConnected ? "מחובר ופעיל" : "לא מחובר"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { v: String(rawIncidents.length), l: "אירועים ב-DB", col: "#22c55e" },
                  { v: String(years.length), l: "שנים", col: "#3b82f6" },
                  { v: lastScan ? "✅" : "—", l: "סריקה אחרונה", col: "#f97316" },
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
                { icon: "📰", name: "חדשות ארציות", det: "ynet, כלכליסט, הארץ, וואלה, מעריב, גלובס, מאקו, חדשות 13/12", col: "#f97316" },
                { icon: "📍", name: "חדשות מקומיות", det: "חי פה, NWS, ניוזים, כיכר השבת, JDN, כל רגע, חדשות הנגב", col: "#fbbf24" },
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

            {/* Credits */}
            <div style={{ padding: 14, borderRadius: 14, background: "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.1)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>👨‍💻 אודות</div>
              <div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.7 }}>
                פותח על ידי <strong style={{ color: "#f97316" }}>רועי צוקרמן</strong> ככלי ניסיוני
              </div>
              <div style={{ fontSize: 10, color: "#78716c", marginTop: 4 }}>
                Next.js + Supabase + Gemini AI • גרסה 2.0
              </div>
            </div>

            {/* Legal */}
            <div style={{ padding: 14, borderRadius: 14, background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#fca5a5" }}>⚠️ אזהרות שימוש</div>
              <div style={{ fontSize: 10.5, color: "#a8a29e", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#d6d3d1" }}>1. כלי ניסיוני בלבד</strong> — מערכת זו פותחה כפרויקט ניסיוני ואינה מהווה מערכת רשמית.
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#d6d3d1" }}>2. אין לסמוך על הנתונים</strong> — המידע נאסף ממקורות ציבוריים ועלול להכיל אי-דיוקים.
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#d6d3d1" }}>3. אין אחריות</strong> — המפתח אינו נושא באחריות לנזק שעלול להיגרם משימוש במידע.
                </div>
                <div>
                  <strong style={{ color: "#d6d3d1" }}>4. מקורות רשמיים</strong> — למידע מדויק יש לפנות לנציבות כבאות והצלה לישראל.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Bar */}
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
        {dbConnected ? `מחובר ל-Supabase • ${rawIncidents.length} אירועים` : "נתונים סטטיים"} • {now.toLocaleDateString("he-IL")}
      </div>
    </div>
  );
}
