<html><body><pre style='white-space:pre-wrap;font-size:11px;font-family:monospace;'>
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
// OFFICIAL ANNUAL STATISTICS — Fire &amp; Rescue Israel
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

const DEVICE_META: Record&lt;string, { icon: string; color: string }&gt; = {
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

const SEVERITY_COLOR: Record&lt;string, string&gt; = {
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
  const deviceMap: Record&lt;string, number&gt; = {};
  incidents.forEach(inc =&gt; {
    const dt = inc.device_type || "אחר";
    deviceMap[dt] = (deviceMap[dt] || 0) + 1;
  });
  const DEVICE_PIE = Object.entries(deviceMap)
    .sort((a, b) =&gt; b[1] - a[1])
    .map(([name, count]) =&gt; ({
      n: name,
      v: count,
      c: DEVICE_META[name]?.color || "#94a3b8",
    }));

  // Monthly by year from DB
  const yearSet = new Set&lt;number&gt;();
  incidents.forEach(inc =&gt; yearSet.add(new Date(inc.incident_date).getFullYear()));
  const years = Array.from(yearSet).sort();

  const monthNames = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
  const MONTHLY: Record&lt;number, { m: string; v: number }[]&gt; = {};
  years.forEach(yr =&gt; {
    const monthCounts = new Array(12).fill(0);
    incidents.forEach(inc =&gt; {
      const d = new Date(inc.incident_date);
      if (d.getFullYear() === yr) monthCounts[d.getMonth()]++;
    });
    MONTHLY[yr] = monthNames.map((m, i) =&gt; ({ m, v: monthCounts[i] }));
  });

  // District distribution
  const districtMap: Record&lt;string, number&gt; = {};
  incidents.forEach(inc =&gt; {
    const d = inc.district || "אחר";
    districtMap[d] = (districtMap[d] || 0) + 1;
  });
  const total = incidents.length;
  const DISTRICTS = Object.entries(districtMap)
    .sort((a, b) =&gt; b[1] - a[1])
    .map(([n, count]) =&gt; ({ n, pct: Math.round(count / total * 100) }));

  // Recent incidents for list
  const INCIDENTS_LIST = incidents
    .sort((a, b) =&gt; new Date(b.incident_date).getTime() - new Date(a.incident_date).getTime())
    .slice(0, 50)
    .map((inc) =&gt; ({
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
  const [hoveredCity, setHoveredCity] = useState&lt;string | null&gt;(null);
  const svgRef = useRef&lt;SVGSVGElement&gt;(null);

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

  const project = useCallback((lng: number, lat: number) =&gt; {
    const x = W / 2 + (lng - center[0]) * scale / 100;
    const latRad = lat * Math.PI / 180;
    const centerRad = center[1] * Math.PI / 180;
    const y = H / 2 - (Math.log(Math.tan(Math.PI / 4 + latRad / 2)) - Math.log(Math.tan(Math.PI / 4 + centerRad / 2))) * scale / 100 * (180 / Math.PI);
    return [x, y];
  }, []);

  const pathD = israelCoords.map((c, i) =&gt; {
    const [x, y] = project(c[0], c[1]);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + "Z";

  const cityHeat: Record&lt;string, number&gt; = {};
  incidents.forEach(inc =&gt; {
    cityHeat[inc.city] = (cityHeat[inc.city] || 0) + 1;
  });

  const cityCoords: Record&lt;string, [number, number]&gt; = {
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

  const cityData = Object.entries(cityHeat).map(([name, heat]) =&gt; ({
    name,
    coords: cityCoords[name],
    heat,
  })).filter(c =&gt; c.coords);

  const handlePointerDown = (e: React.PointerEvent) =&gt; {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ ...pan });
  };

  const handlePointerMove = (e: React.PointerEvent) =&gt; {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    setPan({ x: panStart.x + dx, y: panStart.y + dy });
  };

  const handlePointerUp = () =&gt; setDragging(false);

  const handleZoomIn = () =&gt; setZoom(z =&gt; Math.min(z * 1.5, 6));
  const handleZoomOut = () =&gt; {
    setZoom(z =&gt; {
      const newZ = Math.max(z / 1.5, 1);
      if (newZ === 1) setPan({ x: 0, y: 0 });
      return newZ;
    });
  };
  const handleReset = () =&gt; { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    &lt;div style={{ position: "relative" }}&gt;
      {/* Zoom controls */}
      &lt;div style={{ position: "absolute", top: 8, left: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 20 }}&gt;
        &lt;button onClick={handleZoomIn} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(28,25,23,0.85)", color: "#fafaf9", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}&gt;+&lt;/button&gt;
        &lt;button onClick={handleZoomOut} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(28,25,23,0.85)", color: "#fafaf9", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}&gt;−&lt;/button&gt;
        &lt;button onClick={handleReset} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(28,25,23,0.85)", color: "#fafaf9", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}&gt;⟲&lt;/button&gt;
      &lt;/div&gt;

      {/* Zoom level indicator */}
      &lt;div style={{ position: "absolute", top: 8, right: 8, fontSize: 10, color: "#78716c", background: "rgba(28,25,23,0.7)", padding: "3px 8px", borderRadius: 8, zIndex: 20 }}&gt;
        ×{zoom.toFixed(1)}
      &lt;/div&gt;

      {/* Hovered city tooltip */}
      {hoveredCity &amp;&amp; (
        &lt;div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#fafaf9", background: "rgba(28,25,23,0.9)", padding: "5px 12px", borderRadius: 10, zIndex: 20, fontWeight: 700, border: "1px solid rgba(249,115,22,0.2)" }}&gt;
          {hoveredCity}: {cityHeat[hoveredCity] || 0} אירועים
        &lt;/div&gt;
      )}

      &lt;svg
        ref={svgRef}
        viewBox={`-10 -10 ${W + 20} ${H + 20}`}
        style={{ width: "100%", maxHeight: 500, cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      &gt;
        &lt;g transform={`translate(${W / 2 + pan.x}, ${H / 2 + pan.y}) scale(${zoom}) translate(${-W / 2}, ${-H / 2})`}&gt;
          &lt;defs&gt;
            &lt;clipPath id="israelClip"&gt;&lt;path d={pathD} /&gt;&lt;/clipPath&gt;
            {cityData.map(c =&gt; {
              const intensity = c.heat / maxHeat;
              let core, mid;
              if (intensity &gt; 0.7) { core = "#dc2626"; mid = "#ef4444"; }
              else if (intensity &gt; 0.5) { core = "#ea580c"; mid = "#f97316"; }
              else if (intensity &gt; 0.3) { core = "#d97706"; mid = "#f59e0b"; }
              else if (intensity &gt; 0.15) { core = "#ca8a04"; mid = "#eab308"; }
              else { core = "#65a30d"; mid = "#84cc16"; }
              return (
                &lt;radialGradient key={`g-${c.name}`} id={`hg-${c.name.replace(/[\s\/\"]/g, '')}`} cx="50%" cy="50%" r="50%"&gt;
                  &lt;stop offset="0%" stopColor={core} stopOpacity={0.85} /&gt;
                  &lt;stop offset="40%" stopColor={mid} stopOpacity={0.55} /&gt;
                  &lt;stop offset="75%" stopColor={mid} stopOpacity={0.2} /&gt;
                  &lt;stop offset="100%" stopColor={mid} stopOpacity="0" /&gt;
                &lt;/radialGradient&gt;
              );
            })}
          &lt;/defs&gt;

          {/* Country outline */}
          &lt;path d={pathD} fill="#e8e5e0" stroke="rgba(120,113,108,0.5)" strokeWidth={0.8 / zoom} strokeLinejoin="round" /&gt;

          {/* Heat circles */}
          &lt;g clipPath="url(#israelClip)"&gt;
            {cityData.map(c =&gt; {
              const [x, y] = project(c.coords![0], c.coords![1]);
              const intensity = c.heat / maxHeat;
              const r = 4 + intensity * 14;
              return (
                &lt;circle key={`heat-${c.name}`} cx={x} cy={y} r={r}
                  fill={`url(#hg-${c.name.replace(/[\s\/\"]/g, '')})`}
                  onPointerEnter={() =&gt; setHoveredCity(c.name)}
                  onPointerLeave={() =&gt; setHoveredCity(null)}
                  style={{ cursor: "pointer" }}&gt;
                  &lt;animate attributeName="r" values={`${r};${r * 1.06};${r}`} dur="5s" repeatCount="indefinite" /&gt;
                &lt;/circle&gt;
              );
            })}
          &lt;/g&gt;

          {/* City labels — show more when zoomed */}
          {Object.entries(cityCoords).map(([name, coords]) =&gt; {
            const [x, y] = project(coords[0], coords[1]);
            const isMain = ["חיפה", "תל אביב", "ירושלים", "באר שבע", "אילת"].includes(name);
            const isSecondary = ["נתניה", "חדרה", "אשדוד", "אשקלון", "נצרת", "עכו", "פתח תקווה", "רמת גן", "חולון", "ראשון לציון"].includes(name);
            const showLabel = isMain || (zoom &gt;= 1.5 &amp;&amp; isSecondary) || (zoom &gt;= 3);
            const fontSize = isMain ? 3.5 / Math.max(zoom * 0.7, 1) : 2.8 / Math.max(zoom * 0.7, 1);

            return (
              &lt;g key={`lbl-${name}`}&gt;
                &lt;circle cx={x} cy={y} r={Math.max(0.5, 0.8 / zoom)} fill="rgba(28,25,23,0.45)"
                  onPointerEnter={() =&gt; setHoveredCity(name)}
                  onPointerLeave={() =&gt; setHoveredCity(null)}
                  style={{ cursor: "pointer" }} /&gt;
                {showLabel &amp;&amp; (
                  &lt;text x={x} y={y - Math.max(2, 3.5 / zoom)} textAnchor="middle"
                    fill={hoveredCity === name ? "#f97316" : "rgba(28,25,23,0.75)"}
                    fontSize={fontSize} fontFamily="sans-serif" fontWeight="600"
                    stroke="#e8e5e0" strokeWidth={0.3 / Math.max(zoom * 0.7, 1)} paintOrder="stroke"&gt;
                    {name}
                  &lt;/text&gt;
                )}
              &lt;/g&gt;
            );
          })}

          {/* Legend */}
          {zoom &lt;= 1.5 &amp;&amp; (
            &lt;g transform={`translate(${W - 42}, ${H - 45})`}&gt;
              &lt;text x="0" y="0" fill="rgba(168,162,158,0.6)" fontSize="4" fontFamily="sans-serif" fontWeight="600"&gt;עוצמת אירועים&lt;/text&gt;
              {[["מעט", "#84cc16"], ["בינוני", "#f59e0b"], ["רב", "#ef4444"]].map(([lbl, col], i) =&gt; (
                &lt;g key={String(lbl)}&gt;
                  &lt;circle cx="5" cy={10 + i * 9} r="3.5" fill={String(col)} opacity="0.7" /&gt;
                  &lt;text x="12" y={12 + i * 9} fill="rgba(168,162,158,0.5)" fontSize="3.5"&gt;{lbl}&lt;/text&gt;
                &lt;/g&gt;
              ))}
            &lt;/g&gt;
          )}
        &lt;/g&gt;
      &lt;/svg&gt;

      &lt;div style={{ fontSize: 10, color: "#57534e", textAlign: "center", marginTop: 6 }}&gt;
        🔍 גרור + לחץ +/− לזום | רזולוציה גבוהה בזום
      &lt;/div&gt;
    &lt;/div&gt;
  );
}

// ==============================================
// MAIN DASHBOARD
// ==============================================
export default function LithiumDashboard() {
  const [tab, setTab] = useState("home");
  const [selInc, setSelInc] = useState&lt;any&gt;(null);
  const [now, setNow] = useState(new Date());
  const [seasonYear, setSeasonYear] = useState(2024);
  const [selPie, setSelPie] = useState&lt;string | null&gt;(null);
  const [rawIncidents, setRawIncidents] = useState&lt;any[]&gt;([]);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [lastScan, setLastScan] = useState&lt;string | null&gt;(null);
  const [showBreakdown2019, setShowBreakdown2019] = useState(false);
  const [notifications, setNotifications] = useState&lt;any[]&gt;([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() =&gt; {
    try { return typeof window !== "undefined" &amp;&amp; localStorage.getItem("lithium_push") === "true"; } catch { return false; }
  });
  const [pushLoading, setPushLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const unreadCount = notifications.filter(n =&gt; !n.read).length;

  // Detect screen size
  useEffect(() =&gt; {
    const check = () =&gt; setIsDesktop(window.innerWidth &gt;= 900);
    check();
    window.addEventListener("resize", check);
    return () =&gt; window.removeEventListener("resize", check);
  }, []);

  // Fetch from Supabase
  useEffect(() =&gt; {
    async function fetchData() {
      try {
        const { data, error } = await supabase
          .from("incidents")
          .select("*")
          .order("incident_date", { ascending: false });
        if (error) throw error;
        if (data &amp;&amp; data.length &gt; 0) {
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
        if (data &amp;&amp; data.length &gt; 0) {
          setLastScan(new Date(data[0].scan_time).toLocaleString("he-IL"));
        }
      } catch {}
    }

    fetchData();
    fetchLastScan();
    fetchNotifications();
    const t = setInterval(() =&gt; setNow(new Date()), 60000);
    // Poll notifications every 2 minutes
    const nPoll = setInterval(fetchNotifications, 120000);
    return () =&gt; { clearInterval(t); clearInterval(nPoll); };
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
    () =&gt; processIncidents(rawIncidents),
    [rawIncidents]
  );

  // Build combined annual data: official stats + DB for current year
  // Uses TWO series: officialFires (solid line) + partialFires (dashed line)
  const currentYear = now.getFullYear();
  const COMBINED_ANNUAL = useMemo(() =&gt; {
    const data: any[] = ANNUAL_STATS.map(s =&gt; ({
      y: `'${String(s.year).slice(2)}`,
      year: s.year,
      officialFires: s.fires,
      partialFires: null as number | null,
      fatalities: s.fatalities,
      source: s.source,
      isOfficial: true,
    }));

    // Add 2025+ from DB if they have data
    const dbYears = new Set&lt;number&gt;();
    rawIncidents.forEach(inc =&gt; {
      const yr = new Date(inc.incident_date).getFullYear();
      if (yr &gt; 2024) dbYears.add(yr);
    });

    const sortedDbYears = Array.from(dbYears).sort();
    if (sortedDbYears.length &gt; 0) {
      // Bridge: last official point also gets partialFires value for connection
      data[data.length - 1].partialFires = data[data.length - 1].officialFires;
    }

    sortedDbYears.forEach(yr =&gt; {
      const yrIncidents = rawIncidents.filter(inc =&gt; new Date(inc.incident_date).getFullYear() === yr);
      data.push({
        y: `'${String(yr).slice(2)}*`,
        year: yr,
        officialFires: null,
        partialFires: yrIncidents.length,
        fatalities: yrIncidents.reduce((s, inc) =&gt; s + (inc.fatalities || 0), 0),
        source: "סריקת מדיה (DB)",
        isOfficial: false,
      });
    });

    return data;
  }, [rawIncidents]);

  const latestYear = COMBINED_ANNUAL[COMBINED_ANNUAL.length - 1];
  const prevYear = COMBINED_ANNUAL.length &gt;= 2 ? COMBINED_ANNUAL[COMBINED_ANNUAL.length - 2] : null;
  const getFireCount = (d: any) =&gt; d?.officialFires ?? d?.partialFires ?? 0;
  const growthPct = prevYear &amp;&amp; getFireCount(prevYear) &gt; 0
    ? Math.round((getFireCount(latestYear) - getFireCount(prevYear)) / getFireCount(prevYear) * 100)
    : 0;
  const totalFires = COMBINED_ANNUAL.reduce((s, d) =&gt; s + (d.officialFires || d.partialFires || 0), 0);
  const totalFatalities = COMBINED_ANNUAL.reduce((s, d) =&gt; s + d.fatalities, 0);

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
      &lt;div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fafaf9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Rubik', sans-serif" }}&gt;
        &lt;div style={{ textAlign: "center" }}&gt;
          &lt;div style={{ fontSize: 40, marginBottom: 16 }}&gt;🔥&lt;/div&gt;
          &lt;div style={{ fontSize: 16, fontWeight: 700 }}&gt;טוען נתונים...&lt;/div&gt;
          &lt;div style={{ fontSize: 12, color: "#78716c", marginTop: 6 }}&gt;מתחבר למסד הנתונים&lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    );
  }

  return (
    &lt;div style={{
      minHeight: "100vh",
      background: "linear-gradient(175deg, #1a0c02 0%, #0d0d0d 25%, #111010 60%, #0a0a0a 100%)",
      color: "#fafaf9",
      fontFamily: "'Rubik', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif",
      maxWidth: isDesktop ? 1400 : 430,
      margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    }}&gt;
      &lt;style&gt;{`@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&amp;display=swap');
        @media (min-width: 900px) {
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        }
      `}&lt;/style&gt;
      &lt;div style={{ position: "fixed", top: -100, left: "50%", transform: "translateX(-50%)", width: 500, height: 350, background: "radial-gradient(ellipse, rgba(249,115,22,0.1) 0%, rgba(239,68,68,0.05) 40%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} /&gt;

      {/* Header */}
      &lt;div style={{ padding: isDesktop ? "30px 32px 16px" : "50px 20px 12px", position: "relative", zIndex: 10 }}&gt;
        &lt;div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}&gt;
          &lt;div style={{ display: "flex", alignItems: "center", gap: isDesktop ? 14 : 10 }}&gt;
            &lt;div style={{ width: isDesktop ? 48 : 40, height: isDesktop ? 48 : 40, borderRadius: 12, background: "linear-gradient(135deg, #ef4444, #f97316, #fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isDesktop ? 24 : 20, boxShadow: "0 4px 20px rgba(249,115,22,0.35)" }}&gt;🔥&lt;/div&gt;
            &lt;div&gt;
              &lt;div style={{ fontSize: isDesktop ? 12 : 10, color: "#78716c", fontWeight: 500, textTransform: "uppercase", letterSpacing: 2 }}&gt;כבאות והצלה לישראל&lt;/div&gt;
              &lt;div style={{ fontSize: isDesktop ? 26 : 20, fontWeight: 800, letterSpacing: -0.3 }}&gt;מעקב שריפות סוללות ליתיום יון&lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
          &lt;div style={{ display: "flex", alignItems: "center", gap: 8 }}&gt;
            {/* Bell icon */}
            &lt;div style={{ position: "relative", cursor: "pointer" }} onClick={() =&gt; setShowNotifPanel(!showNotifPanel)}&gt;
              &lt;span style={{ fontSize: 20 }}&gt;🔔&lt;/span&gt;
              {unreadCount &gt; 0 &amp;&amp; (
                &lt;div style={{
                  position: "absolute", top: -4, right: -6,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "#fff",
                  boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                }}&gt;{unreadCount}&lt;/div&gt;
              )}
            &lt;/div&gt;
            {/* LIVE DB badge */}
            &lt;div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 16, background: dbConnected ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}&gt;
              &lt;div style={{ width: 6, height: 6, borderRadius: "50%", background: dbConnected ? "#22c55e" : "#ef4444", boxShadow: `0 0 10px ${dbConnected ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}` }} /&gt;
              &lt;span style={{ fontSize: 11, color: dbConnected ? "#22c55e" : "#ef4444", fontWeight: 600 }}&gt;{dbConnected ? "LIVE DB" : "OFFLINE"}&lt;/span&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
        &lt;div style={{ fontSize: 11, color: "#57534e", marginTop: 6 }}&gt;
          נתונים רשמיים 2017-2024 + {rawIncidents.length} אירועים פרטניים ב-DB • {now.toLocaleDateString("he-IL")}
          {lastScan &amp;&amp; &lt;span&gt; • סריקה אחרונה: {lastScan}&lt;/span&gt;}
        &lt;/div&gt;
      &lt;/div&gt;

      {/* Notification Panel (dropdown) */}
      {showNotifPanel &amp;&amp; (
        &lt;div style={{
          position: "absolute", top: 100, left: 14, right: 14,
          zIndex: 100, borderRadius: 16,
          background: "rgba(28,25,23,0.97)", border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: 400, overflow: "auto",
        }}&gt;
          &lt;div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}&gt;
            &lt;div style={{ fontSize: 14, fontWeight: 700 }}&gt;🔔 התראות&lt;/div&gt;
            &lt;div style={{ display: "flex", gap: 8, alignItems: "center" }}&gt;
              {!pushEnabled &amp;&amp; (
                &lt;button onClick={subscribePush} disabled={pushLoading}
                  style={{
                    padding: "5px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #f97316, #ef4444)", color: "#fff",
                    fontSize: 10, fontWeight: 700, opacity: pushLoading ? 0.5 : 1,
                  }}&gt;
                  {pushLoading ? "..." : "הפעל התראות"}
                &lt;/button&gt;
              )}
              {pushEnabled &amp;&amp; (
                &lt;span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}&gt;✅ התראות פעילות&lt;/span&gt;
              )}
              &lt;span onClick={() =&gt; setShowNotifPanel(false)} style={{ cursor: "pointer", fontSize: 16, color: "#78716c" }}&gt;✕&lt;/span&gt;
            &lt;/div&gt;
          &lt;/div&gt;

          {notifications.length === 0 ? (
            &lt;div style={{ padding: 24, textAlign: "center" }}&gt;
              &lt;div style={{ fontSize: 28, marginBottom: 8 }}&gt;🔕&lt;/div&gt;
              &lt;div style={{ fontSize: 12, color: "#78716c" }}&gt;אין התראות עדיין&lt;/div&gt;
              &lt;div style={{ fontSize: 10, color: "#57534e", marginTop: 4 }}&gt;כשתזוהה שריפת ליתיום חדשה, תקבל התראה כאן&lt;/div&gt;
            &lt;/div&gt;
          ) : (
            &lt;div&gt;
              {notifications.slice(0, 15).map((n: any, i: number) =&gt; (
                &lt;div key={n.id || i} style={{
                  padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: !n.read ? "rgba(249,115,22,0.04)" : "transparent",
                }}&gt;
                  &lt;div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}&gt;
                    &lt;div style={{ fontSize: 12, fontWeight: 700, flex: 1 }}&gt;{n.title}&lt;/div&gt;
                    &lt;div style={{
                      fontSize: 8, padding: "2px 6px", borderRadius: 6, fontWeight: 700, marginRight: 4,
                      background: n.severity === "קריטי" ? "rgba(239,68,68,0.15)" : n.severity === "חמור" ? "rgba(249,115,22,0.15)" : "rgba(234,179,8,0.15)",
                      color: n.severity === "קריטי" ? "#ef4444" : n.severity === "חמור" ? "#f97316" : "#eab308",
                    }}&gt;{n.severity}&lt;/div&gt;
                  &lt;/div&gt;
                  &lt;div style={{ fontSize: 10, color: "#a8a29e", marginTop: 3, lineHeight: 1.4 }}&gt;{n.body}&lt;/div&gt;
                  &lt;div style={{ fontSize: 9, color: "#57534e", marginTop: 4 }}&gt;{new Date(n.sent_at).toLocaleString("he-IL")}&lt;/div&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
          )}
        &lt;/div&gt;
      )}

      {/* Content */}
      &lt;div style={{ padding: isDesktop ? "0 32px 40px" : "0 14px 100px", position: "relative", zIndex: 10 }}&gt;

        {/* ===== HOME ===== */}
        {tab === "home" &amp;&amp; (
          &lt;div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: isDesktop ? 20 : 14 }}&gt;
            {/* Alert — full width */}
            &lt;div style={{ padding: "12px 14px", borderRadius: 16, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", display: "flex", alignItems: "center", gap: 10, gridColumn: isDesktop ? "1 / -1" : undefined }}&gt;
              &lt;span style={{ fontSize: 18 }}&gt;⚠️&lt;/span&gt;
              &lt;div style={{ flex: 1 }}&gt;
                &lt;div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5" }}&gt;מגמה עולה מתמשכת&lt;/div&gt;
                &lt;div style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.5 }}&gt;
                  עלייה של {Math.round(((ANNUAL_STATS[ANNUAL_STATS.length - 1].fires - ANNUAL_STATS[0].fires) / ANNUAL_STATS[0].fires) * 100)}% משנת {ANNUAL_STATS[0].year} • ~5 הרוגים בשנה בממוצע • ~150 דירות נשרפות בשנה
                &lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;

            {/* Hero - Total stats */}
            &lt;div style={{ padding: 22, borderRadius: 22, background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.12)", position: "relative", overflow: "hidden", gridColumn: isDesktop ? "1 / -1" : undefined }}&gt;
              &lt;div style={{ position: "absolute", top: -25, left: -25, width: 100, height: 100, borderRadius: "50%", background: "rgba(249,115,22,0.06)", filter: "blur(25px)" }} /&gt;
              &lt;div style={{ fontSize: 11, color: "#d6d3d1", fontWeight: 500 }}&gt;סה״כ שריפות מתועדות 2017-{latestYear?.year}&lt;/div&gt;
              &lt;div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -3, lineHeight: 1, marginTop: 4 }}&gt;{totalFires.toLocaleString()}&lt;/div&gt;
              &lt;div style={{ display: "flex", gap: 16, marginTop: 14 }}&gt;
                &lt;div&gt;&lt;span style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}&gt;{totalFatalities}&lt;/span&gt;&lt;span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}&gt; הרוגים&lt;/span&gt;&lt;/div&gt;
                &lt;div&gt;&lt;span style={{ fontSize: 20, fontWeight: 800, color: "#f97316" }}&gt;~150&lt;/span&gt;&lt;span style={{ fontSize: 12, color: "#a8a29e", marginRight: 4 }}&gt; דירות/שנה&lt;/span&gt;&lt;/div&gt;
                &lt;div style={{ marginRight: "auto" }}&gt;&lt;span style={{ fontSize: 14, fontWeight: 800, color: growthPct &gt; 0 ? "#ef4444" : "#34d399" }}&gt;{growthPct &gt; 0 ? "▲" : "▼"} {Math.abs(growthPct)}%&lt;/span&gt;&lt;span style={{ fontSize: 10, color: "#78716c", marginRight: 4 }}&gt; {latestYear?.year} מ-{prevYear?.year}&lt;/span&gt;&lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;

            {/* Mini stats */}
            &lt;div style={{ display: "flex", gap: 8, gridColumn: isDesktop ? "1 / -1" : undefined }}&gt;
              {[
                { v: `${getFireCount(latestYear)}`, l: `שריפות ${latestYear?.year}`, icon: "🔥", col: "#f97316" },
                { v: "~60%", l: "מחוז דן", icon: "📍", col: "#fbbf24" },
                { v: "34%", l: "טעינת יתר", icon: "🔌", col: "#ef4444" },
              ].map((s, i) =&gt; (
                &lt;div key={i} style={{ flex: 1, padding: "12px 8px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}&gt;
                  &lt;span style={{ fontSize: 18 }}&gt;{s.icon}&lt;/span&gt;
                  &lt;div style={{ fontSize: 18, fontWeight: 800, marginTop: 3, color: s.col }}&gt;{s.v}&lt;/div&gt;
                  &lt;div style={{ fontSize: 9, color: "#78716c", marginTop: 2 }}&gt;{s.l}&lt;/div&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;

            {/* ===== OFFICIAL ANNUAL TREND ===== */}
            &lt;div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}&gt;📊 סטטיסטיקה שנתית — כבאות והצלה&lt;/div&gt;
              &lt;div style={{ fontSize: 10, color: "#78716c", marginBottom: 12 }}&gt;נתונים רשמיים • * = סריקת מדיה (חלקי)&lt;/div&gt;
              &lt;ResponsiveContainer width="100%" height={isDesktop ? 320 : 200}&gt;
                &lt;ComposedChart data={COMBINED_ANNUAL} margin={{ left: 5, right: 5, bottom: 5 }}&gt;
                  &lt;defs&gt;
                    &lt;linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1"&gt;
                      &lt;stop offset="0%" stopColor="#f97316" stopOpacity={0.35} /&gt;
                      &lt;stop offset="100%" stopColor="#f97316" stopOpacity={0} /&gt;
                    &lt;/linearGradient&gt;
                  &lt;/defs&gt;
                  &lt;XAxis dataKey="y" tick={{ fill: "#78716c", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} /&gt;
                  &lt;YAxis hide /&gt;
                  &lt;Tooltip
                    {...tip}
                    formatter={(value: any, name: string) =&gt; {
                      if (name === "שריפות (רשמי)") return [value, "🔥 שריפות (רשמי)"];
                      if (name === "סריקת מדיה (חלקי)") return [value, "📰 סריקת מדיה (חלקי)"];
                      if (name === "הרוגים") return [value, "💀 הרוגים"];
                      return [value, name];
                    }}
                    labelFormatter={(label: string) =&gt; {
                      const item = COMBINED_ANNUAL.find(d =&gt; d.y === label);
                      return item ? `${item.year} (${item.source})` : label;
                    }}
                  /&gt;
                  {/* Solid line — official annual stats */}
                  &lt;Area type="monotone" dataKey="officialFires" stroke="#f97316" fill="url(#fireGrad)" strokeWidth={2.5} connectNulls={false}
                    dot={{ r: 4, fill: "#f97316", strokeWidth: 0 }}
                    name="שריפות (רשמי)" /&gt;
                  {/* Dashed line — partial media-scanned data */}
                  &lt;Line type="monotone" dataKey="partialFires" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="8 4" connectNulls={false}
                    dot={{ r: 4, fill: "#fbbf24", stroke: "#fff", strokeWidth: 1.5 }}
                    name="סריקת מדיה (חלקי)" /&gt;
                  &lt;Bar dataKey="fatalities" fill="#ef4444" barSize={10} radius={[4, 4, 0, 0]} name="הרוגים" opacity={0.7} /&gt;
                &lt;/ComposedChart&gt;
              &lt;/ResponsiveContainer&gt;

              {/* Legend for line styles */}
              &lt;div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 8, marginBottom: 4 }}&gt;
                &lt;div style={{ display: "flex", alignItems: "center", gap: 6 }}&gt;
                  &lt;svg width="24" height="4"&gt;&lt;line x1="0" y1="2" x2="24" y2="2" stroke="#f97316" strokeWidth="2.5" /&gt;&lt;/svg&gt;
                  &lt;span style={{ fontSize: 9, color: "#a8a29e" }}&gt;נתונים רשמיים&lt;/span&gt;
                &lt;/div&gt;
                &lt;div style={{ display: "flex", alignItems: "center", gap: 6 }}&gt;
                  &lt;svg width="24" height="4"&gt;&lt;line x1="0" y1="2" x2="24" y2="2" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="5 3" /&gt;&lt;/svg&gt;
                  &lt;span style={{ fontSize: 9, color: "#a8a29e" }}&gt;סריקת מדיה (חלקי)&lt;/span&gt;
                &lt;/div&gt;
              &lt;/div&gt;

              {/* Annual data table */}
              &lt;div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 10 }}&gt;
                &lt;div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 4, fontSize: 9, color: "#78716c", fontWeight: 700, marginBottom: 6, textAlign: "center" }}&gt;
                  &lt;div&gt;שנה&lt;/div&gt;&lt;div&gt;שריפות&lt;/div&gt;&lt;div&gt;הרוגים&lt;/div&gt;&lt;div&gt;מקור&lt;/div&gt;
                &lt;/div&gt;
                {COMBINED_ANNUAL.map(d =&gt; (
                  &lt;div key={d.year} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: 4, fontSize: 10, textAlign: "center", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}&gt;
                    &lt;div style={{ color: "#a8a29e", fontWeight: 700 }}&gt;{d.year}&lt;/div&gt;
                    &lt;div style={{ color: "#f97316", fontWeight: 800 }}&gt;{d.officialFires ?? d.partialFires ?? 0}&lt;/div&gt;
                    &lt;div style={{ color: d.fatalities &gt; 0 ? "#ef4444" : "#57534e", fontWeight: 700 }}&gt;{d.fatalities || "—"}&lt;/div&gt;
                    &lt;div style={{ color: "#78716c", fontSize: 9 }}&gt;{d.source}{!d.isOfficial ? " *" : ""}&lt;/div&gt;
                  &lt;/div&gt;
                ))}
              &lt;/div&gt;
            &lt;/div&gt;

            {/* Device breakdown 2019 toggle */}
            &lt;div style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div onClick={() =&gt; setShowBreakdown2019(!showBreakdown2019)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}&gt;
                &lt;div style={{ fontSize: 14, fontWeight: 700 }}&gt;📱 פילוח לפי סוג אמצעי (2019)&lt;/div&gt;
                &lt;span style={{ fontSize: 12, color: "#78716c" }}&gt;{showBreakdown2019 ? "▲" : "▼"}&lt;/span&gt;
              &lt;/div&gt;
              &lt;div style={{ fontSize: 10, color: "#78716c", marginTop: 4 }}&gt;השנה היחידה עם פילוח פומבי מלא (כלכליסט)&lt;/div&gt;

              {showBreakdown2019 &amp;&amp; (
                &lt;div style={{ marginTop: 12 }}&gt;
                  &lt;div style={{ display: "flex", alignItems: "center" }}&gt;
                    &lt;ResponsiveContainer width="45%" height={120}&gt;
                      &lt;PieChart&gt;
                        &lt;Pie data={DEVICE_BREAKDOWN_2019.map(d =&gt; ({ name: d.name, value: d.count }))} cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={3} dataKey="value" stroke="none"&gt;
                          {DEVICE_BREAKDOWN_2019.map((d, i) =&gt; &lt;Cell key={i} fill={d.color} /&gt;)}
                        &lt;/Pie&gt;
                      &lt;/PieChart&gt;
                    &lt;/ResponsiveContainer&gt;
                    &lt;div style={{ flex: 1 }}&gt;
                      {DEVICE_BREAKDOWN_2019.map(d =&gt; (
                        &lt;div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}&gt;
                          &lt;div style={{ width: 8, height: 8, borderRadius: 3, background: d.color, flexShrink: 0 }} /&gt;
                          &lt;span style={{ fontSize: 10, color: "#a8a29e", flex: 1 }}&gt;{d.name}&lt;/span&gt;
                          &lt;span style={{ fontSize: 10, color: "#78716c" }}&gt;{d.count}&lt;/span&gt;
                          &lt;span style={{ fontSize: 11, fontWeight: 800 }}&gt;{d.pct}%&lt;/span&gt;
                        &lt;/div&gt;
                      ))}
                    &lt;/div&gt;
                  &lt;/div&gt;
                  &lt;div style={{ fontSize: 10, color: "#57534e", marginTop: 8, padding: 8, borderRadius: 8, background: "rgba(249,115,22,0.04)" }}&gt;
                    ℹ️ שנים 2020-2024: לא פורסם פילוח. כבאות מציינים "הרוב המוחלט מאופניים חשמליים". פילוח מלא קיים רק במערכת הפנימית.
                  &lt;/div&gt;
                &lt;/div&gt;
              )}
            &lt;/div&gt;

            {/* Pie — DB incidents */}
            {DEVICE_PIE.length &gt; 0 &amp;&amp; (
              &lt;div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
                &lt;div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}&gt;📊 פילוח אירועים מה-DB ({rawIncidents.length})&lt;/div&gt;
                &lt;div style={{ fontSize: 10, color: "#78716c", marginBottom: 8 }}&gt;אירועים פרטניים שנאספו מסריקת מדיה&lt;/div&gt;
                {selPie &amp;&amp; &lt;div style={{ fontSize: 13, color: DEVICE_PIE.find(d =&gt; d.n === selPie)?.c || "#f97316", fontWeight: 700, marginTop: 4 }}&gt;{selPie}&lt;/div&gt;}
                &lt;div style={{ display: "flex", alignItems: "center", marginTop: 8 }}&gt;
                  &lt;ResponsiveContainer width="45%" height={130}&gt;
                    &lt;PieChart&gt;
                      &lt;Pie data={DEVICE_PIE} cx="50%" cy="50%" innerRadius={28} outerRadius={55} paddingAngle={3} dataKey="v" stroke="none"
                        onClick={(_, idx) =&gt; setSelPie(DEVICE_PIE[idx]?.n === selPie ? null : DEVICE_PIE[idx]?.n || null)}&gt;
                        {DEVICE_PIE.map((d, i) =&gt; &lt;Cell key={i} fill={d.c} opacity={selPie &amp;&amp; selPie !== d.n ? 0.3 : 1} style={{ cursor: "pointer", transition: "opacity 0.2s" }} /&gt;)}
                      &lt;/Pie&gt;
                    &lt;/PieChart&gt;
                  &lt;/ResponsiveContainer&gt;
                  &lt;div style={{ flex: 1 }}&gt;
                    {DEVICE_PIE.map(d =&gt; {
                      const total = DEVICE_PIE.reduce((s, x) =&gt; s + x.v, 0);
                      const pct = Math.round(d.v / total * 100);
                      return (
                        &lt;div key={d.n} onClick={() =&gt; setSelPie(selPie === d.n ? null : d.n)}
                          style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, cursor: "pointer", opacity: selPie &amp;&amp; selPie !== d.n ? 0.4 : 1, transition: "opacity 0.2s" }}&gt;
                          &lt;div style={{ width: 8, height: 8, borderRadius: 3, background: d.c, flexShrink: 0 }} /&gt;
                          &lt;span style={{ fontSize: 10, color: "#a8a29e", flex: 1 }}&gt;{d.n}&lt;/span&gt;
                          &lt;span style={{ fontSize: 11, fontWeight: 800 }}&gt;{pct}%&lt;/span&gt;
                        &lt;/div&gt;
                      );
                    })}
                  &lt;/div&gt;
                &lt;/div&gt;
              &lt;/div&gt;
            )}

            {/* Smart Trend */}
            &lt;div style={{ padding: 16, borderRadius: 20, background: "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(239,68,68,0.03))", border: "1px solid rgba(249,115,22,0.08)" }}&gt;
              &lt;div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}&gt;🧠 ניתוח מגמה&lt;/div&gt;
              &lt;div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.8 }}&gt;
                &lt;div style={{ marginBottom: 8 }}&gt;
                  &lt;span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontSize: 10, fontWeight: 700, marginLeft: 6 }}&gt;מגמה&lt;/span&gt;
                  עלייה של &lt;strong style={{ color: "#ef4444" }}&gt;229%&lt;/strong&gt; בשריפות מ-2017 (76) ל-2024 (250). גידול ממוצע ~20% בשנה.
                &lt;/div&gt;
                &lt;div style={{ marginBottom: 8 }}&gt;
                  &lt;span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(249,115,22,0.1)", color: "#fdba74", fontSize: 10, fontWeight: 700, marginLeft: 6 }}&gt;עונתיות&lt;/span&gt;
                  יוני-אוגוסט מהווים ~33% מהאירועים. טמפרטורות מעל 35°C מגבירות סיכון ל-thermal runaway.
                &lt;/div&gt;
                &lt;div style={{ marginBottom: 8 }}&gt;
                  &lt;span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(251,191,36,0.1)", color: "#fde68a", fontSize: 10, fontWeight: 700, marginLeft: 6 }}&gt;גאוגרפיה&lt;/span&gt;
                  ~50-60% מהשריפות במחוז דן. צפיפות + ריכוז שימוש באופניים חשמליים.
                &lt;/div&gt;
                &lt;div&gt;
                  &lt;span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#93c5fd", fontSize: 10, fontWeight: 700, marginLeft: 6 }}&gt;נתוני 2025+&lt;/span&gt;
                  {dbConnected ? `✅ ${rawIncidents.filter(i =&gt; new Date(i.incident_date).getFullYear() &gt;= 2025).length} אירועים מסריקת מדיה אוטומטית` : "⚠️ ממתין לחיבור DB"}
                &lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {/* ===== MAP ===== */}
        {tab === "map" &amp;&amp; (
          &lt;div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1.5fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: isDesktop ? 20 : 14 }}&gt;
            &lt;div style={{ padding: 16, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}&gt;🗺️ מפת חום — אירועים לפי עיר&lt;/div&gt;
              &lt;IsraelMap incidents={rawIncidents} /&gt;
            &lt;/div&gt;

            {/* Districts */}
            &lt;div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}&gt;📍 התפלגות לפי מחוז (מחושב מ-DB)&lt;/div&gt;
              {DISTRICTS.map(d =&gt; (
                &lt;div key={d.n} style={{ marginBottom: 8 }}&gt;
                  &lt;div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}&gt;
                    &lt;span style={{ color: "#a8a29e" }}&gt;{d.n}&lt;/span&gt;
                    &lt;span style={{ color: "#fafaf9", fontWeight: 700 }}&gt;{d.pct}%&lt;/span&gt;
                  &lt;/div&gt;
                  &lt;div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)" }}&gt;
                    &lt;div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #f97316, #fbbf24)", width: `${d.pct}%`, transition: "width 1s ease" }} /&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {/* ===== STATS ===== */}
        {tab === "stats" &amp;&amp; (
          &lt;div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: isDesktop ? 20 : 14 }}&gt;
            {/* Monthly from DB */}
            &lt;div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}&gt;
                &lt;div style={{ fontSize: 14, fontWeight: 700 }}&gt;📅 עונתיות {seasonYear}&lt;/div&gt;
                &lt;div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}&gt;
                  {years.map(yr =&gt; (
                    &lt;button key={yr} onClick={() =&gt; setSeasonYear(yr)} style={{
                      padding: "4px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: seasonYear === yr ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.04)",
                      color: seasonYear === yr ? "#f97316" : "#78716c",
                      fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                    }}&gt;{yr}&lt;/button&gt;
                  ))}
                &lt;/div&gt;
              &lt;/div&gt;
              &lt;div style={{ fontSize: 10, color: "#78716c", marginBottom: 8 }}&gt;נתונים חודשיים מאירועים פרטניים ב-DB בלבד&lt;/div&gt;
              &lt;ResponsiveContainer width="100%" height={isDesktop ? 280 : 170}&gt;
                &lt;BarChart data={MONTHLY[seasonYear] || []} barSize={16}&gt;
                  &lt;XAxis dataKey="m" tick={{ fill: "#78716c", fontSize: 10 }} axisLine={false} tickLine={false} /&gt;
                  &lt;YAxis hide /&gt;
                  &lt;Tooltip {...tip} /&gt;
                  &lt;Bar dataKey="v" radius={[6, 6, 0, 0]} name="שריפות"&gt;
                    {(MONTHLY[seasonYear] || []).map((d, i) =&gt; &lt;Cell key={i} fill={d.v &gt;= 10 ? "#ef4444" : d.v &gt;= 5 ? "#f97316" : d.v &gt; 0 ? "#fbbf24" : "#333"} opacity={d.v &gt; 0 ? 0.85 : 0.2} /&gt;)}
                  &lt;/Bar&gt;
                &lt;/BarChart&gt;
              &lt;/ResponsiveContainer&gt;
              &lt;div style={{ fontSize: 11, color: "#a8a29e", marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(249,115,22,0.05)" }}&gt;
                💡 שיא בקיץ — חום סביבתי מגביר thermal runaway בסוללות
              &lt;/div&gt;
              &lt;div style={{ fontSize: 10, color: "#57534e", marginTop: 6, padding: 8, borderRadius: 8, background: "rgba(59,130,246,0.04)" }}&gt;
                ℹ️ &lt;strong&gt;לגבי נתונים חודשיים רשמיים:&lt;/strong&gt; כבאות והצלה לא מפרסמים נתונים ברמה חודשית לציבור. הנתונים כאן הם מאירועים פרטניים שנאספו מסריקת מדיה ({rawIncidents.filter(i =&gt; new Date(i.incident_date).getFullYear() === seasonYear).length} מתוך {ANNUAL_STATS.find(s =&gt; s.year === seasonYear)?.fires || "?"} שריפות ב-{seasonYear}).
              &lt;/div&gt;
            &lt;/div&gt;

            {/* Causes */}
            &lt;div style={{ padding: 18, borderRadius: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}&gt;🔍 גורמי התלקחות&lt;/div&gt;
              &lt;div style={{ fontSize: 10, color: "#78716c", marginBottom: 10 }}&gt;מקור: כבאות והצלה&lt;/div&gt;
              {CAUSES.map(c =&gt; (
                &lt;div key={c.name} style={{ marginBottom: 8 }}&gt;
                  &lt;div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}&gt;
                    &lt;span style={{ color: "#d6d3d1" }}&gt;{c.name}&lt;/span&gt;
                    &lt;span style={{ color: c.col, fontWeight: 800 }}&gt;{c.pct}%&lt;/span&gt;
                  &lt;/div&gt;
                  &lt;div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)" }}&gt;
                    &lt;div style={{ height: "100%", borderRadius: 3, background: c.col, width: `${c.pct}%`, opacity: 0.8 }} /&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;
          &lt;/div&gt;
        )}

        {/* ===== LIST ===== */}
        {tab === "list" &amp;&amp; (
          &lt;div&gt;
            &lt;div style={{ fontSize: 15, fontWeight: 700, padding: "0 4px 4px" }}&gt;🔥 אירועים מתועדים ({INCIDENTS_LIST.length})&lt;/div&gt;
            &lt;div style={{ fontSize: 11, color: "#78716c", padding: "0 4px 10px" }}&gt;נתונים מ-Supabase • ממוינים מהחדש לישן&lt;/div&gt;
            &lt;div style={{ display: isDesktop ? "grid" : "flex", gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : undefined, flexDirection: isDesktop ? undefined : "column", gap: 8 }}&gt;
            {INCIDENTS_LIST.map(inc =&gt; (
              &lt;div key={inc.id}
                onClick={() =&gt; setSelInc(selInc?.id === inc.id ? null : inc)}
                style={{
                  padding: "13px 14px", borderRadius: 16,
                  background: selInc?.id === inc.id ? "rgba(249,115,22,0.05)" : "rgba(255,255,255,0.015)",
                  border: `1px solid ${selInc?.id === inc.id ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.03)"}`,
                  cursor: "pointer", transition: "all 0.25s ease",
                }}
              &gt;
                &lt;div style={{ display: "flex", alignItems: "center", gap: 10 }}&gt;
                  &lt;div style={{ width: 38, height: 38, borderRadius: 12, background: `${inc.sevC}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}&gt;{inc.icon}&lt;/div&gt;
                  &lt;div style={{ flex: 1, minWidth: 0 }}&gt;
                    &lt;div style={{ fontSize: 13, fontWeight: 600 }}&gt;{inc.type} — {inc.city}&lt;/div&gt;
                    &lt;div style={{ fontSize: 11, color: "#78716c", marginTop: 1 }}&gt;{inc.date} • {inc.src}&lt;/div&gt;
                  &lt;/div&gt;
                  &lt;div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}&gt;
                    &lt;span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, fontWeight: 700, background: `${inc.sevC}12`, color: inc.sevC }}&gt;{inc.sev}&lt;/span&gt;
                    &lt;div style={{ fontSize: 11 }}&gt;
                      {inc.d &gt; 0 &amp;&amp; &lt;span style={{ color: "#ef4444", fontWeight: 800 }}&gt;💀{inc.d} &lt;/span&gt;}
                      {inc.i &gt; 0 &amp;&amp; &lt;span style={{ color: "#f97316" }}&gt;🤕{inc.i}&lt;/span&gt;}
                    &lt;/div&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
                {selInc?.id === inc.id &amp;&amp; (
                  &lt;div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 12, color: "#a8a29e", lineHeight: 1.7 }}&gt;
                    {inc.desc}
                    {inc.verified &amp;&amp; &lt;span style={{ marginRight: 8, fontSize: 10, color: "#22c55e" }}&gt;✅ מאומת&lt;/span&gt;}
                  &lt;/div&gt;
                )}
              &lt;/div&gt;
            ))}
          &lt;/div&gt;
          &lt;/div&gt;
        )}

        {/* ===== SYSTEM ===== */}
        {tab === "system" &amp;&amp; (
          &lt;div style={{ display: "flex", flexDirection: "column", gap: 14 }}&gt;
            &lt;div style={{ padding: 18, borderRadius: 20, background: "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(59,130,246,0.04))", border: `1px solid ${dbConnected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}` }}&gt;
              &lt;div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}&gt;
                &lt;div style={{ width: 38, height: 38, borderRadius: 11, background: dbConnected ? "linear-gradient(135deg, #22c55e, #3b82f6)" : "linear-gradient(135deg, #ef4444, #f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}&gt;🗄️&lt;/div&gt;
                &lt;div&gt;
                  &lt;div style={{ fontSize: 15, fontWeight: 800 }}&gt;Supabase Database&lt;/div&gt;
                  &lt;div style={{ fontSize: 11, color: "#78716c" }}&gt;{dbConnected ? "מחובר ופעיל" : "לא מחובר"}&lt;/div&gt;
                &lt;/div&gt;
              &lt;/div&gt;
              &lt;div style={{ display: "flex", gap: 8 }}&gt;
                {[
                  { v: String(rawIncidents.length), l: "אירועים ב-DB", col: "#22c55e" },
                  { v: String(ANNUAL_STATS.length), l: "שנים רשמיות", col: "#3b82f6" },
                  { v: lastScan ? "✅" : "—", l: "סריקה אחרונה", col: "#f97316" },
                ].map((s, i) =&gt; (
                  &lt;div key={i} style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.03)" }}&gt;
                    &lt;div style={{ fontSize: 18, fontWeight: 900, color: s.col }}&gt;{s.v}&lt;/div&gt;
                    &lt;div style={{ fontSize: 9, color: "#78716c" }}&gt;{s.l}&lt;/div&gt;
                  &lt;/div&gt;
                ))}
              &lt;/div&gt;
            &lt;/div&gt;

            {/* Architecture */}
            &lt;div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}&gt;🏗️ ארכיטקטורה&lt;/div&gt;
              &lt;div style={{ fontSize: 11, color: "#a8a29e", lineHeight: 1.8 }}&gt;
                &lt;div style={{ marginBottom: 6 }}&gt;&lt;strong style={{ color: "#f97316" }}&gt;שכבה 1:&lt;/strong&gt; סטטיסטיקה שנתית 2017-2024 (נתונים רשמיים hardcoded)&lt;/div&gt;
                &lt;div style={{ marginBottom: 6 }}&gt;&lt;strong style={{ color: "#fbbf24" }}&gt;שכבה 2:&lt;/strong&gt; אירועים פרטניים ב-Supabase (131 אירועים מסריקת מדיה)&lt;/div&gt;
                &lt;div style={{ marginBottom: 6 }}&gt;&lt;strong style={{ color: "#22c55e" }}&gt;שכבה 3:&lt;/strong&gt; RSS + Gemini סורק מדיה אוטומטי (כל 6 שעות)&lt;/div&gt;
                &lt;div&gt;&lt;strong style={{ color: "#3b82f6" }}&gt;2026+:&lt;/strong&gt; נתונים חדשים יוזנו אוטומטית ויופיעו בגרף השנתי&lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;

            &lt;div style={{ padding: 16, borderRadius: 18, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}&gt;
              &lt;div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}&gt;📰 מקורות מידע&lt;/div&gt;
              {[
                { icon: "🚒", name: "כבאות והצלה", det: "דוברות ארצית + מחוזות, אתר 102", col: "#ef4444" },
                { icon: "📰", name: "חדשות ארציות", det: "ynet, כלכליסט, הארץ, וואלה, מעריב, מאקו", col: "#f97316" },
                { icon: "📍", name: "חדשות מקומיות", det: "חי פה, NWS, ניוזים, כיכר השבת, JDN", col: "#fbbf24" },
                { icon: "🏛️", name: "ממשלתי", det: "משרד התחבורה, רשות הכבאות, מרכז המחקר של הכנסת", col: "#34d399" },
              ].map((s, i) =&gt; (
                &lt;div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i &lt; 3 ? "1px solid rgba(255,255,255,0.03)" : "none" }}&gt;
                  &lt;span style={{ fontSize: 18 }}&gt;{s.icon}&lt;/span&gt;
                  &lt;div&gt;
                    &lt;div style={{ fontSize: 12, fontWeight: 700, color: s.col }}&gt;{s.name}&lt;/div&gt;
                    &lt;div style={{ fontSize: 10, color: "#78716c", marginTop: 1 }}&gt;{s.det}&lt;/div&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
              ))}
            &lt;/div&gt;

            {/* Credits */}
            &lt;div style={{ padding: 14, borderRadius: 14, background: "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(251,191,36,0.04))", border: "1px solid rgba(249,115,22,0.1)" }}&gt;
              &lt;div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}&gt;👨‍💻 אודות&lt;/div&gt;
              &lt;div style={{ fontSize: 12, color: "#d6d3d1", lineHeight: 1.7 }}&gt;
                פותח על ידי &lt;strong style={{ color: "#f97316" }}&gt;רועי צוקרמן&lt;/strong&gt; ככלי ניסיוני
              &lt;/div&gt;
              &lt;div style={{ fontSize: 10, color: "#78716c", marginTop: 4 }}&gt;
                Next.js + Supabase + Gemini AI • גרסה 3.2
              &lt;/div&gt;
            &lt;/div&gt;

            &lt;div style={{ padding: 14, borderRadius: 14, background: "rgba(239,68,68,0.03)", border: "1px solid rgba(239,68,68,0.08)" }}&gt;
              &lt;div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#fca5a5" }}&gt;⚠️ אזהרות שימוש&lt;/div&gt;
              &lt;div style={{ fontSize: 10.5, color: "#a8a29e", lineHeight: 1.8 }}&gt;
                &lt;div style={{ marginBottom: 6 }}&gt;&lt;strong style={{ color: "#d6d3d1" }}&gt;1. כלי ניסיוני&lt;/strong&gt; — מערכת זו פותחה כפרויקט ניסיוני ואינה מערכת רשמית.&lt;/div&gt;
                &lt;div style={{ marginBottom: 6 }}&gt;&lt;strong style={{ color: "#d6d3d1" }}&gt;2. נתונים חלקיים&lt;/strong&gt; — ~3% מהשריפות מקבלות כיסוי תקשורתי מפורט. הנתונים השנתיים הרשמיים מלאים.&lt;/div&gt;
                &lt;div style={{ marginBottom: 6 }}&gt;&lt;strong style={{ color: "#d6d3d1" }}&gt;3. אין אחריות&lt;/strong&gt; — המפתח אינו נושא באחריות לנזק.&lt;/div&gt;
                &lt;div&gt;&lt;strong style={{ color: "#d6d3d1" }}&gt;4. מקורות רשמיים&lt;/strong&gt; — למידע מדויק יש לפנות לנציבות כבאות והצלה לישראל.&lt;/div&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        )}
      &lt;/div&gt;

      {/* Tab Bar */}
      &lt;div style={{
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
      }}&gt;
        {tabs.map(t =&gt; (
          &lt;button key={t.id} onClick={() =&gt; { setTab(t.id); setSelInc(null); }} style={{
            width: isDesktop ? 56 : 60, padding: "9px 0", borderRadius: isDesktop ? 16 : 22, border: "none", cursor: "pointer",
            background: tab === t.id ? "rgba(249,115,22,0.12)" : "transparent",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            color: tab === t.id ? "#f97316" : "#57534e",
            transition: "all 0.25s ease", fontFamily: "inherit",
          }}&gt;
            &lt;span style={{ fontSize: 16, fontWeight: 300 }}&gt;{t.icon}&lt;/span&gt;
            &lt;span style={{ fontSize: 9, fontWeight: 600 }}&gt;{t.label}&lt;/span&gt;
          &lt;/button&gt;
        ))}
      &lt;/div&gt;

      {/* Footer */}
      &lt;div style={{ textAlign: "center", padding: "0 20px 100px", fontSize: 9, color: "#44403c", lineHeight: 1.6, position: "relative", zIndex: 10 }}&gt;
        פותח ע"י &lt;strong style={{ color: "#78716c" }}&gt;רועי צוקרמן&lt;/strong&gt; • כלי ניסיוני&lt;br /&gt;
        נתונים רשמיים 2017-2024 + {rawIncidents.length} אירועים ב-DB • {now.toLocaleDateString("he-IL")}
      &lt;/div&gt;
    &lt;/div&gt;
  );
}
</pre></body></html>
