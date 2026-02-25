"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from "recharts";

// ===========================================
// CONSTANTS
// ===========================================
const DEVICE_ICONS: Record<string, string> = {
  "אופניים חשמליים": "🚲", "קורקינט": "🛴", "רכב חשמלי": "🚗",
  "רכב היברידי": "🚙", "מתקן אגירה": "🔋", "קלנועית": "🏍️",
  "טלפון": "📱", "פאוורבנק": "🔌", "אוטובוס חשמלי": "🚌",
  "מחשב נייד": "💻", "אחר": "⚡",
};

const DEVICE_COLORS: Record<string, string> = {
  "אופניים חשמליים": "#3b82f6", "קורקינט": "#8b5cf6",
  "רכב חשמלי": "#ef4444", "רכב היברידי": "#f97316",
  "מתקן אגירה": "#22c55e", "קלנועית": "#ec4899",
  "טלפון": "#06b6d4", "פאוורבנק": "#14b8a6",
  "אוטובוס חשמלי": "#f59e0b", "מחשב נייד": "#a855f7", "אחר": "#6b7280",
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  "קריטית": { color: "#dc2626", bg: "rgba(220,38,38,0.15)", icon: "🔴" },
  "גבוהה": { color: "#f97316", bg: "rgba(249,115,22,0.15)", icon: "🟠" },
  "בינונית": { color: "#eab308", bg: "rgba(234,179,8,0.15)", icon: "🟡" },
  "נמוכה": { color: "#22c55e", bg: "rgba(34,197,94,0.15)", icon: "🟢" },
};

const MONTHS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const REFRESH_INTERVAL = 5 * 60 * 1000;

// ===========================================
// STYLES
// ===========================================
const GlobalStyles = () => (
  <style>{`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Rubik', 'Noto Sans Hebrew', -apple-system, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    .dashboard-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 16px;
    }
    @media (min-width: 768px) {
      .dashboard-container { padding: 24px; }
    }
    @media (min-width: 1024px) {
      .dashboard-container { padding: 32px; }
    }
    .glass-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      backdrop-filter: blur(12px);
      transition: all 0.3s ease;
    }
    .glass-card:hover {
      border-color: rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
    }
    .stat-card {
      position: relative;
      overflow: hidden;
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 100%;
      height: 3px;
      background: var(--accent-gradient, linear-gradient(90deg, #ef4444, #f97316));
      border-radius: 16px 16px 0 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    @media (min-width: 640px) {
      .grid-2 { grid-template-columns: repeat(2, 1fr); }
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    @media (min-width: 768px) {
      .grid-4 { grid-template-columns: repeat(4, 1fr); gap: 16px; }
    }
    .tab-btn {
      padding: 8px 16px;
      border-radius: 10px;
      border: 1px solid transparent;
      background: transparent;
      color: #94a3b8;
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.25s;
      white-space: nowrap;
    }
    .tab-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
    .tab-btn.active {
      background: rgba(239,68,68,0.15);
      color: #f87171;
      border-color: rgba(239,68,68,0.3);
    }
    .tabs-scroll {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 4px;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .tabs-scroll::-webkit-scrollbar { display: none; }
    .incident-card {
      padding: 14px;
      border-radius: 12px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      transition: all 0.25s;
    }
    .incident-card:hover {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.1);
      transform: translateY(-1px);
    }
    @keyframes pulse-glow {
      0%, 100% { opacity: 1; box-shadow: 0 0 4px currentColor; }
      50% { opacity: 0.5; box-shadow: 0 0 8px currentColor; }
    }
    .live-dot { animation: pulse-glow 2s ease-in-out infinite; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-in { animation: fadeIn 0.4s ease-out forwards; }
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    .loading-shimmer {
      background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 12px;
      height: 120px;
    }
    .recharts-cartesian-grid line { stroke: rgba(255,255,255,0.05); }
    .recharts-text { fill: #94a3b8; font-size: 11px; font-family: 'Rubik', sans-serif; }
    .header-gradient {
      background: linear-gradient(135deg, #0a0a0f 0%, #1a0a0a 50%, #0a0a0f 100%);
      border-bottom: 1px solid rgba(239,68,68,0.1);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .scroll-top-btn {
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(239,68,68,0.2);
      border: 1px solid rgba(239,68,68,0.4);
      color: #f87171;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
      z-index: 100;
      backdrop-filter: blur(8px);
    }
    .scroll-top-btn:hover {
      background: rgba(239,68,68,0.3);
      transform: scale(1.1);
    }
    .accent-red::before { background: linear-gradient(90deg, #ef4444, #ef444488) !important; }
    .accent-darkred::before { background: linear-gradient(90deg, #dc2626, #dc262688) !important; }
    .accent-orange::before { background: linear-gradient(90deg, #f97316, #f9731688) !important; }
    .accent-purple::before { background: linear-gradient(90deg, #8b5cf6, #8b5cf688) !important; }
  `}</style>
);

// ===========================================
// TYPES
// ===========================================
interface Incident {
  id?: number;
  title?: string;
  city?: string;
  incident_date?: string;
  device_type?: string;
  severity?: string;
  deaths?: number;
  injuries?: number;
  description?: string;
  source_url?: string;
  source_name?: string;
  district?: string;
  address?: string;
}

interface Stats {
  totalIncidents?: number;
  totalDeaths?: number;
  totalInjuries?: number;
  deviceCounts?: Record<string, number>;
  yearlyCounts?: Record<string, number>;
  monthlyCounts?: Record<string, number>;
  topCities?: [string, number][];
  severityCounts?: Record<string, number>;
}

interface SearchRun {
  id?: string;
  started_at?: string;
  status?: string;
  new_incidents?: number;
}

// ===========================================
// DATA HOOK
// ===========================================
function useLiveData() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchRuns, setSearchRuns] = useState<SearchRun[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState("loading");

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [incRes, analRes] = await Promise.all([
        fetch("/api/incidents?limit=500"),
        fetch("/api/analyze"),
      ]);
      if (!incRes.ok) throw new Error("Incidents API: " + incRes.status);
      const incData = await incRes.json();
      const analData = analRes.ok ? await analRes.json() : {};
      setIncidents(incData.incidents || []);
      setStats(incData.stats || {});
      setLoading(false);
      setSearchRuns(analData.searchRuns || []);
      setLastUpdate(analData.lastUpdate || null);
      setSystemStatus(analData.systemStatus || "active");
    } catch (e: any) {
      console.error("Fetch error:", e);
      setError(e.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { incidents, stats, loading, error, searchRuns, lastUpdate, systemStatus, refresh: fetchData };
}

// ===========================================
// SMALL COMPONENTS
// ===========================================

function LoadingState() {
  return (
    <div className="dashboard-container" style={{ paddingTop: 80 }}>
      <div className="grid-4">
        {[1,2,3,4].map((i) => <div key={i} className="loading-shimmer" />)}
      </div>
      <div style={{ marginTop: 16 }} className="grid-2">
        <div className="loading-shimmer" style={{ height: 300 }} />
        <div className="loading-shimmer" style={{ height: 300 }} />
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ color: "#f87171", marginBottom: 8 }}>שגיאה בטעינת נתונים</h2>
      <p style={{ color: "#94a3b8", marginBottom: 24, fontSize: 14 }}>{error}</p>
      <button onClick={onRetry} style={{
        padding: "10px 24px", borderRadius: 10, background: "rgba(239,68,68,0.2)",
        border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", cursor: "pointer",
        fontFamily: "inherit", fontSize: 14, fontWeight: 600,
      }}>נסה שוב</button>
    </div>
  );
}

function LiveIndicator({ lastUpdate, status }: { lastUpdate?: string | null; status?: string }) {
  const timeAgo = lastUpdate ? Math.round((Date.now() - new Date(lastUpdate).getTime()) / 60000) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span className="live-dot" style={{
        width: 8, height: 8, borderRadius: "50%",
        background: status === "active" ? "#22c55e" : "#eab308",
        color: status === "active" ? "#22c55e" : "#eab308",
      }} />
      <span style={{ color: "#94a3b8" }}>
        {status === "active" ? "מערכת פעילה" : "בודק..."}
        {timeAgo !== null && ` · עודכן לפני ${timeAgo < 60 ? timeAgo + " דק'" : Math.round(timeAgo / 60) + " שעות"}`}
      </span>
    </div>
  );
}

function StatCard({ icon, label, value, color = "#ef4444", accentClass = "accent-red" }: {
  icon: string; label: string; value: string | number; color?: string; accentClass?: string;
}) {
  return (
    <div className={`glass-card stat-card ${accentClass}`} style={{ padding: "16px 18px" }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div style={{ fontSize: 32, fontWeight: 800, color, marginTop: 8, lineHeight: 1 }}>
        {typeof value === "number" ? value.toLocaleString("he-IL") : value}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const cfg = SEVERITY_CONFIG[severity || "בינונית"] || SEVERITY_CONFIG["בינונית"];
  return <span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{cfg.icon} {severity}</span>;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(10px)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 11, color: p.color || "#94a3b8", display: "flex", gap: 8 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ===========================================
// CHARTS
// ===========================================

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "#475569", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 32 }}>📭</span>
      <span style={{ fontSize: 13 }}>{label}</span>
    </div>
  );
}

function YearlyChart({ yearlyCounts }: { yearlyCounts: Record<string, number> }) {
  const data = Object.entries(yearlyCounts)
    .filter(([y]) => y !== "unknown")
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([year, count]) => ({ year, count }));
  if (!data.length) return <EmptyChart label="אין נתונים שנתיים" />;
  return (
    <div className="glass-card fade-in" style={{ padding: "20px 16px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>📈 מגמה שנתית</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="fireGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="count" name="אירועים" stroke="#ef4444" fill="url(#fireGrad)" strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyChart({ monthlyCounts }: { monthlyCounts: Record<string, number> }) {
  const data = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS_HE[i], count: monthlyCounts[i + 1] || 0 }));
  return (
    <div className="glass-card fade-in" style={{ padding: "20px 16px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>📅 התפלגות חודשית ({new Date().getFullYear()})</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="אירועים" fill="#f97316" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DevicePieChart({ deviceCounts }: { deviceCounts: Record<string, number> }) {
  const data = Object.entries(deviceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, color: DEVICE_COLORS[name] || "#6b7280", icon: DEVICE_ICONS[name] || "⚡" }));
  if (!data.length) return <EmptyChart label="אין נתוני מכשירים" />;
  return (
    <div className="glass-card fade-in" style={{ padding: "20px 16px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>📊 התפלגות לפי מכשיר</h3>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {data.slice(0, 6).map((d) => (
            <div key={d.name} style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8",
              padding: "4px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
              <span>{d.icon} {d.name}</span>
              <span style={{ fontWeight: 700, color: d.color }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopCitiesChart({ topCities }: { topCities: [string, number][] }) {
  const data = topCities.map(([city, count]) => ({ city, count }));
  if (!data.length) return <EmptyChart label="אין נתוני ערים" />;
  return (
    <div className="glass-card fade-in" style={{ padding: "20px 16px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>🏙️ ערים מובילות</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="city" width={80} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" name="אירועים" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ===========================================
// INCIDENT LIST
// ===========================================

function IncidentList({ incidents }: { incidents: Incident[] }) {
  const [showCount, setShowCount] = useState(10);
  const visible = incidents.slice(0, showCount);
  return (
    <div className="glass-card fade-in" style={{ padding: "20px 16px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>🔥 אירועים אחרונים ({incidents.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((inc, i) => (
          <div key={inc.id || i} className="incident-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{DEVICE_ICONS[inc.device_type || ""] || "⚡"}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inc.title || inc.description || "שריפת " + inc.device_type}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    {inc.city}{inc.incident_date && " · " + new Date(inc.incident_date).toLocaleDateString("he-IL")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <SeverityBadge severity={inc.severity} />
                {((inc.deaths || 0) > 0 || (inc.injuries || 0) > 0) && (
                  <span className="badge" style={{
                    background: (inc.deaths || 0) > 0 ? "rgba(220,38,38,0.15)" : "rgba(249,115,22,0.15)",
                    color: (inc.deaths || 0) > 0 ? "#dc2626" : "#f97316",
                  }}>
                    {(inc.deaths || 0) > 0 && "💀" + inc.deaths}
                    {(inc.deaths || 0) > 0 && (inc.injuries || 0) > 0 && " "}
                    {(inc.injuries || 0) > 0 && "🤕" + inc.injuries}
                  </span>
                )}
              </div>
            </div>
            {inc.description && (
              <div style={{
                fontSize: 12, color: "#94a3b8", marginTop: 8, lineHeight: 1.5,
                overflow: "hidden", textOverflow: "ellipsis",
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>{inc.description}</div>
            )}
            {inc.source_url && (
              <a href={inc.source_url} target="_blank" rel="noopener noreferrer" style={{
                display: "inline-block", marginTop: 6, fontSize: 11, color: "#3b82f6", textDecoration: "none",
              }}>🔗 {inc.source_name || "מקור"}</a>
            )}
          </div>
        ))}
      </div>
      {incidents.length > showCount && (
        <button onClick={() => setShowCount((s) => s + 10)} style={{
          width: "100%", marginTop: 12, padding: "10px", background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, color: "#94a3b8",
          cursor: "pointer", fontFamily: "inherit", fontSize: 13,
        }}>הצג עוד ({incidents.length - showCount} נותרו)</button>
      )}
    </div>
  );
}

// ===========================================
// SYSTEM STATUS
// ===========================================

function SystemStatus({ searchRuns, lastUpdate, status }: {
  searchRuns: SearchRun[]; lastUpdate: string | null; status: string;
}) {
  return (
    <div className="glass-card fade-in" style={{ padding: "20px 16px" }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>⚙️ מצב מערכת</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "סטטוס", value: status === "active" ? "פעיל" : "בדיקה", ok: status === "active" },
          { label: "סריקות שבוצעו", value: String(searchRuns?.length || 0), ok: true },
          { label: "עדכון אחרון", value: lastUpdate ? new Date(lastUpdate).toLocaleString("he-IL") : "טרם", ok: !!lastUpdate },
        ].map((s) => (
          <div key={s.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.ok ? "#22c55e" : "#eab308" }} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </div>
      {searchRuns?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>סריקות אחרונות</div>
          {searchRuns.slice(0, 5).map((run, i) => (
            <div key={run.id || i} style={{
              display: "flex", justifyContent: "space-between", fontSize: 11,
              padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.02)", color: "#64748b",
            }}>
              <span>{run.started_at ? new Date(run.started_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
              <span style={{
                color: run.status === "completed" ? "#22c55e" : run.status === "failed" ? "#ef4444" : "#eab308",
                fontWeight: 600,
              }}>
                {run.status === "completed" ? "✓ " + (run.new_incidents || 0) + " חדשים" : run.status === "failed" ? "✗ נכשל" : "⏳"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================
// LATEST ALERT BANNER
// ===========================================

function LatestAlert({ incident }: { incident: Incident | null }) {
  if (!incident) return null;
  return (
    <div className="fade-in" style={{
      background: "linear-gradient(135deg, rgba(220,38,38,0.1), rgba(249,115,22,0.05))",
      border: "1px solid rgba(220,38,38,0.2)", borderRadius: 14, padding: "14px 18px",
      marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 24 }}>{DEVICE_ICONS[incident.device_type || ""] || "🔥"}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>
          אירוע אחרון: {incident.title || incident.description || "שריפת " + incident.device_type}
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
          {incident.city}{incident.incident_date && " · " + new Date(incident.incident_date).toLocaleDateString("he-IL")}
        </div>
      </div>
      <SeverityBadge severity={incident.severity} />
    </div>
  );
}

// ===========================================
// HEADER
// ===========================================

function Header({ lastUpdate, systemStatus }: { lastUpdate?: string | null; systemStatus?: string }) {
  return (
    <header className="header-gradient" style={{ padding: 16, position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🔋</span>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: "#fca5a5", lineHeight: 1.2, margin: 0 }}>מעקב שריפות ליתיום-יון</h1>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>כבאות והצלה לישראל</div>
          </div>
        </div>
        <LiveIndicator lastUpdate={lastUpdate} status={systemStatus || "loading"} />
      </div>
    </header>
  );
}

// ===========================================
// MAIN DASHBOARD
// ===========================================

export default function LithiumDashboard() {
  const { incidents, stats, loading, error, searchRuns, lastUpdate, systemStatus, refresh } = useLiveData();
  const [activeTab, setActiveTab] = useState("overview");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const latestIncident = incidents[0] || null;
  const tabs = [
    { id: "overview", label: "📊 סקירה" },
    { id: "incidents", label: "🔥 אירועים" },
    { id: "analytics", label: "📈 ניתוח" },
    { id: "system", label: "⚙️ מערכת" },
  ];

  if (loading) return (<><GlobalStyles /><Header /><LoadingState /></>);
  if (error && incidents.length === 0) return (<><GlobalStyles /><Header /><ErrorState error={error} onRetry={refresh} /></>);

  return (
    <>
      <GlobalStyles />
      <Header lastUpdate={lastUpdate} systemStatus={systemStatus} />
      <div className="dashboard-container">
        <LatestAlert incident={latestIncident} />

        <div className="tabs-scroll" style={{ marginBottom: 20 }}>
          {tabs.map((tab) => (
            <button key={tab.id} className={"tab-btn" + (activeTab === tab.id ? " active" : "")} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="fade-in">
            <div className="grid-4" style={{ marginBottom: 16 }}>
              <StatCard icon="🔥" label="סה״כ אירועים" value={stats.totalIncidents || 0} color="#ef4444" accentClass="accent-red" />
              <StatCard icon="💀" label="הרוגים" value={stats.totalDeaths || 0} color="#dc2626" accentClass="accent-darkred" />
              <StatCard icon="🤕" label="פצועים" value={stats.totalInjuries || 0} color="#f97316" accentClass="accent-orange" />
              <StatCard
                icon="📱" label="סוג מוביל"
                value={stats.deviceCounts ? (Object.entries(stats.deviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—") : "—"}
                color="#8b5cf6" accentClass="accent-purple"
              />
            </div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <YearlyChart yearlyCounts={stats.yearlyCounts || {}} />
              <DevicePieChart deviceCounts={stats.deviceCounts || {}} />
            </div>
            <div className="grid-2">
              <MonthlyChart monthlyCounts={stats.monthlyCounts || {}} />
              <TopCitiesChart topCities={stats.topCities || []} />
            </div>
          </div>
        )}

        {activeTab === "incidents" && <IncidentList incidents={incidents} />}

        {activeTab === "analytics" && (
          <div className="fade-in">
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <YearlyChart yearlyCounts={stats.yearlyCounts || {}} />
              <MonthlyChart monthlyCounts={stats.monthlyCounts || {}} />
            </div>
            <div className="grid-2">
              <DevicePieChart deviceCounts={stats.deviceCounts || {}} />
              <TopCitiesChart topCities={stats.topCities || []} />
            </div>
            {stats.severityCounts && Object.keys(stats.severityCounts).length > 0 && (
              <div className="glass-card" style={{ padding: "20px 16px", marginTop: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>🎯 התפלגות חומרה</h3>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {Object.entries(stats.severityCounts).map(([sev, count]) => {
                    const cfg = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG["בינונית"];
                    const pct = stats.totalIncidents ? Math.round((count / stats.totalIncidents) * 100) : 0;
                    return (
                      <div key={sev} style={{
                        flex: "1 1 120px", padding: 14, borderRadius: 12,
                        background: cfg.bg, border: "1px solid " + cfg.color + "33", textAlign: "center",
                      }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{cfg.icon}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>{count}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>{sev}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "system" && (
          <div className="fade-in grid-2">
            <SystemStatus searchRuns={searchRuns} lastUpdate={lastUpdate} status={systemStatus} />
            <div className="glass-card" style={{ padding: "20px 16px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>📋 סטטוס טכני</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Vercel Cron", value: "פעיל — כל 6 שעות", ok: true },
                  { label: "Gemini AI", value: "מחובר", ok: true },
                  { label: "Supabase DB", value: incidents.length + " אירועים", ok: incidents.length > 0 },
                  { label: "סריקות", value: (searchRuns?.length || 0) + " סה״כ", ok: true },
                ].map((s) => (
                  <div key={s.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.ok ? "#22c55e" : "#eab308" }} />
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{s.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={async () => {
                try {
                  const res = await fetch("/api/scan");
                  const d = await res.json();
                  alert("סריקה הושלמה!\nנסרקו: " + (d.scanned || 0) + "\nנוספו: " + (d.inserted || 0));
                  refresh();
                } catch (e: any) { alert("שגיאה בסריקה: " + e.message); }
              }} style={{
                width: "100%", marginTop: 16, padding: 12,
                background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.15))",
                border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, color: "#f87171",
                cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              }}>🔍 הפעל סריקה ידנית</button>
            </div>
          </div>
        )}
      </div>

      <footer style={{
        textAlign: "center", padding: "24px 16px", fontSize: 11,
        color: "#475569", borderTop: "1px solid rgba(255,255,255,0.03)", marginTop: 40,
      }}>
        דשבורד שריפות ליתיום-יון · כבאות והצלה לישראל · איסוף וניתוח אוטומטי
        <br />
        נבנה באמצעות Next.js + Supabase + Gemini AI · נתונים ממקורות ציבוריים
      </footer>

      {showScrollTop && (
        <button className="scroll-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑</button>
      )}
    </>
  );
}
