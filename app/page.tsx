"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Legend } from "recharts";
import { createClient } from "@supabase/supabase-js";

// ==============================================
// SUPABASE CONNECTION
// ==============================================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ==============================================
// OFFICIAL ANNUAL STATISTICS — Fire & Rescue Israel
// These are verified numbers from כבאות והצלה
// DB incidents supplement these with individual events
// ==============================================
const ANNUAL_STATS = [
  { year: 2017, fires: 76,  fatalities: 0, source: "כלכליסט" },
  { year: 2018, fires: 90,  fatalities: 0, source: "כלכליסט" },
  { year: 2019, fires: 140, fatalities: 0, source: "כלכליסט" },
  { year: 2020, fires: 184, fatalities: 0, source: "כלכליסט" },
  { year: 2021, fires: 167, fatalities: 5, source: "כלכליסט" },
  { year: 2022, fires: 224, fatalities: 6, source: "מעריב" },
  { year: 2023, fires: 232, fatalities: 0, source: "מעריב" },
  { year: 2024, fires: 250, fatalities: 4, source: "ישראל היום" },
];

// 2019 device breakdown — only year with full public data
const DEVICE_BREAKDOWN_2019 = [
  { name: "אופניים חשמליים", count: 96, pct: 68.6, color: "#f59e0b" },
  { name: "קורקינטים חשמליים", count: 16, pct: 11.4, color: "#f97316" },
  { name: "טלפונים ניידים", count: 11, pct: 7.9, color: "#60a5fa" },
  { name: "רכב היברידי", count: 2, pct: 1.4, color: "#ef4444" },
  { name: "אחר", count: 15, pct: 10.7, color: "#94a3b8" },
];

// ==============================================
// STATIC DATA
// ==============================================
const CAUSES = [
  { name: "טעינת יתר", pct: 34, col: "#ef4444" },
  { name: "סוללה לא מקורית", pct: 22, col: "#f97316" },
  { name: "פגיעה מכנית", pct: 18, col: "#f59e0b" },
  { name: "כשל בייצור", pct: 12, col: "#fbbf24" },
  { name: "טעינה בזמן חום", pct: 8, col: "#a3e635" },
  { name: "אחר / לא ידוע", pct: 6, col: "#94a3b8" },
];

const DEVICE_META: Record<string, { icon: string; color: string }> = {
  "אופניים חשמליים": { icon: "🚲", color: "#f59e0b" },
  "קורקינט חשמלי": { icon: "🛴", color: "#f97316" },
  "רכב חשמלי": { icon: "🚗", color: "#ef4444" },
  "טלפון נייד": { icon: "📱", color: "#60a5fa" },
  "מחשב נייד": { icon: "💻", color: "#818cf8" },
  "UPS/גיבוי": { icon: "🔋", color: "#34d399" },
  "סוללת כוח": { icon: "🔋", color: "#2dd4bf" },
  "כלי עבודה": { icon: "🔧", color: "#a78bfa" },
  "טרקטורון חשמלי": { icon: "🚜", color: "#dc2626" },
  "אחר": { icon: "⚡", color: "#94a3b8" },
};

const SEVERITY_COLOR: Record<string, string> = {
  "קל": "#22c55e",
  "בינוני": "#eab308",
  "חמור": "#f97316",
  "קריטי": "#ef4444",
};

// ==============================================
// HELPER: Process DB incidents
// ==============================================
function processIncidents(incidents: any[]) {
  // Device pie from DB
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

  // Monthly by year from DB
  const yearSet = new Set<number>();
  incidents.forEach(inc => yearSet.add(new Date(inc.incident_date).getFullYear()));
  const years = Array.from(yearSet).sort();

  const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  const MONTHLY: Record<number, { m: string; v: number }[]> = {};
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

  // Recent incidents for list
  const INCIDENTS_LIST = incidents
    .sort((a, b) => new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime())
    .slice(0, 50)
    .map((inc) => ({
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

  return { DEVICE_PIE, MONTHLY, DISTRICTS, INCIDENTS_LIST, years };
}

// ==============================================
// ZOOMABLE ISRAEL MAP
// ==============================================
function IsraelMap({ incidents }: { incidents: any[] }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const israelCoords = [
    [35.10, 33.08], [35.13, 33.09], [35.46, 33.09],
    [35.55, 33.26], [35.82, 33.28], [35.84, 32.87],
    [35.72, 32.71], [35.55, 32.39],
    [35.57, 32.10], [35.55, 31.87], [35.53, 31.75],
    [35.50, 31.49], [35.42, 31.10],
    [34.92, 29.50],
    [34.27, 31.22], [34.56, 31.55], [34.49, 31.61],
    [34.75, 32.07], [34.96, 32.83],
    [35.10, 33.08],
  ];

  const W = 200, H = 520;
  const center = [35.05, 31.4];
  const scale = 4200;

  const project = useCallback((lng: number, lat: number) => {
    const x = W / 2 + (lng - center[0]) * scale / 100;
    const latRad = lat * Math.PI / 180;
    const centerRad = center[1] * Math.PI / 180;
    const y = H / 2 - (Math.log(Math.tan(Math.PI / 4 + latRad / 2)) - Math.log(Math.tan(Math.PI / 4 + centerRad / 2))) * scale / 100 * (180 / Math.PI);
    return [x, y];
  }, []);

  const pathD = israelCoords.map((c, i) => {
    const [x, y] = project(c[0], c[1]);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + "Z";

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

  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ ...pan });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    setPan({ x: panStart.x + dx, y: panStart.y + dy });
  };

  const handlePointerUp = () => setDragging(false);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 6));
  const handleZoomOut = () => {
    setZoom(z => {
      const newZ = Math.max(z / 1.5, 1);
      if (newZ === 1) setPan({ x: 0, y: 0 });
      return newZ;
    });
  };
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div style={{ position: "relative" }}>
      {/* Zoom controls */}
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 20 }}>
        <button onClick={handleZoomIn} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(28,25,23,0.85)", color: "#fafaf9", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>+</button>
        <button onClick={handleZoomOut} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(28,25,23,0.85)", color: "#fafaf9", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>−</button>
        <button onClick={handleReset} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(28,25,23,0.85)", color: "#fafaf9", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>⟲</button>
      </div>

      {/* Zoom level indicator */}
      <div style={{ position: "absolute", top: 8, right: 8, fontSize: 10, color: "#78716c", background: "rgba(28,25,23,0.7)", padding: "3px 8px", borderRadius: 8, zIndex: 20 }}>
        ×{zoom.toFixed(1)}
      </div>

      {/* Hovered city tooltip */}
      {hoveredCity && (
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#fafaf9", background: "rgba(28,25,23,0.9)", padding: "5px 12px", borderRadius: 10, zIndex: 20, fontWeight: 700, border: "1px solid rgba(249,115,22,0.2)" }}>
          {hoveredCity}: {cityHeat[hoveredCity] || 0} אירועים
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`-10 -10 ${W + 20} ${H + 20}`}
        style={{ width: "100%", maxHeight: 500, cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <g transform={`translate(${W / 2 + pan.x}, ${H / 2 + pan.y}) scale(${zoom}) translate(${-W / 2}, ${-H / 2})`}>
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
                <radialGradient key={`g-${c.name}`} id={`hg-${c.name.replace(/[\s\/\"]/g, '')}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={core} stopOpacity={0.85} />
                  <stop offset="40%" stopColor={mid} stopOpacity={0.55} />
                  <stop offset="75%" stopColor={mid} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={mid} stopOpacity="0" />
                </radialGradient>
              );
            })}
          </defs>

          {/* Country outline */}
          <path d={pathD} fill="#e8e5e0" stroke="rgba(120,113,108,0.5)" strokeWidth={0.8 / zoom} strokeLinejoin="round" />

          {/* Heat circles */}
          <g clipPath="url(#israelClip)">
            {cityData.map(c => {
              const [x, y] = project(c.coords![0], c.coords![1]);
              const intensity = c.heat / maxHeat;
              const r = 4 + intensity * 14;
              return (
                <circle key={`heat-${c.name}`} cx={x} cy={y} r={r}
                  fill={`url(#hg-${c.name.replace(/[\s\/\"]/g, '')})`}
                  onPointerEnter={() => setHoveredCity(c.name)}
                  onPointerLeave={() => setHoveredCity(null)}
                  style={{ cursor: "pointer" }}>
                  <animate attributeName="r" values={`${r};${r * 1.06};${r}`} dur="5s" repeatCount="indefinite" />
                </circle>
              );
            })}
          </g>

          {/* City labels — show more when zoomed */}
          {Object.entries(cityCoords).map(([name, coords]) => {
            const [x, y] = project(coords[0], coords[1]);
            const isMain = ["חיפה", "תל אביב", "ירושלים", "באר שבע", "אילת"].includes(name);
            const isSecondary = ["נתניה", "חדרה", "אשדוד", "אשקלון", "נצרת", "עכו", "פתח תקווה", "רמת גן", "חולון", "ראשון לציון"].includes(name);
            const showLabel = isMain || (zoom >= 1.5 && isSecondary) || (zoom >= 3);
            const fontSize = isMain ? 3.5 / Math.max(zoom * 0.7, 1) : 2.8 / Math.max(zoom * 0.7, 1);

            return (
              <g key={`lbl-${name}`}>
                <circle cx={x} cy={y} r={Math.max(0.5, 0.8 / zoom)} fill="rgba(28,25,23,0.45)"
                  onPointerEnter={() => setHoveredCity(name)}
                  onPointerLeave={() => setHoveredCity(null)}
                  style={{ cursor: "pointer" }} />
                {showLabel && (
                  <text x={x} y={y - Math.max(2, 3.5 / zoom)} textAnchor="middle"
                    fill={hoveredCity === name ? "#f97316" : "rgba(28,25,23,0.75)"}
                    fontSize={fontSize} fontFamily="sans-serif" fontWeight="600"
                    stroke="#e8e5e0" strokeWidth={0.3 / Math.max(zoom * 0.7, 1)} paintOrder="stroke">
                    {name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Legend */}
          {zoom <= 1.5 && (
            <g transform={`translate(${W - 42}, ${H - 45})`}>
              <text x="0" y="0" fill="rgba(168,162,158,0.6)" fontSize="4" fontFamily="sans-serif" fontWeight="600">עוצמת אירועים</text>
              {[["מעט", "#84cc16"], ["בינוני", "#f59e0b"], ["רב", "#ef4444"]].map(([lbl, col], i) => (
                <g key={String(lbl)}>
                  <circle cx="5" cy={10 + i * 9} r="3.5" fill={String(col)} opacity="0.7" />
                  <text x="12" y={12 + i * 9} fill="rgba(168,162,158,0.5)" fontSize="3.5">{lbl}</text>
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>

      <div style={{ fontSize: 10, color: "#57534e", textAlign: "center", marginTop: 6 }}>
        🔍 גרור + לחץ +/− לזום | רזולוציה גבוהה בזום
      </div>
    </div>
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
  const [showBreakdown2019, setShowBreakdown2019] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("lithium_push") === "true"; } catch { return false; }
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Detect screen size
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    fetchNotifications();
    const t = setInterval(() => setNow(new Date()), 60000);
    // Poll notifications every 2 minutes
    const nPoll = setInterval(fetchNotifications, 120000);
    return () => { clearInterval(t); clearInterval(nPoll); };
  }, []);

  // Fetch notifications from API
  async function fetchNotifications() {
    try {
      const res = await fetch("/api/push/notifications");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setNotifications(data);
      }
    } catch {}
  }

  // Subscribe to push notifications
  async function subscribePush() {
    setPushLoading(true);
    try {
      if (!("Notification" in window)) {
        alert("הדפדפן לא תומך בהתראות");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("ההתראות לא אושרו. אנא אפשר התראות בהגדרות הדפדפן.");
        return;
      }
      // Register with our API
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          keys: {},
        }),
      });
      if (res.ok) {
        setPushEnabled(true);
        try { localStorage.setItem("lithium_push", "true"); } catch {}
        // Show a test notification
        new Notification("🔥 התראות הופעלו", {
          body: "תקבל התראה בכל פעם שמזוהה שריפת סוללת ליתיום חדשה",
          icon: "🔥",
        });
      }
    } catch (e) {
      console.error("Push subscribe error:", e);
    } finally {
      setPushLoading(false);
    }
  }

  // Process DB data
  const { DEVICE_PIE, MONTHLY, DISTRICTS, INCIDENTS_LIST, years } = useMemo(
    () => processIncidents(rawIncidents),
    [rawIncidents]
  );

  // Build combined annual data: official stats + DB for current year
  // Uses TWO series: officialFires (solid line) + partialFires (dashed line)
  const currentYear = now.getFullYear();
  const COMBINED_ANNUAL = useMemo(() => {
    const data: any[] = ANNUAL_STATS.map(s => ({
      y: `'${String(s.year).slice(2)}`,
      year: s.year,
      officialFires: s.fires,
      partialFires: null as number | null,
      fatalities: s.fatalities,
      source: s.source,
      isOfficial: true,
    }));

    // Add 2025+ from DB if they have data
    const dbYears = new Set<number>();
    rawIncidents.forEach(inc => {
      const yr = new Date(inc.incident_date).getFullYear();
      if (yr > 2024) dbYears.add(yr);
    });

    const sortedDbYears = Array.from(dbYears).sort();
    if (sortedDbYears.length > 0) {
      // Bridge: last official point also gets partialFires value for connection
      data[data.length - 1].partialFires = data[data.length - 1].officialFires;
    }

    sortedDbYears.forEach(yr => {
      const yrIncidents = rawIncidents.filter(inc => new Date(inc.incident_date).getFullYear() === yr);
      data.push({
        y: `'${String(yr).slice(2)}*`,
        year: yr,
        officialFires: null,
        partialFires: yrIncidents.length,
        fatalities: yrIncidents.reduce((s, inc) => s + (inc.fatalities || 0), 0),
        source: "סריקת מדיה (DB)",
        isOfficial: false,
      });
    });

    return data;
  }, [rawIncidents]);

  const latestYear = COMBINED_ANNUAL[COMBINED_ANNUAL.length - 1];
  const prevYear = COMBINED_ANNUAL.length >= 2 ? COMBINED_ANNUAL[COMBINED_ANNUAL.length - 2] : null;
  const getFireCount = (d: any) => d?.officialFires ?? d?.partialFires ?? 0;
  const growthPct = prevYear && getFireCount(prevYear) > 0
    ? Math.round((getFireCount(latestYear) - getFireCount(prevYear)) / getFireCount(prevYear) * 100)
    : 0;
  const totalFires = COMBINED_ANNUAL.reduce((s, d) => s + (d.officialFires || d.partialFires || 0), 0);
  const totalFatalities = COMBINED_ANNUAL.reduce((s, d) => s + d.fatalities, 0);

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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(175deg, #1a0c02 0%, #0d0d0d 25%, #111010 60%, #0a0a0a 100%)",
      color: "#fafaf9",
      fontFamily: "'Rubik', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      maxWidth: isDesktop ? 1400 : 430,
      margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap');
        @media (min-width: 900px) {
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        }
      `}</style>
      <div style={{ position: "fixed", top: -100, left: "50%", transform: "translateX(-50%)", width: 500, height: 350, background: "radial-gradient(ellipse, rgba(249,115,22,0.1) 0%, rgba(239,68,68,0.05) 40%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <div style={{ padding: isDesktop ? "30px 32px 16px" : "50px 20px 12px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: isDesktop ? 14 : 10 }}>
            <div style={{ width: isDesktop ? 48 : 40, height: isDesktop ? 48 : 40, borderRadius: 12, background: "linear-gradient(135deg, #ef4444, #f97316, #fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isDesktop ? 24 : 20, boxShadow: "0 4px 20px rgba(249,115,22,0.35)" }}>🔥</div>
            <div>
              <div style={{ fontSize: isDesktop ? 12 : 10, color: "#78716c", fontWeight: 500, textTransform: "uppercase", letterSpacing: 2 }}>כבאות והצלה לישראל</div>
              <div style={{ fontSize: isDesktop ? 26 : 20, fontWeight: 800, letterSpacing: -0.3 }}>מעקב שריפות סוללות ליתיום יון</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Bell icon */}
            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setShowNotifPanel(!showNotifPanel)}>
              <span style={{ fontSize: 20 }}>🔔</span>
              {unreadCount > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -6,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "#fff",
                  boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                }}>{unreadCount}</div>
              )}
            </div>
            {/* LIVE DB badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 16, background: dbConnected ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: dbConnected ? "#22c55e" : "#ef4444", boxShadow: `0 0 10px ${dbConnected ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}` }} />
              <span style={{ fontSize: 11, color: dbConnected ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{dbConnected ? "LIVE DB" : "OFFLINE"}</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#57534e", marginTop: 6 }}>
          נתונים רשמיים 2017-2024 + {rawIncidents.length} אירועים פרטניים ב-DB • {now.toLocaleDateString("he-IL")}
          {lastScan && <span> • סריקה אחרונה: {lastScan}</span>}
        </div>
      </div>

      {/* Notification Panel (dropdown) */}
      {showNotifPanel && (
        <div style={{
          position: "absolute", top: 100, left: 14, right: 14,
          zIndex: 100, borderRadius: 16,
          background: "rgba(28,25,23,0.97)", border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: 400, overflow: "auto",
        }}>
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🔔 התראות</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!pushEnabled && (
                <button onClick={subscribePush} disabled={pushLoading}
                  style={{
                    padding: "5px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #f97316, #ef4444)", color: "#fff",
                    fontSize: 10, fontWeight: 700, opacity: pushLoading ? 0.5 : 1,
                  }}>
                  {pushLoading ? "..." : "הפעל התראות"}
                </button>
              )}
              {pushEnabled && (
                <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>✅ התראות פעילות</span>
              )}
              <span onClick={() => setShowNotifPanel(false)} style={{ cursor: "pointer", fontSize: 16, color: "#78716c" }}>✕</span>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
              <div style={{ fontSize: 12, color: "#78716c" }}>אין התראות עדיין</div>
              <div style={{ fontSize: 10, color: "#57534e", marginTop: 4 }}>כשתזוהה שריפת ליתיום חדשה, תקבל התראה כאן</div>
            </div>
          ) : (
            <div>
              {notifications.slice(0, 15).map((n: any, i: number) => (
                <div key={n.id || i} style={{
                  padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: !n.read ? "rgba(249,115,22,0.04)" : "transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{n.title}</div>
                    <div style={{
                      fontSize: 8, padding: "2px 6px", borderRadius: 6, fontWeight: 700, marginRight: 4,
                      background: n.severity === "קריטי" ? "rgba(239,68,68,0.15)" : n.severity === "חמור" ? "rgba(249,115,22,0.15)" : "rgba(234,179,8,0.15)",
                      color: n.severity === "קריטי" ? "#ef4444" : n.severity === "חמור" ? "#f97316" : "#eab308",
                    }}>{n.severity}</div>
                  </div>
                  <div style={{ fontSize: 10, color: "#a8a29e", marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
                  <div style={{ fontSize: 9, color: "#57534e", marginTop: 4 }}>{new Date(n.sent_at).toLocaleString("he-IL")}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: isDesktop ? "0 32px 40px" : "0 14px 100px", position: "relative", zIndex: 10 }}>

        {/* ===== HOME ===== */}
        {tab === "home" && (
          <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: isDesktop ? 20 : 14 }}>
            {/* Alert — full width */}
            <div style={{ padding: "12px 14px", borderRadius: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", display: "flex", alignItems: "center", gap: 10, gridColumn: isDesktop ? "1 / -1" : undefined }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}>מגמה עולה מתמשכת</div>
                <div style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.5 }}>
                  עלייה של {Math.round(((ANNUAL_STATS[ANNUAL_STATS.length - 1].fires - ANNUAL_STATS[0].fires) / ANNUAL_STATS[0].fires) * 100)}% משנת {ANNUAL_STATS[0].year} • ~5 הרוגים בשנה בממוצע • ~150 דירות נשרפות בשנה
                </div>
              </div>
            </div>

            {/* Hero - Total stats */}
            <div style={{ padding: 22, borderRadius: 22, background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.12)", position: "relative", overflow: "hidden", gridColumn: isDesktop ? "1 / -1" : undefined }}>
              <div style={{ position: "absolute", top: -25, left: -25, width: 100, height: 100, borderRadius: "50%", background: "rgba(249,115,22,0.06)", filter: "blur(25px)" }} />
              <div style={{ fontSize: 11, color: "#d6d3d1", fontWeight: 500 }}>סה״כ שריפות מתועדות 2017-{latestYear?.year}</div>
              <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginTop: 4 }}>{totalFires.toLocaleString()}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{totalFatalities}</span><span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}> הרוגים</span></div>
                <div><span style={{ fontSize: 20, fontWeight: 800, color: "#f97316" }}>~150</span><span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}> דירות/שנה</span></div>
                <div style={{ marginRight: "auto" }}><span style={{ fontSize: 14, fontWeight: 800, color: growthPct > 0 ? "#ef4444" : "#34d399" }}>{growthPct > 0 ? "▲" : "▼"} {Math.abs(growthPct)}%</span><span style={{ fontSize: 10, color: "#78716c", marginRight: 4 }}> {latestYear?.year} מ-{prevYear?.year}</span></div>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 8, gridColumn: isDesktop ? "1 / -1" : undefined }}>
              {[
                { v: `${getFireCount(latestYear)}`, l: `שריפות ${latestYear?.year}`, icon: "🔥", col: "#f97316" },
                { v: "~60%", l: "מחוז דן", icon: "📍", col: "#fbbf24" },
                { v: "34%", l: "טעינת יתר", icon: "🔌", col: "#ef4444" },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, padding: "12px 8px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 3, color: s.col }}>{s.v}</div>
                  <div style={{ fontSize: 9, color: "#78716c", marginTop: 2 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* ===== OFFICIAL ANNUAL TREND ===== */}
            <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📊 סטטיסטיקה שנתית — כבאות והצלה</div>
              <div style={{ fontSize: 10, color: "#78716c", marginBottom: 12 }}>נתונים רשמיים • * = סריקת מדיה (חלקי)</div>
              <ResponsiveContainer width="100%" height={isDesktop ? 320 : 200}>
                <ComposedChart data={COMBINED_ANNUAL} margin={{ left: 5, right: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="y" tick={{ fill: "#78716c", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis hide />
                  <Tooltip
                    {...tip}
                    formatter={(value: any, name: string) => {
                      if (name === "שריפות (רשמי)") return [value, "🔥 שריפות (רשמי)"];
                      if (name === "סריקת מדיה (חלקי)") return [value, "📰 סריקת מדיה (חלקי)"];
                      if (name === "הרוגים") return [value, "💀 הרוגים"];
                      return [value, name];
                    }}
                    labelFormatter={(label: string) => {
                      const item = COMBINED_ANNUAL.find(d => d.y === label);
                      return item ? `${item.year} (${item.source})` : label;
                    }}
                  />
                  {/* Solid line — official annual stats */}
                  <Area type="monotone" dataKey="officialFires" stroke="#f97316" fill="url(#fireGrad)" strokeWidth={2.5} connectNulls={false}
                    dot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
                    name="שריפות (רשמי)" />
                  {/* Dashed line — partial media-scanned data */}
                  <Line type="monotone" dataKey="partialFires" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="8 4" connectNulls={false}
                    dot={{ r: 4, fill: "#fbbf24", stroke: "#fff", strokeWidth: 1.5 }}
                    name="סריקת מדיה (חלקי)" />
                  <Bar dataKey="fatalities" fill="#ef4444" barSize={10} radius={[4, 4, 0, 0]} name="הרוגים" opacity={0.7} />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Legend for line styles */}
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#f97316" strokeWidth="2.5" /></svg>
                  <span style={{ fontSize: 9, color: "#a8a29e" }}>נתונים רשמיים</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="5 3" /></svg>
                  <span style={{ fontSize: 9, color: "#a8a29e" }}>סריקת מדיה (חלקי)</span>
                </div>
              </div>

              {/* Annual data table */}
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 4, fontSize: 9, color: "#78716c", fontWeight: 700, marginBottom: 6, textAlign: "center" }}>
                  <div>שנה</div><div>שריפות</div><div>הרוגים</div><div>מקור</div>
                </div>
                {COMBINED_ANNUAL.map(d => (
                  <div key={d.year} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 4, fontSize: 10, textAlign: "center", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <div style={{ color: "#a8a29e", fontWeight: 700 }}>{d.year}</div>
                    <div style={{ color: "#f97316", fontWeight: 800 }}>{d.officialFires ?? d.partialFires ?? 0}</div>
                    <div style={{ color: d.fatalities > 0 ? "#ef4444" : "#57534e", fontWeight: 700 }}>{d.fatalities || "—"}</div>
                    <div style={{ color: "#78716c", fontSize: 9 }}>{d.source}{!d.isOfficial ? " *" : ""}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device breakdown 2019 toggle */}
            <div style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div onClick={() => setShowBreakdown2019(!showBreakdown2019)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>📱 פילוח לפי סוג אמצעי (2019)</div>
                <span style={{ fontSize: 12, color: "#78716c" }}>{showBreakdown2019 ? "▲" : "▼"}</span>
              </div>
              <div style={{ fontSize: 10, color: "#78716c", marginTop: 4 }}>השנה היחידה עם פילוח פומבי מלא (כלכליסט)</div>

              {showBreakdown2019 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <ResponsiveContainer width="45%" height={120}>
                      <PieChart>
                        <Pie data={DEVICE_BREAKDOWN_2019.map(d => ({ name: d.name, value: d.count }))} cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={3} dataKey="value" stroke="none">
                          {DEVICE_BREAKDOWN_2019.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ flex: 1 }}>
                      {DEVICE_BREAKDOWN_2019.map(d => (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: "#a8a29e", flex: 1 }}>{d.name}</span>
                          <span style={{ fontSize: 10, color: "#78716c" }}>{d.count}</span>
                          <span style={{ fontSize: 11, fontWeight: 800 }}>{d.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#57534e", marginTop: 8, padding: 8, borderRadius: 8, background: "rgba(249,115,22,0.04)" }}>
                    ℹ️ שנים 2020-2024: לא פורסם פילוח. כבאות מציינים "הרוב המוחלט מאופניים חשמליים". פילוח מלא קיים רק במערכת הפנימית.
                  </div>
                </div>
              )}
            </div>

            {/* Pie — DB incidents */}
            {DEVICE_PIE.length > 0 && (
              <div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>📊 פילוח אירועים מה-DB ({rawIncidents.length})</div>
                <div style={{ fontSize: 10, color: "#78716c", marginBottom: 8 }}>אירועים פרטניים שנאספו מסריקת מדיה</div>
                {selPie && <div style={{ fontSize: 13, color: DEVICE_PIE.find(d => d.n === selPie)?.c || "#f97316", fontWeight: 700, marginTop: 4 }}>{selPie}</div>}
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
            )}

            {/* Smart Trend */}
            <div style={{ padding: 16, borderRadius: 20, background: "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(239,68,68,0.03))", border: "1px solid rgba(249,115,22,0.08)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🧠 ניתוח מגמה</div>
              <div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>מגמה</span>
                  עלייה של <strong style={{ color: "#ef4444" }}>229%</strong> בשריפות מ-2017 (76) ל-2024 (250). גידול ממוצע ~20% בשנה.
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(249,115,22,0.1)", color: "#fdba74", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>עונתיות</span>
                  יוני-אוגוסט מהווים ~33% מהאירועים. טמפרטורות מעל 35°C מגבירות סיכון ל-thermal runaway.
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(251,191,36,0.1)", color: "#fde68a", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>גאוגרפיה</span>
                  ~50-60% מהשריפות במחוז דן. צפיפות + ריכוז שימוש באופניים חשמליים.
                </div>
                <div>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#93c5fd", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>נתוני 2025+</span>
                  {dbConnected ? `✅ ${rawIncidents.filter(i => new Date(i.incident_date).getFullYear() >= 2025).length} אירועים מסריקת מדיה אוטומטית` : "⚠️ ממתין לחיבור DB"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== MAP ===== */}
        {tab === "map" && (
          <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1.5fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: isDesktop ? 20 : 14 }}>
            <div style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🗺️ מפת חום — אירועים לפי עיר</div>
              <IsraelMap incidents={rawIncidents} />
            </div>

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
          <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: isDesktop ? 20 : 14 }}>
            {/* Monthly from DB */}
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
              <div style={{ fontSize: 10, color: "#78716c", marginBottom: 8 }}>נתונים חודשיים מאירועים פרטניים ב-DB בלבד</div>
              <ResponsiveContainer width="100%" height={isDesktop ? 280 : 170}>
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
              <div style={{ fontSize: 10, color: "#57534e", marginTop: 6, padding: 8, borderRadius: 8, background: "rgba(59,130,246,0.04)" }}>
                ℹ️ <strong>לגבי נתונים חודשיים רשמיים:</strong> כבאות והצלה לא מפרסמים נתונים ברמה חודשית לציבור. הנתונים כאן הם מאירועים פרטניים שנאספו מסריקת מדיה ({rawIncidents.filter(i => new Date(i.incident_date).getFullYear() === seasonYear).length} מתוך {ANNUAL_STATS.find(s => s.year === seasonYear)?.fires || "?"} שריפות ב-{seasonYear}).
              </div>
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
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, padding: "0 4px 4px" }}>🔥 אירועים מתועדים ({INCIDENTS_LIST.length})</div>
            <div style={{ fontSize: 11, color: "#78716c", padding: "0 4px 10px" }}>נתונים מ-Supabase • ממוינים מהחדש לישן</div>
            <div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: 8 }}>
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
          </div>
        )}

        {/* ===== SYSTEM ===== */}
        {tab === "system" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                  { v: String(ANNUAL_STATS.length), l: "שנים רשמיות", col: "#3b82f6" },
                  { v: lastScan ? "✅" : "—", l: "סריקה אחרונה", col: "#f97316" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: s.col }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: "#78716c" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture */}
            <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏗️ ארכיטקטורה</div>
              <div style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#f97316" }}>שכבה 1:</strong> סטטיסטיקה שנתית 2017-2024 (נתונים רשמיים hardcoded)</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#fbbf24" }}>שכבה 2:</strong> אירועים פרטניים ב-Supabase (131 אירועים מסריקת מדיה)</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#22c55e" }}>שכבה 3:</strong> RSS + Gemini סורק מדיה אוטומטי (כל 6 שעות)</div>
                <div><strong style={{ color: "#3b82f6" }}>2026+:</strong> נתונים חדשים יוזנו אוטומטית ויופיעו בגרף השנתי</div>
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>📰 מקורות מידע</div>
              {[
                { icon: "🚒", name: "כבאות והצלה", det: "דוברות ארצית + מחוזות, אתר 102", col: "#ef4444" },
                { icon: "📰", name: "חדשות ארציות", det: "ynet, כלכליסט, הארץ, וואלה, מעריב, מאקו", col: "#f97316" },
                { icon: "📍", name: "חדשות מקומיות", det: "חי פה, NWS, ניוזים, כיכר השבת, JDN", col: "#fbbf24" },
                { icon: "🏛️", name: "ממשלתי", det: "משרד התחבורה, רשות הכבאות, מרכז המחקר של הכנסת", col: "#34d399" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
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
                Next.js + Supabase + Gemini AI • גרסה 3.2
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 14, background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#fca5a5" }}>⚠️ אזהרות שימוש</div>
              <div style={{ fontSize: 10.5, color: "#a8a29e", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#d6d3d1" }}>1. כלי ניסיוני</strong> — מערכת זו פותחה כפרויקט ניסיוני ואינה מערכת רשמית.</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#d6d3d1" }}>2. נתונים חלקיים</strong> — ~3% מהשריפות מקבלות כיסוי תקשורתי מפורט. הנתונים השנתיים הרשמיים מלאים.</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#d6d3d1" }}>3. אין אחריות</strong> — המפתח אינו נושא באחריות לנזק.</div>
                <div><strong style={{ color: "#d6d3d1" }}>4. מקורות רשמיים</strong> — למידע מדויק יש לפנות לנציבות כבאות והצלה לישראל.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{
        position: "fixed",
        ...(isDesktop ? {
          top: "50%", left: 20, transform: "translateY(-50%)",
          flexDirection: "column" as const,
          borderRadius: 20, padding: "8px 5px",
        } : {
          bottom: 20, left: "50%", transform: "translateX(-50%)",
          borderRadius: 26, padding: "5px 6px",
        }),
        background: "rgba(28,25,23,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        display: "flex", gap: 3, zIndex: 100,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelInc(null); }} style={{
            width: isDesktop ? 56 : 60, padding: "9px 0", borderRadius: isDesktop ? 16 : 22, border: "none", cursor: "pointer",
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
        נתונים רשמיים 2017-2024 + {rawIncidents.length} אירועים ב-DB • {now.toLocaleDateString("he-IL")}
      </div>
    </div>
  );
}
