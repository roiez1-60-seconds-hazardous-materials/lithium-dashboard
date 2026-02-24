"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

const GASES = {
  general: { name: "כללי / חינוכי", nameEn: "General", lel: 5, uel: 15, formula: "—", un: "—", description: "ערכים כלליים להדגמה", color: "#6366f1" },
  methane: { name: "מתאן", nameEn: "Methane", lel: 5.0, uel: 15.0, formula: "CH₄", un: "1971", description: "גז טבעי — דליק, חסר ריח וצבע", color: "#3b82f6" },
  propane: { name: "פרופאן", nameEn: "Propane", lel: 2.1, uel: 9.5, formula: "C₃H₈", un: "1978", description: "גז בישול ותעשייה, כבד מאוויר", color: "#f59e0b" },
  hydrogen: { name: "מימן", nameEn: "Hydrogen", lel: 4.0, uel: 75.0, formula: "H₂", un: "1049", description: "קל ביותר, טווח נפיצות רחב מאוד!", color: "#06b6d4" },
  butane: { name: "בוטאן", nameEn: "Butane", lel: 1.8, uel: 8.4, formula: "C₄H₁₀", un: "1011", description: "גז מציתים, כבד מאוויר", color: "#8b5cf6" },
  acetylene: { name: "אצטילן", nameEn: "Acetylene", lel: 2.5, uel: 100.0, formula: "C₂H₂", un: "1001", description: "גז ריתוך — מסוכן במיוחד!", color: "#ef4444" },
  ethanol: { name: "אתנול (אדים)", nameEn: "Ethanol", lel: 3.3, uel: 19.0, formula: "C₂H₅OH", un: "1170", description: "אדי אלכוהול דליקים", color: "#10b981" },
  ammonia: { name: "אמוניה", nameEn: "Ammonia", lel: 15.0, uel: 28.0, formula: "NH₃", un: "1005", description: "גז רעיל ודליק, ריח חריף", color: "#f43f5e" },
  co: { name: "פחמן חד חמצני", nameEn: "Carbon Monoxide", lel: 12.5, uel: 74.0, formula: "CO", un: "1016", description: "הרוצח השקט — רעיל וחסר ריח", color: "#6366f1" },
  ethylene: { name: "אתילן", nameEn: "Ethylene", lel: 2.7, uel: 36.0, formula: "C₂H₄", un: "1962", description: "גז תעשייתי דליק", color: "#14b8a6" },
  lpg: { name: 'גפ"מ', nameEn: "LPG Mix", lel: 1.8, uel: 9.5, formula: "C₃/C₄", un: "1075", description: 'תערובת גפ"מ — גז ביתי', color: "#f97316" },
  hexane: { name: "הקסאן", nameEn: "Hexane", lel: 1.1, uel: 7.5, formula: "C₆H₁₄", un: "1208", description: "ממס תעשייתי נדיף", color: "#84cc16" },
};

const ZONES = {
  safe:      { bg: "#34d399", bgLight: "#d1fae5", text: "#065f46", label: "בטוח",              labelEn: "SAFE",      icon: "✅" },
  caution:   { bg: "#fbbf24", bgLight: "#fef3c7", text: "#92400e", label: "זהירות — 10% LEL",  labelEn: "CAUTION",   icon: "⚠️" },
  warning:   { bg: "#fb923c", bgLight: "#ffedd5", text: "#9a3412", label: "אזהרה — 20% LEL",   labelEn: "WARNING",   icon: "🟠" },
  preLel:    { bg: "#f87171", bgLight: "#fee2e2", text: "#991b1b", label: "סכנה — קרוב ל-LEL", labelEn: "DANGER",    icon: "🔴" },
  explosive: { bg: "#ef4444", bgLight: "#fee2e2", text: "#7f1d1d", label: "טווח נפיצות!",      labelEn: "EXPLOSIVE", icon: "💥" },
  rich:      { bg: "#a78bfa", bgLight: "#ede9fe", text: "#5b21b6", label: "עשיר מדי — מעל UEL", labelEn: "TOO RICH", icon: "🟣" },
};

function getZone(val, lel, uel) {
  if (val <= lel * 0.1) return "safe";
  if (val <= lel * 0.2) return "caution";
  if (val <= lel * 0.5) return "warning";
  if (val <= lel) return "preLel";
  if (val <= uel) return "explosive";
  return "rich";
}

function fmt(v) {
  if (v === 0) return "0 ppm";
  if (v < 0.01) return (v * 10000).toFixed(1) + " ppm";
  if (v < 1) return (v * 10000).toFixed(0) + " ppm (" + v.toFixed(3) + "%)";
  return v.toFixed(2) + "% vol";
}

const ZOOM_LEVELS = [
  { label: "0–100%", id: "full" },
  { label: "טווח נפיצות", id: "range" },
  { label: "אזור התראות", id: "alarms" },
];

function playAlarm10() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (var i = 0; i < 3; i++) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = "sine";
      g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.8);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.8 + 0.5);
      o.start(ctx.currentTime + i * 0.8); o.stop(ctx.currentTime + i * 0.8 + 0.5);
    }
  } catch(e) {}
}

function playAlarm20() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (var i = 0; i < 8; i++) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 1200; o.type = "square";
      g.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.35 + 0.2);
      o.start(ctx.currentTime + i * 0.35); o.stop(ctx.currentTime + i * 0.35 + 0.2);
    }
  } catch(e) {}
}

function tryVibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e) {}
}

export default function Home() {
  const [selectedGas, setSelectedGas] = useState("general");
  const [concentration, setConcentration] = useState(0);
  const [zoomLevel, setZoomLevel] = useState("full");
  const [showGasMenu, setShowGasMenu] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [isEducational, setIsEducational] = useState(false);
  const [customLel, setCustomLel] = useState(5);
  const [customUel, setCustomUel] = useState(15);
  const [manualInput, setManualInput] = useState("");
  const [flashScreen, setFlashScreen] = useState(false);
  const [showAlert10, setShowAlert10] = useState(false);
  const [showAlert20, setShowAlert20] = useState(false);

  const prev10 = useRef(false);
  const prev20 = useRef(false);

  useEffect(function() { setAnimateIn(true); }, []);

  const gas = GASES[selectedGas];
  const activeLel = isEducational ? customLel : gas.lel;
  const activeUel = isEducational ? customUel : gas.uel;
  const zone = getZone(concentration, activeLel, activeUel);
  const zoneInfo = ZONES[zone];

  useEffect(function() {
    var at10 = concentration >= activeLel * 0.1;
    var at20 = concentration >= activeLel * 0.2;

    if (at10 && !prev10.current) {
      playAlarm10();
      tryVibrate([300, 100, 300, 100, 300]);
      setShowAlert10(true);
      setTimeout(function() { setShowAlert10(false); }, 3000);
    }
    if (at20 && !prev20.current) {
      playAlarm20();
      tryVibrate([200, 50, 200, 50, 200, 50, 500, 100, 500]);
      setFlashScreen(true);
      setShowAlert20(true);
      setTimeout(function() { setFlashScreen(false); setShowAlert20(false); }, 3500);
    }
    prev10.current = at10;
    prev20.current = at20;
  }, [concentration, activeLel]);

  const scaleRange = useMemo(function() {
    if (zoomLevel === "alarms") return { minScale: 0, maxScale: Math.ceil(activeLel * 1.5 * 100) / 100 };
    if (zoomLevel === "range") {
      var lo = Math.max(0, Math.floor(activeLel * 0.5 * 100) / 100);
      var hi = Math.min(100, Math.ceil(activeUel * 1.3 * 100) / 100);
      return { minScale: lo, maxScale: hi };
    }
    return { minScale: 0, maxScale: 100 };
  }, [activeLel, activeUel, zoomLevel]);

  var minScale = scaleRange.minScale;
  var maxScale = scaleRange.maxScale;

  var toPct = useCallback(function(v) {
    var range = maxScale - minScale;
    if (range <= 0) return 0;
    return Math.max(0, Math.min(100, ((v - minScale) / range) * 100));
  }, [minScale, maxScale]);

  var lel10Pct = toPct(activeLel * 0.1);
  var lel20Pct = toPct(activeLel * 0.2);
  var lelPct   = toPct(activeLel);
  var uelPct   = toPct(activeUel);
  var sliderPct = toPct(concentration);

  var handleGasChange = useCallback(function(k) {
    setSelectedGas(k);
    setConcentration(0);
    setShowGasMenu(false);
    setIsEducational(false);
    prev10.current = false;
    prev20.current = false;
  }, []);

  var handleManualSubmit = function() {
    var v = parseFloat(manualInput);
    if (!isNaN(v) && v >= 0 && v <= 100) {
      var volPct = (v / 100) * activeLel;
      if (volPct >= minScale && volPct <= maxScale) {
        setConcentration(volPct);
      }
    }
    setManualInput("");
  };

  var scaleMarks = useMemo(function() {
    var range = maxScale - minScale;
    var step = range <= 1 ? 0.1 : range <= 3 ? 0.5 : range <= 10 ? 1 : range <= 30 ? 5 : range <= 60 ? 10 : 20;
    var marks = [];
    var v = Math.ceil(minScale / step) * step;
    if (v - minScale > step * 0.3) marks.push(Math.round(minScale * 100) / 100);
    while (v <= maxScale + step * 0.01) {
      marks.push(Math.round(v * 100) / 100);
      v += step;
    }
    if (maxScale - marks[marks.length - 1] > step * 0.3) marks.push(Math.round(maxScale * 100) / 100);
    return marks;
  }, [minScale, maxScale]);

  var barSegments = useMemo(function() {
    var segs = [];
    var pts = [
      { pct: 0,       color: "#34d399" },
      { pct: lel10Pct, color: "#fbbf24" },
      { pct: lel20Pct, color: "#fb923c" },
      { pct: lelPct,   color: "#ef4444" },
      { pct: uelPct,   color: "#a78bfa" },
      { pct: 100,      color: null },
    ];
    for (var i = 0; i < pts.length - 1; i++) {
      var w = pts[i + 1].pct - pts[i].pct;
      if (w > 0.1) segs.push({ start: pts[i].pct, width: w, color: pts[i].color });
    }
    return segs;
  }, [lel10Pct, lel20Pct, lelPct, uelPct]);

  var markers = useMemo(function() {
    return [
      { pct: lel10Pct, label: "10% LEL", color: "#d97706" },
      { pct: lel20Pct, label: "20% LEL", color: "#ea580c" },
      { pct: lelPct,   label: "LEL",     color: "#dc2626", bold: true },
      { pct: uelPct,   label: "UEL",     color: "#7c3aed", bold: true },
    ].filter(function(m) { return m.pct > 0.3 && m.pct < 99.7; });
  }, [lel10Pct, lel20Pct, lelPct, uelPct]);

  return (
    <div style={{
      minHeight: "100vh",
      background: flashScreen
        ? "linear-gradient(180deg, #fecaca 0%, #fee2e2 50%, #fecaca 100%)"
        : "linear-gradient(180deg, #f0f4f8 0%, #e8ecf1 50%, #f0f4f8 100%)",
      fontFamily: "'Rubik', -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif",
      color: "#1e293b", direction: "rtl",
      transition: "background 0.3s ease",
    }}>
      <style>{"\
        @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');\
        * { box-sizing: border-box; margin: 0; padding: 0; }\
        @keyframes fadeInUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }\
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }\
        @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }\
        @keyframes flashBorder { 0%,100% { border-color:#fca5a5; } 50% { border-color:#ef4444; } }\
        @keyframes alertSlideIn { from { opacity:0; transform:translateY(-20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }\
        @keyframes alertPulse { 0%,100% { opacity:1; } 50% { opacity:0.7; } }\
        .card {\
          background: rgba(255,255,255,0.88);\
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);\
          border: 1px solid rgba(255,255,255,0.95);\
          border-radius: 20px;\
          box-shadow: 0 2px 20px rgba(0,0,0,0.05), 0 1px 4px rgba(0,0,0,0.03);\
        }\
        input[type=range] {\
          -webkit-appearance:none; appearance:none;\
          width:100%; height:56px; background:transparent; cursor:pointer; z-index:10; position:relative;\
        }\
        input[type=range]::-webkit-slider-runnable-track { height:56px; background:transparent; border-radius:16px; }\
        input[type=range]::-webkit-slider-thumb {\
          -webkit-appearance:none; appearance:none;\
          width:6px; height:72px; background:#1e293b; border-radius:3px; margin-top:-8px;\
          box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 2px 10px rgba(0,0,0,0.3);\
        }\
        input[type=range]::-moz-range-thumb {\
          width:6px; height:72px; background:#1e293b; border-radius:3px; border:none;\
          box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 2px 10px rgba(0,0,0,0.3);\
        }\
        input[type=range]::-moz-range-track { height:56px; background:transparent; border-radius:16px; }\
        .gas-btn {\
          padding:10px 14px; border-radius:14px; border:1px solid #e2e8f0; background:white;\
          color:#334155; cursor:pointer; transition:all 0.2s; font-family:inherit; font-size:13px;\
          text-align:right; display:flex; align-items:center; gap:8px; width:100%;\
        }\
        .gas-btn:hover { background:#f8fafc; border-color:#cbd5e1; box-shadow:0 2px 8px rgba(0,0,0,0.06); }\
        .gas-btn.active { background:#eff6ff; border-color:#93c5fd; box-shadow:0 0 0 2px rgba(59,130,246,0.15); }\
        .zoom-btn {\
          padding:8px 16px; border-radius:12px; font-size:12px; font-weight:600;\
          border:1px solid #e2e8f0; background:white; color:#64748b;\
          cursor:pointer; transition:all 0.2s; font-family:inherit;\
        }\
        .zoom-btn:hover { background:#f8fafc; }\
        .zoom-btn.active { background:#3b82f6; color:white; border-color:#3b82f6; box-shadow:0 2px 8px rgba(59,130,246,0.25); }\
        .num-input {\
          width:80px; padding:8px 10px; border-radius:10px; border:1px solid #e2e8f0;\
          font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:600;\
          text-align:center; background:white; color:#0f172a; outline:none; transition:border-color 0.2s;\
        }\
        .num-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.1); }\
        .manual-input {\
          width:120px; padding:8px 12px; border-radius:12px; border:1px solid #e2e8f0;\
          font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:500;\
          text-align:center; background:white; color:#0f172a; outline:none;\
        }\
        .manual-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.1); }\
      "}</style>

      {showAlert10 && (
        <div style={{
          position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", zIndex:1000,
          padding:"16px 24px", borderRadius:16, maxWidth:440, width:"90%",
          background:"linear-gradient(135deg, #fef3c7, #fffbeb)",
          border:"2px solid #f59e0b",
          boxShadow:"0 8px 32px rgba(245,158,11,0.3)",
          animation:"alertSlideIn 0.3s ease-out",
          display:"flex", alignItems:"flex-start", gap:12, direction:"rtl",
        }}>
          <span style={{ fontSize:28, flexShrink:0 }}>⚠️</span>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#92400e", marginBottom:4 }}>חציית 10% LEL!</div>
            <div style={{ fontSize:12, color:"#b45309" }}>גלול למטה לנוהל פעולה מלא</div>
          </div>
        </div>
      )}
      {showAlert20 && (
        <div style={{
          position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", zIndex:1000,
          padding:"16px 24px", borderRadius:16, maxWidth:440, width:"90%",
          background:"linear-gradient(135deg, #fee2e2, #fef2f2)",
          border:"2px solid #ef4444",
          boxShadow:"0 8px 32px rgba(239,68,68,0.3)",
          animation:"alertSlideIn 0.3s ease-out, alertPulse 0.5s ease-in-out 3",
          display:"flex", alignItems:"flex-start", gap:12, direction:"rtl",
        }}>
          <span style={{ fontSize:28, flexShrink:0 }}>🚨</span>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#991b1b", marginBottom:4 }}>חציית 20% LEL — סכנה!</div>
            <div style={{ fontSize:12, color:"#dc2626" }}>גלול למטה לנוהל פעולה מלא</div>
          </div>
        </div>
      )}

      <div style={{
        maxWidth:880, margin:"0 auto", padding:"24px 20px 40px",
        opacity: animateIn ? 1 : 0, transform: animateIn ? "none" : "translateY(16px)",
        transition:"all 0.6s ease-out",
      }}>

        <div style={{ textAlign:"center", marginBottom:24, animation:"fadeInUp 0.5s ease-out" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:52, height:52, borderRadius:16,
              background:"linear-gradient(135deg, #f97316, #ef4444, #dc2626)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:26, boxShadow:"0 4px 16px rgba(239,68,68,0.25)",
            }}>🔥</div>
            <div>
              <h1 style={{ fontSize:28, fontWeight:800, color:"#0f172a", letterSpacing:"-0.02em" }}>סקאלת טווח נפיצות</h1>
              <p style={{ fontSize:13, color:"#94a3b8", fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>Flammability Range Scale</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding:16, marginBottom:12, animation:"fadeInUp 0.5s ease-out 0.05s both" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showGasMenu ? 12 : 0 }}>
            <span style={{ fontSize:14, fontWeight:600, color:"#64748b" }}>בחירת גז</span>
            <button onClick={function() { setShowGasMenu(!showGasMenu); }} style={{
              padding:"8px 16px", borderRadius:12, background:"white", border:"1px solid #e2e8f0",
              color:"#334155", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:500,
              display:"flex", alignItems:"center", gap:8,
              boxShadow:"0 1px 4px rgba(0,0,0,0.05)", transition:"all 0.2s",
            }}>
              <span style={{ width:10, height:10, borderRadius:"50%", background: gas.color }} />
              <span>{gas.name}</span>
              {gas.formula !== "—" && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#94a3b8" }}>{gas.formula}</span>}
              <span style={{ fontSize:10, color:"#94a3b8" }}>{showGasMenu ? "▲" : "▼"}</span>
            </button>
          </div>

          {showGasMenu && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:6, animation:"slideDown 0.25s ease-out" }}>
              {Object.entries(GASES).map(function([key, g]) {
                return (
                  <button key={key} className={"gas-btn" + (key === selectedGas ? " active" : "")} onClick={function() { handleGasChange(key); }}>
                    <span style={{ width:10, height:10, borderRadius:"50%", background:g.color, flexShrink:0 }} />
                    <span style={{ flex:1 }}>{g.name}</span>
                    {g.un !== "—" && <span style={{ fontSize:10, color:"#94a3b8", fontFamily:"'JetBrains Mono',monospace" }}>UN{g.un}</span>}
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#94a3b8" }}>{g.formula}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{
          padding:14, marginBottom:12, animation:"fadeInUp 0.5s ease-out 0.1s both",
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
        }}>
          <div style={{
            display:"flex", alignItems:"center", gap:8, flex:1, minWidth:200,
            padding:"8px 12px", borderRadius:12, background:gas.color + "08", border:"1px solid " + gas.color + "20",
          }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:gas.color }} />
            <span style={{ fontSize:13, color:"#475569" }}>{gas.description}</span>
            {gas.un !== "—" && <span style={{
              fontSize:10, color:"#94a3b8", fontFamily:"'JetBrains Mono',monospace",
              padding:"2px 6px", borderRadius:6, background:"#f1f5f9", marginRight:"auto",
            }}>UN {gas.un}</span>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ padding:"8px 14px", borderRadius:12, background:"#f5f3ff", border:"1px solid #ddd6fe", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#7c3aed", fontWeight:700 }}>UEL</div>
              <div style={{ fontSize:16, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:"#7c3aed" }}>{activeUel}%</div>
            </div>
            <div style={{ padding:"8px 14px", borderRadius:12, background:"#fef2f2", border:"1px solid #fecaca", textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#dc2626", fontWeight:700 }}>LEL</div>
              <div style={{ fontSize:16, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:"#dc2626" }}>{activeLel}%</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding:14, marginBottom:12, animation:"fadeInUp 0.5s ease-out 0.12s both" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:16 }}>🎓</span>
              <span style={{ fontSize:14, fontWeight:600, color:"#475569" }}>מצב חינוכי</span>
              <span style={{ fontSize:11, color:"#94a3b8" }}>— הגדר LEL/UEL ידנית</span>
            </div>
            <button onClick={function() {
              var next = !isEducational;
              setIsEducational(next);
              if (next) { setCustomLel(gas.lel); setCustomUel(gas.uel); }
              setConcentration(0); prev10.current = false; prev20.current = false;
            }} style={{
              padding:"6px 18px", borderRadius:10, fontSize:13, fontWeight:600,
              border: isEducational ? "1px solid #3b82f6" : "1px solid #e2e8f0",
              background: isEducational ? "#3b82f6" : "white",
              color: isEducational ? "white" : "#64748b",
              cursor:"pointer", transition:"all 0.2s", fontFamily:"inherit",
            }}>
              {isEducational ? "פעיל ✓" : "הפעל"}
            </button>
          </div>

          {isEducational && (
            <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", animation:"slideDown 0.25s ease-out" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <label style={{ fontSize:13, fontWeight:600, color:"#dc2626" }}>LEL %</label>
                <input type="number" className="num-input" value={customLel} min={0.1} max={customUel - 0.1} step={0.1}
                  onChange={function(e) {
                    var v = parseFloat(e.target.value) || 0;
                    if (v >= customUel) v = customUel - 0.1;
                    if (v < 0.1) v = 0.1;
                    setCustomLel(Math.round(v * 10) / 10);
                    setConcentration(0); prev10.current=false; prev20.current=false;
                  }} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <label style={{ fontSize:13, fontWeight:600, color:"#7c3aed" }}>UEL %</label>
                <input type="number" className="num-input" value={customUel} min={customLel + 0.1} max={100} step={0.1}
                  onChange={function(e) {
                    var v = parseFloat(e.target.value) || 0;
                    if (v <= customLel) v = customLel + 0.1;
                    if (v > 100) v = 100;
                    setCustomUel(Math.round(v * 10) / 10);
                    setConcentration(0); prev10.current=false; prev20.current=false;
                  }} />
              </div>
              {customLel >= customUel && (
                <div style={{ fontSize:12, color:"#dc2626", fontWeight:600 }}>⚠ LEL חייב להיות קטן מ-UEL</div>
              )}
            </div>
          )}
        </div>

        <div style={{
          display:"flex", gap:8, marginBottom:10, justifyContent:"space-between", alignItems:"center", flexWrap:"wrap",
          animation:"fadeInUp 0.5s ease-out 0.15s both",
        }}>
          <div style={{ display:"flex", gap:6 }}>
            {ZOOM_LEVELS.map(function(z) {
              return (
                <button key={z.id} className={"zoom-btn" + (zoomLevel === z.id ? " active" : "")}
                  onClick={function() { setZoomLevel(z.id); }}>
                  {"🔎 " + z.label}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input type="text" className="manual-input" placeholder="הזן % LEL"
              value={manualInput} onChange={function(e) { setManualInput(e.target.value); }}
              onKeyDown={function(e) { if (e.key === "Enter") handleManualSubmit(); }}
              style={{ direction:"ltr" }}
            />
            <button onClick={handleManualSubmit} style={{
              padding:"8px 14px", borderRadius:10, background:"#3b82f6", color:"white",
              border:"none", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit",
            }}>הזן</button>
          </div>
        </div>

        <div className="card" style={{
          padding:"22px 20px 14px", marginBottom:12,
          animation: zone === "explosive"
            ? "fadeInUp 0.5s ease-out 0.2s both, flashBorder 1.5s ease-in-out infinite"
            : "fadeInUp 0.5s ease-out 0.2s both",
          borderColor: zone === "explosive" ? "#fca5a5" : undefined,
        }}>
          <div style={{ position:"relative", height:56, marginBottom:4, marginTop:24 }}>
            <div style={{
              position:"absolute", top:0, left:0, right:0, bottom:0,
              borderRadius:16, overflow:"hidden", display:"flex", direction:"ltr",
              boxShadow:"inset 0 2px 4px rgba(0,0,0,0.06)",
            }}>
              {barSegments.map(function(seg, i) {
                return <div key={i} style={{ width:seg.width + "%", background:seg.color, transition:"width 0.4s ease", opacity:0.85 }} />;
              })}
            </div>

            {markers.map(function(m, i) {
              return (
                <div key={i} style={{
                  position:"absolute", left:m.pct + "%", top:-2, bottom:-2,
                  width: m.bold ? 3 : 2, background:m.color, zIndex:5,
                  transition:"left 0.4s ease", direction:"ltr", borderRadius:2,
                }}>
                  <div style={{
                    position:"absolute", top:-24, left:"50%", transform:"translateX(-50%)",
                    fontSize: m.bold ? 11 : 9, fontWeight:700, color:m.color,
                    whiteSpace:"nowrap", fontFamily:"'JetBrains Mono',monospace",
                    background:"rgba(255,255,255,0.9)", padding:"2px 6px", borderRadius:5,
                    boxShadow:"0 1px 3px rgba(0,0,0,0.1)",
                  }}>{m.label}</div>
                </div>
              );
            })}

            <input type="range" min={minScale} max={maxScale} step={(maxScale - minScale) / 2000}
              value={concentration}
              onChange={function(e) { setConcentration(parseFloat(e.target.value)); }}
              style={{ position:"absolute", top:0, left:0, right:0, height:56, direction:"ltr" }}
            />

            {concentration > minScale && (
              <div style={{
                position:"absolute", left:sliderPct + "%", bottom:-32,
                transform:"translateX(-50%)", fontSize:12, fontWeight:700,
                color:zoneInfo.text, whiteSpace:"nowrap",
                fontFamily:"'JetBrains Mono',monospace",
                background:zoneInfo.bgLight, padding:"3px 10px", borderRadius:8,
                border:"1px solid " + zoneInfo.bg + "40",
                zIndex:15, transition:"all 0.15s",
              }}>
                {concentration < 1 ? (concentration * 10000).toFixed(0) + " ppm" : concentration.toFixed(2) + "%"}
              </div>
            )}
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", marginTop:40, direction:"ltr", padding:"0 2px" }}>
            {scaleMarks.map(function(m, i) {
              return <div key={i} style={{ fontSize:10, color:"#94a3b8", fontFamily:"'JetBrains Mono',monospace", fontWeight:500 }}>{m}%</div>;
            })}
          </div>
        </div>


        <div className="card" style={{
          padding:20, marginBottom:14, animation:"fadeInUp 0.5s ease-out 0.3s both",
          borderColor: zone === "explosive" ? "#fca5a5" : undefined,
          background: zone === "explosive" ? "rgba(254,242,242,0.92)" : undefined,
          transition:"all 0.3s ease",
        }}>
          <div style={{ display:"flex", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>
            <div style={{
              width:60, height:60, borderRadius:18,
              background:zoneInfo.bgLight, border:"2px solid " + zoneInfo.bg + "40",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:28, flexShrink:0,
              animation: zone === "explosive" ? "pulse 1.5s ease-in-out infinite" : "none",
            }}>
              {zoneInfo.icon}
            </div>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontSize:22, fontWeight:800, color:zoneInfo.text }}>{zoneInfo.label}</span>
                <span style={{
                  fontSize:10, fontWeight:600, color:"#94a3b8",
                  fontFamily:"'JetBrains Mono',monospace",
                  padding:"2px 8px", borderRadius:6, background:"#f1f5f9",
                }}>{zoneInfo.labelEn}</span>
              </div>
              <div style={{ fontSize:30, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:"#0f172a", marginBottom:6 }}>
                {fmt(concentration)}
              </div>
              <div style={{ fontSize:13, color:"#64748b", lineHeight:1.7 }}>
                {zone === "safe" && "קיימת דליפת גז דליק, אין סכנת התלקחות. המשך ניטור למציאת המקור."}
                {zone === "caution" && "חצית סף 10% LEL — בצע נוהל פעולה לריכוז 10% LEL (ראה למטה)."}
                {zone === "warning" && "חצית סף 20% LEL — בצע נוהל פעולה לריכוז 20% LEL (ראה למטה)."}
                {zone === "preLel" && "מתקרב לגבול התחתון של הנפיצות! בצע נוהל פעולה לריכוז 20% LEL (ראה למטה)."}
                {zone === "explosive" && "⚠ אתה בטווח הנפיצות! סכנת חיים מיידית — כל ניצוץ עלול לגרום לפיצוץ! שים לב: גלאי 4 גזים שברשותך אינו מסוגל למדוד ערכי נפיצות מעל ל-LEL."}
                {zone === "rich" && "מעל גבול הנפיצות העליון. עדיין מסוכן — תנאים עלולים להשתנות! שים לב: גלאי 4 גזים שברשותך אינו מסוגל למדוד ערכי נפיצות מעל ל-LEL."}
              </div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:8, marginTop:16 }}>
            {[
              { label:"% מ-LEL", value:((concentration / activeLel) * 100).toFixed(1) + "%", color: concentration >= activeLel ? "#dc2626" : "#64748b" },
              { label:"ריכוז ב-ppm", value:(concentration * 10000).toFixed(0), color:"#3b82f6" },
              { label:"ריכוז ב-% vol", value:concentration.toFixed(3) + "%", color:"#10b981" },
              { label:"מרחק מ-LEL", value: concentration < activeLel ? (activeLel - concentration).toFixed(2) + "%" : concentration <= activeUel ? "בטווח!" : "+" + (concentration - activeUel).toFixed(2) + "%", color: concentration >= activeLel && concentration <= activeUel ? "#dc2626" : "#7c3aed" },
            ].map(function(s, i) {
              return (
                <div key={i} style={{ padding:"10px 12px", borderRadius:14, background:"#f8fafc", border:"1px solid #e2e8f0", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:"#94a3b8", fontWeight:600, marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:17, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:s.color, transition:"color 0.3s" }}>{s.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding:18, marginBottom:14, animation:"fadeInUp 0.5s ease-out 0.35s both" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#475569", marginBottom:12 }}>📋 מקרא אזורים</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { color:"#34d399", label:"בטוח",                desc:"0 — " + (activeLel * 0.1).toFixed(2) + "%", sub:"Below 10% LEL" },
              { color:"#fbbf24", label:"זהירות (10% LEL)",    desc:(activeLel * 0.1).toFixed(2) + "% — " + (activeLel * 0.2).toFixed(2) + "%", sub:"First alarm threshold" },
              { color:"#fb923c", label:"אזהרה (20% LEL)",     desc:(activeLel * 0.2).toFixed(2) + "% — " + activeLel + "%", sub:"Evacuation alarm" },
              { color:"#ef4444", label:"טווח נפיצות",         desc:activeLel + "% — " + activeUel + "%", sub:"LEL to UEL — Explosive!" },
              { color:"#a78bfa", label:"עשיר מדי",            desc:activeUel + "% — 100%", sub:"Above UEL — too rich" },
            ].map(function(item, i) {
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:18, height:18, borderRadius:6, background:item.color, flexShrink:0, boxShadow:"0 2px 6px " + item.color + "30" }} />
                  <div>
                    <span style={{ fontSize:14, fontWeight:600, color:"#334155" }}>{item.label}</span>
                    <span style={{ fontSize:12, color:"#94a3b8", marginRight:8 }}>{" — " + item.desc}</span>
                    <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"'JetBrains Mono',monospace" }}>{item.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding:18, marginBottom:14, animation:"fadeInUp 0.5s ease-out 0.4s both" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#475569", marginBottom:12 }}>🔔 סיפי התראה בגלאי גזים</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div style={{ padding:14, borderRadius:16, background:"#fffbeb", border:"1px solid #fde68a", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#d97706", fontWeight:700, marginBottom:4 }}>התראה ראשונה — 10% LEL</div>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:"#d97706" }}>{(activeLel * 0.1).toFixed(2)}%</div>
              <div style={{ fontSize:11, color:"#b45309" }}>{(activeLel * 0.1 * 10000).toFixed(0)} ppm</div>
              <div style={{ fontSize:10, color:"#92400e", marginTop:4 }}>📳 רטט + צליל</div>
            </div>
            <div style={{ padding:14, borderRadius:16, background:"#fff7ed", border:"1px solid #fed7aa", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#ea580c", fontWeight:700, marginBottom:4 }}>התראת פינוי — 20% LEL</div>
              <div style={{ fontSize:22, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:"#ea580c" }}>{(activeLel * 0.2).toFixed(2)}%</div>
              <div style={{ fontSize:11, color:"#c2410c" }}>{(activeLel * 0.2 * 10000).toFixed(0)} ppm</div>
              <div style={{ fontSize:10, color:"#9a3412", marginTop:4 }}>📳 רטט + צליל + הבהוב</div>
            </div>
          </div>
        </div>

        {/* Operational Procedures */}
        <div className="card" style={{
          padding:20, marginBottom:14, animation:"fadeInUp 0.5s ease-out 0.42s both",
          border: (zone === "caution" || zone === "warning" || zone === "preLel") ? "2px solid #f59e0b" : undefined,
          background: zone === "caution" ? "rgba(254,243,199,0.5)" : undefined,
        }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#d97706", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:20 }}>⚠️</span>
            {"נוהל פעולה — חציית 10% LEL"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { num:"1", text:"בידוד זירה", icon:"🚧" },
              { num:"2", text:"מניעת יצירת ניצוץ", icon:"⚡" },
              { num:"3", text:'ניתוק הספקת גז', icon:"🔧" },
              { num:"4", text:'אוורור חלל סגור ע"י פתיחת חלונות', icon:"🪟" },
              { num:"5", text:"הזמנת טכנאי גז", icon:"📞" },
            ].map(function(step, i) {
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"10px 14px", borderRadius:14,
                  background:"#fffbeb", border:"1px solid #fde68a",
                }}>
                  <span style={{ fontSize:18 }}>{step.icon}</span>
                  <span style={{
                    width:24, height:24, borderRadius:8, background:"#f59e0b",
                    color:"white", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:800, flexShrink:0,
                  }}>{step.num}</span>
                  <span style={{ fontSize:14, fontWeight:600, color:"#92400e" }}>{step.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{
          padding:20, marginBottom:14, animation:"fadeInUp 0.5s ease-out 0.44s both",
          border: (zone === "warning" || zone === "preLel") ? "2px solid #ef4444" : undefined,
          background: (zone === "warning" || zone === "preLel") ? "rgba(254,226,226,0.5)" : undefined,
        }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#dc2626", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:20 }}>🚨</span>
            {"נוהל פעולה — חציית 20% LEL"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { num:"1", text:"בידוד זירה", icon:"🚧" },
              { num:"2", text:"השלמת מיגון נשימתי", icon:"😷" },
              { num:"3", text:"מניעת יצירת ניצוץ", icon:"⚡" },
              { num:"4", text:'ניתוק הספקת גז', icon:"🔧" },
              { num:"5", text:"פריסת קו מים בהספק 250 ל\'/דק'", icon:"🚒" },
              { num:"6", text:'אוורור מבוקר ע"י פתיחת חלונות (ושימוש מפוח מוגן נפיצות)', icon:"🪟" },
              { num:"7", text:'דילול ענן ע"י ריסוס קל של מים', icon:"💧" },
              { num:"8", text:"ניתוק חשמל מרחוק", icon:"🔌" },
              { num:"9", text:"הזמנת טכנאי גז", icon:"📞" },
            ].map(function(step, i) {
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"10px 14px", borderRadius:14,
                  background:"#fef2f2", border:"1px solid #fecaca",
                }}>
                  <span style={{ fontSize:18 }}>{step.icon}</span>
                  <span style={{
                    width:24, height:24, borderRadius:8, background:"#ef4444",
                    color:"white", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:800, flexShrink:0,
                  }}>{step.num}</span>
                  <span style={{ fontSize:14, fontWeight:600, color:"#991b1b" }}>{step.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding:18, marginBottom:20, animation:"fadeInUp 0.5s ease-out 0.45s both" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#475569", marginBottom:12 }}>📊 השוואת טווחי נפיצות</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {Object.entries(GASES).filter(function([k]) { return k !== "general"; }).map(function([key, g]) {
              var isSel = key === selectedGas;
              return (
                <div key={key} style={{
                  display:"flex", alignItems:"center", gap:10,
                  opacity: isSel ? 1 : 0.55, cursor:"pointer", transition:"opacity 0.2s", padding:"3px 0",
                }} onClick={function() { handleGasChange(key); }}>
                  <span style={{ width:55, fontSize:11, fontWeight:600, color:g.color, fontFamily:"'JetBrains Mono',monospace", textAlign:"left" }}>{g.formula}</span>
                  <div style={{
                    flex:1, height:20, borderRadius:6, background:"#f1f5f9",
                    position:"relative", overflow:"hidden", direction:"ltr",
                    border: isSel ? "1px solid " + g.color + "60" : "1px solid #e2e8f0",
                  }}>
                    <div style={{
                      position:"absolute", left:g.lel + "%",
                      width:Math.min(g.uel - g.lel, 100 - g.lel) + "%",
                      top:0, bottom:0, background:g.color,
                      borderRadius:4, opacity: isSel ? 0.8 : 0.5, transition:"all 0.3s",
                    }} />
                  </div>
                  <span style={{ width:80, fontSize:10, color:"#94a3b8", textAlign:"left", fontFamily:"'JetBrains Mono',monospace" }}>{g.lel + "–" + g.uel + "%"}</span>
                  <span style={{ width:50, fontSize:9, color:"#cbd5e1", fontFamily:"'JetBrains Mono',monospace" }}>{"UN" + g.un}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:9, color:"#cbd5e1", fontFamily:"'JetBrains Mono',monospace", direction:"ltr" }}>
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>

        <div style={{ textAlign:"center", padding:"12px 0", animation:"fadeInUp 0.5s ease-out 0.5s both" }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            padding:"10px 24px", borderRadius:14,
            background:"rgba(255,255,255,0.75)", border:"1px solid #e2e8f0",
            boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <span style={{ fontSize:16 }}>🧑‍🚒</span>
            <span style={{ fontSize:13, color:"#64748b" }}>
              {"פותח ע\"י "}<span style={{ color:"#334155", fontWeight:700 }}>רועי צוקרמן</span>
            </span>
          </div>
          <div style={{ fontSize:11, color:"#94a3b8", marginTop:8 }}>כלי חינוכי — אין להסתמך עליו כתחליף לגלאי גזים מקצועיים</div>
        </div>
      </div>
    </div>
  );
}
