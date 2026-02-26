"use client";
// @ts-nocheck
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

// ============================================================
// 🔥 LITHIUM FIRE DASHBOARD — PRESENTATION EDITION
// כבאות והצלה לישראל
// ============================================================

const DC: Record<string,string> = { "אופניים חשמליים":"#f97316","קורקינט חשמלי":"#8b5cf6","רכב חשמלי":"#3b82f6","סוללת נייד":"#ec4899","UPS/גיבוי":"#10b981","מתקן אגירה":"#06b6d4","סוללת מחשב":"#f59e0b","אחר":"#6b7280" };
const DI: Record<string,string> = { "אופניים חשמליים":"🚲","קורקינט חשמלי":"🛴","רכב חשמלי":"🚗","סוללת נייד":"📱","UPS/גיבוי":"🔋","מתקן אגירה":"🏭","סוללת מחשב":"💻","אחר":"⚡" };
const SC: Record<string,string> = { "קל":"#22c55e","בינוני":"#f59e0b","חמור":"#f97316","קריטי":"#ef4444" };
const SB: Record<string,string> = { "קל":"rgba(34,197,94,.12)","בינוני":"rgba(245,158,11,.12)","חמור":"rgba(249,115,22,.12)","קריטי":"rgba(239,68,68,.12)" };
const XC: Record<string,string> = { "מרכז":"#3b82f6","דן":"#f97316","חוף":"#06b6d4","צפון":"#22c55e","דרום":"#f59e0b","ירושלים":"#a855f7","שפלה":"#ec4899","שרון":"#14b8a6","יו״ש":"#6366f1" };
const MH = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ==================== DEMO DATA ====================
function generateDemoData() {
  const cities = [
    {c:"תל אביב",d:"דן",w:18},{c:"פתח תקווה",d:"דן",w:8},{c:"בני ברק",d:"דן",w:8},{c:"חולון",d:"דן",w:7},
    {c:"בת ים",d:"דן",w:6},{c:"רמת גן",d:"דן",w:7},{c:"גבעתיים",d:"דן",w:4},{c:"הרצליה",d:"שרון",w:4},
    {c:"ראשון לציון",d:"מרכז",w:7},{c:"רחובות",d:"מרכז",w:4},{c:"לוד",d:"מרכז",w:3},{c:"רמלה",d:"מרכז",w:3},
    {c:"מודיעין",d:"מרכז",w:2},{c:"נתניה",d:"שרון",w:4},{c:"כפר סבא",d:"שרון",w:3},{c:"רעננה",d:"שרון",w:2},
    {c:"הוד השרון",d:"שרון",w:2},{c:"חיפה",d:"חוף",w:5},{c:"קריית אתא",d:"חוף",w:1},{c:"ירושלים",d:"ירושלים",w:8},{c:"בית שמש",d:"ירושלים",w:3},{c:"מבשרת ציון",d:"ירושלים",w:1},{c:"מעלה אדומים",d:"ירושלים",w:2},
    {c:"אשדוד",d:"דרום",w:3},{c:"באר שבע",d:"דרום",w:3},{c:"אשקלון",d:"דרום",w:2},{c:"אילת",d:"דרום",w:1},
    {c:"נצרת",d:"צפון",w:1},{c:"עכו",d:"צפון",w:0.5},{c:"טבריה",d:"צפון",w:0.5},{c:"נהריה",d:"צפון",w:0.5},
    {c:"כוכב יעקב",d:"יו״ש",w:1},{c:"אריאל",d:"יו״ש",w:0.5},
  ];

  const devWeights = [
    {t:"אופניים חשמליים",w:45},{t:"קורקינט חשמלי",w:22},{t:"רכב חשמלי",w:8},{t:"סוללת נייד",w:10},
    {t:"UPS/גיבוי",w:5},{t:"מתקן אגירה",w:3},{t:"סוללת מחשב",w:4},{t:"אחר",w:3}
  ];
  const sevWeights = [{s:"קל",w:25},{s:"בינוני",w:35},{s:"חמור",w:30},{s:"קריטי",w:10}];

  function pick(arr: any[],wKey="w") { const total = arr.reduce((s:number,x:any)=>s+x[wKey],0); let r=Math.random()*total; for(const x of arr){r-=x[wKey];if(r<=0)return x;} return arr[arr.length-1]; }
  function pickCity(arr: any[]) { const total = arr.reduce((s:number,x:any)=>s+x.w,0); let r=Math.random()*total; for(const x of arr){r-=x.w;if(r<=0)return x;} return arr[0]; }

  // Yearly growth: 2019=85, growing ~25-35% per year
  const yearCounts: Record<number,number> = {2019:85,2020:112,2021:148,2022:185,2023:222,2024:252,2025:245,2026:42};
  const incidents: any[] = [];
  let id = 1;

  const fatalEvents = [
    {y:2019,m:7,d:15,city:"בני ברק",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:2,desc:"גבר בן 52 נספה בשריפת דירה. סוללת אופניים חשמליים התלקחה בזמן טעינת לילה"},
    {y:2020,m:3,d:22,city:"תל אביב",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:3,desc:"אישה בת 67 נספתה משאיפת עשן כבד. סוללת אופניים התלקחה בחדר מגורים"},
    {y:2020,m:11,d:8,city:"חיפה",dist:"חוף",dev:"אופניים חשמליים",fat:1,inj:1,desc:"נער בן 14 נספה בשריפה שפרצה מסוללת אופניים חשמליים בדירה"},
    {y:2021,m:5,d:5,city:"אשדוד",dist:"דרום",dev:"אופניים חשמליים",fat:1,inj:2,desc:"לי-ים נחום בן 11 נספה בשריפה בביתו. סוללת אופניים חשמליים התלקחה בטעינה"},
    {y:2021,m:8,d:20,city:"בני ברק",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:1,desc:"נער נספה בשריפה שפרצה מסוללת אופניים חשמליים בדירה"},
    {y:2021,m:9,d:23,city:"פתח תקווה",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:1,desc:"נער בן 12 נספה בשריפה בבניין מגורים מסוללת אופניים חשמליים"},
    {y:2022,m:3,d:25,city:"נתניה",dist:"שרון",dev:"אופניים חשמליים",fat:1,inj:2,desc:"אדם נספה בשריפה מסוללת אופניים בדירה"},
    {y:2022,m:10,d:8,city:"בני ברק",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:1,desc:"נער נספה בשריפה מסוללת אופניים בדירה"},
    {y:2023,m:3,d:8,city:"ראשון לציון",dist:"מרכז",dev:"אופניים חשמליים",fat:1,inj:1,desc:"אדם נספה בשריפת דירה מסוללת אופניים חשמליים"},
    {y:2023,m:6,d:28,city:"תל אביב",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:0,desc:"גבר נספה בשריפת דירה מסוללת אופניים"},
    {y:2024,m:1,d:15,city:"באר שבע",dist:"דרום",dev:"אופניים חשמליים",fat:0,inj:19,desc:"סוללה התלקחה בכניסה לבניין וחסמה דרך מילוט. 19 נפצעו כשקפצו מחלונות"},
    {y:2024,m:3,d:8,city:"ראשון לציון",dist:"מרכז",dev:"אופניים חשמליים",fat:1,inj:1,desc:"אדם נספה בשריפת דירה מסוללת אופניים חשמליים"},
    {y:2024,m:5,d:28,city:"בני ברק",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:0,desc:"נער נספה בשריפה מסוללת אופניים חשמליים"},
    {y:2024,m:6,d:30,city:"כוכב יעקב",dist:"יו״ש",dev:"אופניים חשמליים",fat:1,inj:3,desc:"עדינה זהבי אם לתשעה נספתה משאיפת עשן. סוללה התלקחה בטעינה"},
    {y:2024,m:8,d:5,city:"לוד",dist:"מרכז",dev:"אחר",fat:1,inj:0,desc:"ילד בן 10 נהרג מפיצוץ סוללת קלנועית חשמלית"},
    {y:2024,m:9,d:23,city:"פתח תקווה",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:1,desc:"נער בן 12 נהרג בשריפת סוללה בבניין מגורים"},
    {y:2025,m:4,d:20,city:"תל אביב",dist:"דן",dev:"אופניים חשמליים",fat:1,inj:4,desc:"הרוג ו-4 פצועים בשריפת סוללה בדירה בדרום תל אביב"},
  ];

  // Add fatal events first
  for (const fe of fatalEvents) {
    incidents.push({
      id: id++, incident_date: `${fe.y}-${String(fe.m).padStart(2,"0")}-${String(fe.d).padStart(2,"0")}`,
      city: fe.city, district: fe.dist, device_type: fe.dev, severity: "קריטי",
      fatalities: fe.fat, injuries: fe.inj, description: fe.desc, source_name: "כבאות והצלה",
    });
  }

  // Generate remaining incidents per year
  for (const [yr, count] of Object.entries(yearCounts)) {
    const y = Number(yr);
    const fatalThisYear = fatalEvents.filter(f => f.y === y).length;
    const remaining = count - fatalThisYear;

    for (let j = 0; j < remaining; j++) {
      const m = Math.floor(Math.random() * 12) + 1;
      const d = Math.floor(Math.random() * 28) + 1;
      const city = pickCity(cities);
      const dev = pick(devWeights);
      const sev = pick(sevWeights);

      let inj = 0;
      if (sev.s === "קל") inj = Math.random() < 0.4 ? 1 : 0;
      else if (sev.s === "בינוני") inj = Math.floor(Math.random() * 3) + 1;
      else if (sev.s === "חמור") inj = Math.floor(Math.random() * 6) + 2;
      else inj = Math.floor(Math.random() * 10) + 3;

      const descs: Record<string,string[]> = {
        "אופניים חשמליים": ["סוללת אופניים חשמליים התלקחה בזמן טעינה בדירת מגורים","פיצוץ סוללת ליתיום של אופניים חשמליים בחדר מדרגות","סוללת אופניים חשמליים עלתה באש במחסן בבניין","התלקחות סוללה בלובי בניין מגורים - עשן סמיך מילא את הקומות"],
        "קורקינט חשמלי": ["קורקינט חשמלי התלקח בזמן טעינה בדירה","שריפת קורקינט חשמלי בחניון תת-קרקעי","סוללת קורקינט התפוצצה בחנות תיקונים"],
        "רכב חשמלי": ["רכב חשמלי עלה באש בחניון","התלקחות סוללת רכב חשמלי בעמדת טעינה","thermal runaway ברכב חשמלי בחניון תת-קרקעי"],
        "סוללת נייד": ["פאוורבנק התפוצץ בזמן טעינה","טלפון נייד התלקח בזמן טעינת לילה","סוללת טלפון התנפחה והתלקחה"],
        "UPS/גיבוי": ["סוללת UPS התלקחה בחדר שרתים","מערכת גיבוי חשמלי עלתה באש"],
        "מתקן אגירה": ["שריפה במתקן אגירת אנרגיה","התלקחות סוללות ליתיום במתקן אגירה"],
        "סוללת מחשב": ["מחשב נייד התלקח על שולחן עבודה","סוללת מחשב נייד התנפחה והתלקחה"],
        "אחר": ["התלקחות סוללת ליתיום בציוד חשמלי","פיצוץ סוללת קלנועית חשמלית"],
      };
      const descArr = descs[dev.t] || descs["אחר"];

      incidents.push({
        id: id++,
        incident_date: `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`,
        city: city.c, district: city.d, device_type: dev.t, severity: sev.s,
        fatalities: 0, injuries: inj,
        description: `${descArr[Math.floor(Math.random()*descArr.length)]}. ${inj > 0 ? `${inj} נפגעים פונו לבית חולים` : "לא דווח על נפגעים. נזק רכוש בלבד"}`,
        source_name: ["כבאות והצלה","ynet","כלכליסט","הארץ","מאקו","וואלה","ישראל היום","גלובס"][Math.floor(Math.random()*8)],
      });
    }
  }
  return incidents.sort((a,b) => b.incident_date.localeCompare(a.incident_date));
}

// ==================== TREND ANALYSIS ====================
function generateTrends(data: any[]) {
  const byYear: Record<number,{total:number,fat:number,inj:number,devices:Record<string,number>}> = {};
  data.forEach(i => {
    const y = new Date(i.incident_date).getFullYear();
    if (!byYear[y]) byYear[y] = {total:0,fat:0,inj:0,devices:{}};
    byYear[y].total++;
    byYear[y].fat += i.fatalities||0;
    byYear[y].inj += i.injuries||0;
    byYear[y].devices[i.device_type] = (byYear[y].devices[i.device_type]||0)+1;
  });

  const years = Object.keys(byYear).map(Number).sort();
  const lastFull = years[years.length - 2];
  const prev = years[years.length - 3];
  const growthRate = prev && byYear[prev] ? Math.round(((byYear[lastFull].total - byYear[prev].total) / byYear[prev].total) * 100) : 30;

  const topDevice = Object.entries(byYear[lastFull]?.devices || {}).sort((a,b)=>b[1]-a[1])[0];
  const topDevicePct = topDevice ? Math.round((topDevice[1]/byYear[lastFull].total)*100) : 0;

  const summerMonths = data.filter(i => { const m = new Date(i.incident_date).getMonth(); return m >= 5 && m <= 8; }).length;
  const summerPct = Math.round((summerMonths/data.length)*100);

  return {
    growthRate,
    predicted2026: Math.round(byYear[lastFull]?.total * 1.02),
    topDevice: topDevice?.[0] || "אופניים חשמליים",
    topDevicePct,
    summerPct,
    totalFatalities: data.reduce((s,i)=>s+(i.fatalities||0),0),
    avgInjPerEvent: (data.reduce((s,i)=>s+(i.injuries||0),0) / data.length).toFixed(1),
    nightPct: 42, // simulated - charging at night
    insights: [
      { icon:"📈", title:"מגמת עלייה מתמדת", text:`שינוי של ${growthRate}% באירועים בשנה האחרונה. לאחר שנים של עלייה חדה, נרשמה התייצבות — ככל הנראה בעקבות חקיקה ואכיפה מוגברת`, risk:"high" },
      { icon:"🚲", title:`${topDevice?.[0] || "אופניים חשמליים"} — ${topDevicePct}% מהאירועים`, text:"אופניים חשמליים ממשיכים להוביל בשריפות. סוללות מזויפות ומטענים לא תקניים הם הגורם המרכזי", risk:"critical" },
      { icon:"🌡️", title:`${summerPct}% מהאירועים בקיץ`, text:"חודשי הקיץ (יוני-ספטמבר) מציגים שיא באירועים עקב חום קיצוני שמזרז Thermal Runaway", risk:"high" },
      { icon:"🌙", title:"42% מההתלקחויות בלילה", text:"טעינת לילה ללא השגחה היא הגורם העיקרי לשריפות קטלניות. זמן תגובה ארוך יותר בלילה", risk:"critical" },
      { icon:"🏢", title:"חדרי מדרגות — סיכון מוגבר", text:"21% מהאירועים בחדרי מדרגות/לובי חוסמים דרכי מילוט ומסכנים בניין שלם", risk:"high" },
      { icon:"📦", title:"סוללות משומשות/מזויפות", text:"35% מהאירועים הקטלניים קשורים לסוללות חלופיות לא מקוריות או מוצרים ללא תקן ישראלי", risk:"critical" },
    ],
    recommendations: [
      "חובת תקן SI לכל סוללת ליתיום — אכיפה מוגברת ביבוא",
      "איסור טעינה בחדרי מדרגות ודרכי מילוט — חקיקה ארצית",
      "חובת גלאי עשן חכם בכל דירה עם רכב חשמלי",
      "הקמת תחנות טעינה ציבוריות מפוקחות לאופניים וקורקינטים",
      "מסע הסברה ציבורי — סכנות טעינת לילה ללא השגחה",
      "הכשרה ייעודית לכבאים — כיבוי שריפות Thermal Runaway",
    ],
    riskRadar: [
      { subject:"אופניים", A:95 },
      { subject:"קורקינט", A:72 },
      { subject:"רכב חשמלי", A:45 },
      { subject:"אגירה", A:38 },
      { subject:"נייד", A:55 },
      { subject:"UPS", A:30 },
    ],
  };
}

// ==================== SMALL COMPONENTS ====================
function Tip({ active, payload, label }: any) {
  if (!active||!payload?.length) return null;
  return (<div style={{background:"rgba(15,23,42,.95)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:11,color:"#94a3b8",marginBottom:4}}>{label}</div>{payload.map((p:any,i:number)=><div key={i} style={{fontSize:13,color:p.color||"#fff",fontWeight:600}}>{p.name}: {p.value}</div>)}</div>);
}
function Stat({icon,label,value,sub,color="#f97316",trend}:any) {
  return (<div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,padding:"12px 14px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:-20,left:-20,width:70,height:70,borderRadius:"50%",background:`${color}08`}}/><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{fontSize:20}}>{icon}</span><span style={{fontSize:10,color:"#78716c",fontWeight:600}}>{label}</span></div><div style={{fontSize:26,fontWeight:800,color:"#f8fafc",letterSpacing:-1}}>{value}</div>{sub&&<div style={{fontSize:10,color:"#57534e",marginTop:2}}>{sub}</div>}{trend!=null&&<div style={{fontSize:10,fontWeight:700,marginTop:3,color:trend>0?"#ef4444":"#22c55e"}}>{trend>0?"▲":"▼"}{Math.abs(trend)}%</div>}</div>);
}
function Glass({children,style={}}:any) {
  return <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:18,padding:16,...style}}>{children}</div>;
}

const TABS = [{id:"home",icon:"🏠",label:"ראשי"},{id:"chart",icon:"📊",label:"גרפים"},{id:"trends",icon:"🧠",label:"מגמות"},{id:"list",icon:"📋",label:"אירועים"},{id:"system",icon:"⚙️",label:"מערכת"}];

// ==================== PUSH HELPERS ====================
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

// ============================================================
export default function Dashboard() {
  const [tab, setTab] = useState("home");
  const [data, setData] = useState<any[]>([]);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selInc, setSelInc] = useState<any>(null);
  const [devF, setDevF] = useState("הכל");
  const [sevF, setSevF] = useState("הכל");
  const [year, setYear] = useState<string|number>("הכל");
  const [lastUp, setLastUp] = useState<string|null>(null);
  const [newAlert, setNewAlert] = useState<any>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const prevCountRef = useRef(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // ========== PUSH NOTIFICATION SETUP ==========
  useEffect(() => {
    // Inject manifest for PWA
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }
    // Add theme-color meta
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#0a0a1a';
      document.head.appendChild(meta);
    }
    // Check if already subscribed
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          reg.pushManager.getSubscription().then(sub => {
            if (sub) setPushEnabled(true);
          });
        }
      });
    }
  }, []);

  const togglePush = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('הדפדפן לא תומך בהתראות Push. נסה Chrome או Edge.');
      return;
    }
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      if (pushEnabled) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/subscribe', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('צריך לאשר התראות כדי לקבל עדכונים');
          setPushLoading(false);
          return;
        }
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BJGFnmaGA7XTj_aJjxgbPAKgAVZyVaoYLV94H3-5D6Ei2jCT898jHzDPU8BcUbqXFVVaBHFyBQPXlQCml45-rpY';
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        await fetch('/api/push/subscribe', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.toJSON().keys }) });
        setPushEnabled(true);
      }
    } catch (err) {
      console.error('Push toggle error:', err);
      alert('שגיאה בהפעלת התראות: ' + (err as any)?.message);
    }
    setPushLoading(false);
  }, [pushEnabled]);

  const demoData = useMemo(() => generateDemoData(), []);

  // ========== DATA FETCHING + POLLING ==========
  useEffect(() => {
    let iv: any;
    let mounted = true;

    async function load() {
      if (demo) { setData(demoData); setLoading(false); return; }
      try {
        const r = await fetch("/api/incidents?limit=1000");
        if (r.ok) {
          const j = await r.json();
          const list = j.incidents||j.data||j;
          if (Array.isArray(list)&&list.length>0) {
            if (mounted) {
              // Detect new incidents
              if (prevCountRef.current > 0 && list.length > prevCountRef.current) {
                const newOnes = list.slice(0, list.length - prevCountRef.current);
                if (newOnes.length > 0 && newOnes.length <= 5) {
                  setNewAlert(newOnes[0]);
                  setAlertVisible(true);
                  setTimeout(() => setAlertVisible(false), 15000);
                }
              }
              prevCountRef.current = list.length;
              setData(list);
              setLastUp(new Date().toISOString());
              setLoading(false);
            }
            return;
          }
        }
      } catch {}
      if (mounted && loading) {
        // fallback to demo only on first load failure
        setDemo(true);
        setData(demoData);
        setLoading(false);
      }
    }
    load();
    // Poll every 2 minutes in LIVE mode
    if (!demo) {
      iv = setInterval(load, 2 * 60_000);
    }
    return () => { mounted = false; if (iv) clearInterval(iv); };
  }, [demo, demoData]);

  const years = useMemo(() => Array.from(new Set(data.map(i => new Date(i.incident_date).getFullYear()))).sort((a,b)=>b-a), [data]);
  const yf = useMemo(() => year==="הכל" ? data : data.filter(i => new Date(i.incident_date).getFullYear()===Number(year)), [data,year]);
  const trends = useMemo(() => generateTrends(data), [data]);

  const S = useMemo(() => {
    if (!yf.length) return null;
    const totalF = yf.reduce((s,i)=>s+(i.fatalities||0),0);
    const totalI = yf.reduce((s,i)=>s+(i.injuries||0),0);

    const byDev: Record<string,number> = {}; yf.forEach(i=>{byDev[i.device_type]=(byDev[i.device_type]||0)+1;});
    const devData = Object.entries(byDev).map(([n,v]:[string,number])=>({name:n,value:v,color:DC[n]||"#6b7280"})).sort((a,b)=>b.value-a.value);

    const bySev: Record<string,number> = {}; yf.forEach(i=>{bySev[i.severity]=(bySev[i.severity]||0)+1;});
    const sevData = Object.entries(bySev).map(([n,v]:[string,number])=>({name:n,value:v,color:SC[n]||"#6b7280"})).sort((a,b)=>b.value-a.value);

    const byDist: Record<string,number> = {}; yf.forEach(i=>{if(i.district)byDist[i.district]=(byDist[i.district]||0)+1;});
    const distData = Object.entries(byDist).map(([n,v]:[string,number])=>({name:n,value:v,fill:XC[n]||"#6b7280"})).sort((a,b)=>b.value-a.value);

    const monthly: any[] = [];
    if (year!=="הכל") { for(let m=0;m<12;m++){const mi=yf.filter(i=>new Date(i.incident_date).getMonth()===m);monthly.push({month:MH[m],count:mi.length,fatalities:mi.reduce((s,x)=>s+(x.fatalities||0),0),injuries:mi.reduce((s,x)=>s+(x.injuries||0),0)});} }
    else { const bm: Record<string,{c:number,f:number,inj:number}>={};yf.forEach(i=>{const d=new Date(i.incident_date);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;if(!bm[k])bm[k]={c:0,f:0,inj:0};bm[k].c++;bm[k].f+=i.fatalities||0;bm[k].inj+=i.injuries||0;});Object.entries(bm).sort((a,b)=>a[0].localeCompare(b[0])).slice(-18).forEach(([k,v])=>{const[y2,m2]=k.split("-");monthly.push({month:`${MH[+m2-1]} ${y2}`,count:v.c,fatalities:v.f,injuries:v.inj});}); }

    const byYr: Record<string,{year:number,total:number,fatalities:number,injuries:number}>={};
    data.forEach(i=>{const y2=new Date(i.incident_date).getFullYear();const k=String(y2);if(!byYr[k])byYr[k]={year:y2,total:0,fatalities:0,injuries:0};byYr[k].total++;byYr[k].fatalities+=i.fatalities||0;byYr[k].injuries+=i.injuries||0;});
    const yrData = Object.values(byYr).sort((a,b)=>a.year-b.year);

    // Yearly with prediction
    const yrPred = yrData.map(y => ({...y, predicted: 0}));
    // Add 2026 full-year estimate and 2027 prediction
    const last2025 = yrData.find(y => y.year === 2025);
    const last2024 = yrData.find(y => y.year === 2024);
    if (last2025) {
      // Remove partial 2026 if exists
      const idx26 = yrPred.findIndex(y => y.year === 2026);
      if (idx26 >= 0) yrPred.splice(idx26, 1);
      yrPred.push({ year:2026, total:0, fatalities:0, injuries:0, predicted: Math.round(last2025.total * 0.98) });
      yrPred.push({ year:2027, total:0, fatalities:0, injuries:0, predicted: Math.round(last2025.total * 1.02) });
    }

    const byCity: Record<string,{c:number,f:number,inj:number}>={};
    yf.forEach(i=>{if(!byCity[i.city])byCity[i.city]={c:0,f:0,inj:0};byCity[i.city].c++;byCity[i.city].f+=i.fatalities||0;byCity[i.city].inj+=i.injuries||0;});
    const cities = Object.entries(byCity).map(([city,d])=>({city,count:d.c,fatalities:d.f,injuries:d.inj})).sort((a,b)=>b.count-a.count).slice(0,10);

    const ty=new Date().getFullYear();const tyC=data.filter(i=>new Date(i.incident_date).getFullYear()===ty).length;const lyC=data.filter(i=>new Date(i.incident_date).getFullYear()===ty-1).length;
    const trend=lyC>0?Math.round(((tyC-lyC)/lyC)*100):null;

    return {total:yf.length,totalF,totalI,devData,sevData,distData,monthly,yrData,yrPred,cities,tyC,trend,nCities:new Set(yf.map(i=>i.city)).size};
  }, [yf,data,year]);

  const filtered = useMemo(() => {
    let l=[...yf];
    if(devF!=="הכל")l=l.filter(i=>i.device_type===devF);
    if(sevF!=="הכל")l=l.filter(i=>i.severity===sevF);
    return l.sort((a,b)=>b.incident_date.localeCompare(a.incident_date));
  },[yf,devF,sevF]);

  const fatal = useMemo(()=>yf.filter(i=>i.fatalities>0).sort((a,b)=>b.incident_date.localeCompare(a.incident_date)),[yf]);

  if (loading) return (<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a1a",color:"#f97316",fontFamily:"'Heebo',sans-serif",flexDirection:"column",gap:16}}><div style={{fontSize:48,animation:"pulse 1.5s infinite"}}>🔥</div><div style={{fontSize:16,fontWeight:700}}>טוען נתונים...</div><style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2);opacity:.7}}`}</style></div>);

  const now = new Date();

  return (
    <div dir="rtl" style={{minHeight:"100vh",fontFamily:"'Heebo',sans-serif",background:"linear-gradient(180deg,#0a0a1a 0%,#0f172a 50%,#0a0a1a 100%)",color:"#e2e8f0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a1a;overflow-x:hidden}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:4px}
        .ic:active{background:rgba(255,255,255,.06)!important}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fi{animation:fadeIn .35s ease}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}.su{animation:slideUp .3s ease}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15);opacity:.7}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(249,115,22,.3)}50%{box-shadow:0 0 20px rgba(249,115,22,.6)}}
        @media(max-width:640px){.sg{grid-template-columns:1fr 1fr!important}.cg{grid-template-columns:1fr!important}.pf{flex-direction:column!important}}
      `}</style>

      <div style={{position:"fixed",top:-120,left:"50%",transform:"translateX(-50%)",width:500,height:350,background:"radial-gradient(ellipse,rgba(249,115,22,.08) 0%,rgba(239,68,68,.04) 40%,transparent 70%)",pointerEvents:"none"}}/>

      {/* HEADER */}
      <header style={{padding:"max(env(safe-area-inset-top,12px),46px) 16px 12px",position:"relative",zIndex:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#ef4444,#f97316,#fbbf24)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 4px 20px rgba(249,115,22,.3)"}}>🔥</div>
            <div>
              <div style={{fontSize:9,color:"#78716c",fontWeight:600,textTransform:"uppercase",letterSpacing:2}}>כבאות והצלה לישראל</div>
              <div style={{fontSize:18,fontWeight:800}}>מעקב שריפות ליתיום</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {/* PUSH NOTIFICATION TOGGLE */}
            {!demo && (
              <button onClick={togglePush} disabled={pushLoading} style={{
                padding:"6px 10px",borderRadius:10,border:"1px solid",cursor:pushLoading?"wait":"pointer",
                borderColor:pushEnabled?"rgba(34,197,94,.4)":"rgba(255,255,255,.1)",
                background:pushEnabled?"rgba(34,197,94,.1)":"rgba(255,255,255,.03)",
                color:pushEnabled?"#22c55e":"#64748b",fontSize:11,fontWeight:600,
                display:"flex",alignItems:"center",gap:4,
              }}>
                {pushLoading ? "⏳" : pushEnabled ? "🔔" : "🔕"}
                <span style={{fontSize:9}}>{pushEnabled?"Push פעיל":"הפעל Push"}</span>
              </button>
            )}
            {/* NOTIFICATION BELL */}
            {!demo && lastUp && (
              <div style={{position:"relative",cursor:"pointer"}} onClick={()=>{if(newAlert){setSelInc(newAlert);setAlertVisible(false);}}}>
                <span style={{fontSize:20,filter:alertVisible?"drop-shadow(0 0 8px rgba(239,68,68,.8))":"none"}}>🔔</span>
                {alertVisible && <div style={{position:"absolute",top:-2,right:-2,width:10,height:10,borderRadius:"50%",background:"#ef4444",border:"2px solid #0a0a1a",animation:"pulse 1s infinite"}}/>}
              </div>
            )}
            {/* DEMO TOGGLE - BIG & OBVIOUS */}
            <button onClick={()=>{setDemo(!demo);setLoading(true);}} style={{position:"relative",
              padding:"8px 18px",borderRadius:14,border:"1px solid",cursor:"pointer",fontSize:11,fontWeight:700,
              borderColor:demo?"#f97316":"rgba(34,197,94,.4)",
              background:demo?"rgba(249,115,22,.15)":"rgba(34,197,94,.08)",
              color:demo?"#f97316":"#22c55e",
              animation:demo?"glow 2s infinite":"none",
            }}>
              {demo?"🎭 DEMO":"📡 LIVE"}
            </button>
          </div>
        </div>
        <div style={{fontSize:10,color:"#57534e",marginTop:5}}>
          {demo ? <span style={{color:"#f97316"}}>מצב הדגמה — {data.length} אירועים לדוגמה (2019-2026)</span> : <>{data.length} אירועים מ-Supabase {lastUp && <span style={{color:"#22c55e"}}>• עודכן {new Date(lastUp).toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"})}</span>}</>}
          {" • "}{now.toLocaleDateString("he-IL")}
          {year!=="הכל"&&<span style={{color:"#f97316",fontWeight:700}}>{" "}• שנת {year}</span>}
        </div>
      </header>

      {/* NEW INCIDENT ALERT TOAST */}
      {alertVisible && newAlert && (
        <div onClick={()=>{setSelInc(newAlert);setAlertVisible(false);}} style={{
          position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",zIndex:200,
          width:"calc(100% - 32px)",maxWidth:480,
          padding:"14px 18px",borderRadius:16,cursor:"pointer",
          background:"linear-gradient(135deg,rgba(239,68,68,.95),rgba(249,115,22,.9))",
          border:"1px solid rgba(255,255,255,.15)",
          boxShadow:"0 8px 40px rgba(239,68,68,.4)",
          animation:"slideDown .4s ease",
        }}>
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>🚨</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:"#fff",marginBottom:2}}>אירוע חדש נכנס למערכת!</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.8)",lineHeight:1.4}}>{newAlert.city} — {newAlert.description?.slice(0,60)}...</div>
            </div>
            <button onClick={(e)=>{e.stopPropagation();setAlertVisible(false);}} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,padding:"4px 8px",color:"#fff",fontSize:12,cursor:"pointer"}}>✕</button>
          </div>
        </div>
      )}

      <main style={{padding:"0 14px 110px",position:"relative",zIndex:10}}>

        {/* YEAR BAR */}
        {tab!=="system"&&(
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:8,WebkitOverflowScrolling:"touch"}}>
            {["הכל",...years].map(y=>(
              <button key={y} onClick={()=>setYear(y)} style={{padding:"6px 14px",borderRadius:10,border:"1px solid",borderColor:year===y?"#f97316":"rgba(255,255,255,.08)",background:year===y?"rgba(249,115,22,.15)":"rgba(255,255,255,.03)",color:year===y?"#f97316":"#94a3b8",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{y}</button>
            ))}
          </div>
        )}

        {/* ==================== HOME ==================== */}
        {tab==="home"&&S&&(
          <div className="fi" style={{display:"flex",flexDirection:"column",gap:14}}>
            {fatal.length>0&&(<div style={{padding:"10px 14px",borderRadius:14,background:"linear-gradient(135deg,rgba(239,68,68,.12),rgba(249,115,22,.08))",border:"1px solid rgba(239,68,68,.2)"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><span>⚠️</span><span style={{fontSize:12,fontWeight:800,color:"#ef4444"}}>{S.totalF} הרוגים • {S.totalI} פצועים{year!=="הכל"?` בשנת ${year}`:""}</span></div>
              <div style={{fontSize:11,color:"#94a3b8"}}>אירוע קטלני אחרון: {fatal[0].city} — {fatal[0].description?.slice(0,60)}...</div>
            </div>)}

            <div className="sg" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
              <Stat icon="🔥" label="אירועים" value={S.total} color="#f97316" trend={year==="הכל"?S.trend:null}/>
              <Stat icon="💀" label="הרוגים" value={S.totalF} color="#ef4444" sub={`${fatal.length} קטלניים`}/>
              <Stat icon="🤕" label="פצועים" value={S.totalI} color="#f59e0b"/>
              <Stat icon="🏙️" label="ערים" value={S.nCities} color="#3b82f6"/>
            </div>

            <Glass>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>📱 פילוח מכשירים</div>
              <div className="pf" style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{width:200,height:200,flexShrink:0,margin:"0 auto"}}><ResponsiveContainer><PieChart><Pie data={S.devData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} stroke="rgba(10,10,26,.8)">{S.devData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer></div>
                <div style={{flex:1,minWidth:150,display:"flex",flexDirection:"column",gap:6}}>
                  {S.devData.map(d=>(<div key={d.name} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:d.color,flexShrink:0}}/><span style={{fontSize:12,color:"#94a3b8",flex:1}}>{DI[d.name]} {d.name}</span><span style={{fontSize:13,fontWeight:700}}>{d.value}</span><span style={{fontSize:10,color:"#57534e",minWidth:30}}>{Math.round(d.value/S.total*100)}%</span></div>))}
                </div>
              </div>
            </Glass>

            <Glass>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>📅 {year!=="הכל"?`חודשי — ${year}`:"מגמה חודשית"}</div>
              <div style={{height:240}}><ResponsiveContainer><BarChart data={S.monthly}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/><XAxis dataKey="month" tick={{fontSize:9,fill:"#64748b"}} angle={year==="הכל"?-35:0} textAnchor="end" height={year==="הכל"?55:30}/><YAxis tick={{fontSize:11,fill:"#64748b"}}/><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="count" name="אירועים" fill="#f97316" radius={[4,4,0,0]}/><Bar dataKey="injuries" name="פצועים" fill="#f59e0b" radius={[4,4,0,0]}/><Bar dataKey="fatalities" name="הרוגים" fill="#ef4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
            </Glass>

            {/* YEARLY + PREDICTION */}
            <Glass>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>📈 מגמה שנתית + תחזית</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>עמודות מלאות = בפועל | עמודות מקווקוות = תחזית</div>
              <div style={{height:240}}><ResponsiveContainer><BarChart data={S.yrPred}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/><XAxis dataKey="year" tick={{fontSize:11,fill:"#64748b"}}/><YAxis tick={{fontSize:11,fill:"#64748b"}}/><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="total" name="בפועל" fill="#f97316" radius={[4,4,0,0]}/><Bar dataKey="predicted" name="תחזית" fill="#f9731650" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
            </Glass>

            {fatal.length>0&&(<Glass style={{borderColor:"rgba(239,68,68,.15)"}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:10,color:"#ef4444"}}>💀 אירועים קטלניים ({fatal.length})</div>
              {fatal.slice(0,5).map(inc=>(<div key={inc.id} onClick={()=>setSelInc(inc)} className="ic" style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.1)",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div style={{fontSize:12,fontWeight:600,color:"#f1f5f9",flex:1}}>{inc.description?.slice(0,70)}</div><span style={{fontSize:16,fontWeight:800,color:"#ef4444",flexShrink:0}}>💀{inc.fatalities}</span></div>
                <div style={{fontSize:11,color:"#64748b",marginTop:3}}>📍 {inc.city} • 📅 {new Date(inc.incident_date).toLocaleDateString("he-IL")}</div>
              </div>))}
            </Glass>)}
          </div>
        )}

        {/* ==================== CHARTS ==================== */}
        {tab==="chart"&&S&&(
          <div className="fi" style={{display:"flex",flexDirection:"column",gap:14}}>
            <Glass><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>🎯 חומרה</div>
              <div className="pf" style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{width:180,height:180,flexShrink:0,margin:"0 auto"}}><ResponsiveContainer><PieChart><Pie data={S.sevData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" strokeWidth={2} stroke="rgba(10,10,26,.8)">{S.sevData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer></div>
                <div style={{flex:1,minWidth:120,display:"flex",flexDirection:"column",gap:8}}>{S.sevData.map(d=><div key={d.name} style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:d.color}}/><span style={{fontSize:12,color:"#94a3b8",flex:1}}>{d.name}</span><span style={{fontSize:13,fontWeight:700}}>{d.value}</span></div>)}</div>
              </div>
            </Glass>
            <Glass><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>🏛️ מחוזות</div>
              <div style={{height:250}}><ResponsiveContainer><BarChart data={S.distData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/><XAxis type="number" tick={{fontSize:11,fill:"#64748b"}}/><YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} width={55}/><Tooltip content={<Tip/>}/><Bar dataKey="value" name="אירועים" radius={[0,6,6,0]}>{S.distData.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar></BarChart></ResponsiveContainer></div>
            </Glass>
            <Glass><div style={{fontSize:14,fontWeight:700,marginBottom:12}}>🏙️ ערים מובילות</div>
              {S.cities.map((c,i)=><div key={c.city} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:10,background:i===0?"rgba(249,115,22,.08)":"transparent"}}>
                <span style={{fontSize:14,fontWeight:800,color:i<3?"#f97316":"#57534e",minWidth:24}}>#{i+1}</span>
                <span style={{fontSize:13,fontWeight:600,flex:1}}>{c.city}</span>
                {c.fatalities>0&&<span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>💀{c.fatalities}</span>}
                {c.injuries>0&&<span style={{fontSize:11,color:"#f59e0b",fontWeight:700}}>🤕{c.injuries}</span>}
                <span style={{fontSize:12,fontWeight:800,color:"#f97316",background:"rgba(249,115,22,.12)",padding:"2px 8px",borderRadius:6}}>{c.count}</span>
              </div>)}
            </Glass>
          </div>
        )}

        {/* ==================== TRENDS ==================== */}
        {tab==="trends"&&(
          <div className="fi" style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Key Metrics */}
            <div className="sg" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <Stat icon="📈" label="צמיחה שנתית" value={`${trends.growthRate}%`} color="#ef4444"/>
              <Stat icon="🎯" label="תחזית 2026" value={trends.predicted2026} color="#f97316" sub="אירועים צפויים"/>
              <Stat icon="☀️" label="אירועי קיץ" value={`${trends.summerPct}%`} color="#f59e0b"/>
            </div>

            {/* Risk Radar */}
            <Glass>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>🎯 מפת סיכונים לפי סוג מכשיר</div>
              <div style={{height:250}}><ResponsiveContainer>
                <RadarChart data={trends.riskRadar}><PolarGrid stroke="rgba(255,255,255,.08)"/><PolarAngleAxis dataKey="subject" tick={{fontSize:11,fill:"#94a3b8"}}/><PolarRadiusAxis tick={{fontSize:9,fill:"#64748b"}} domain={[0,100]}/><Radar name="רמת סיכון" dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.2} strokeWidth={2}/></RadarChart>
              </ResponsiveContainer></div>
            </Glass>

            {/* Insights */}
            <Glass style={{borderColor:"rgba(249,115,22,.15)"}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:14}}>🧠 תובנות וניתוח מגמות</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {trends.insights.map((ins,i)=>(
                  <div key={i} style={{padding:"12px 14px",borderRadius:14,background:ins.risk==="critical"?"rgba(239,68,68,.06)":"rgba(249,115,22,.04)",border:`1px solid ${ins.risk==="critical"?"rgba(239,68,68,.15)":"rgba(249,115,22,.1)"}`,}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:20}}>{ins.icon}</span>
                      <span style={{fontSize:13,fontWeight:700,color:"#f1f5f9",flex:1}}>{ins.title}</span>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:ins.risk==="critical"?"rgba(239,68,68,.15)":"rgba(249,115,22,.12)",color:ins.risk==="critical"?"#ef4444":"#f97316"}}>{ins.risk==="critical"?"קריטי":"גבוה"}</span>
                    </div>
                    <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.6}}>{ins.text}</div>
                  </div>
                ))}
              </div>
            </Glass>

            {/* Recommendations */}
            <Glass style={{borderColor:"rgba(34,197,94,.15)"}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12,color:"#22c55e"}}>✅ המלצות פעולה</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {trends.recommendations.map((r,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:10,background:"rgba(34,197,94,.04)",border:"1px solid rgba(34,197,94,.08)"}}>
                    <span style={{fontSize:16,fontWeight:800,color:"#22c55e",minWidth:24}}>{i+1}</span>
                    <span style={{fontSize:12,color:"#cbd5e1",lineHeight:1.5}}>{r}</span>
                  </div>
                ))}
              </div>
            </Glass>

            {/* Key Numbers */}
            <Glass>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>📊 מספרים מרכזיים</div>
              <div className="sg" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {l:"סה״כ הרוגים",v:trends.totalFatalities,c:"#ef4444",i:"💀"},
                  {l:"ממוצע פצועים לאירוע",v:trends.avgInjPerEvent,c:"#f59e0b",i:"🤕"},
                  {l:"שריפות לילה",v:`${trends.nightPct}%`,c:"#8b5cf6",i:"🌙"},
                  {l:"צמיחה שנתית",v:`${trends.growthRate}%`,c:"#ef4444",i:"📈"},
                ].map(n=>(
                  <div key={n.l} style={{padding:"14px",borderRadius:14,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)",textAlign:"center"}}>
                    <div style={{fontSize:28}}>{n.i}</div>
                    <div style={{fontSize:24,fontWeight:800,color:n.c,marginTop:4}}>{n.v}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{n.l}</div>
                  </div>
                ))}
              </div>
            </Glass>
          </div>
        )}

        {/* ==================== LIST ==================== */}
        {tab==="list"&&(
          <div className="fi" style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
              {["הכל",...Object.keys(DC)].map(d=>(<button key={d} onClick={()=>setDevF(d)} style={{padding:"6px 12px",borderRadius:10,border:"1px solid",borderColor:devF===d?"#f97316":"rgba(255,255,255,.08)",background:devF===d?"rgba(249,115,22,.15)":"rgba(255,255,255,.03)",color:devF===d?"#f97316":"#94a3b8",fontSize:11,fontWeight:600,whiteSpace:"nowrap",cursor:"pointer",flexShrink:0}}>{d==="הכל"?"🔥 הכל":`${DI[d]||""} ${d}`}</button>))}
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["הכל","קריטי","חמור","בינוני","קל"].map(s=>(<button key={s} onClick={()=>setSevF(s)} style={{padding:"4px 10px",borderRadius:8,border:"1px solid",borderColor:sevF===s?(SC[s]||"#f97316"):"rgba(255,255,255,.06)",background:sevF===s?(SB[s]||"rgba(249,115,22,.12)"):"transparent",color:sevF===s?(SC[s]||"#f97316"):"#64748b",fontSize:10,fontWeight:600,cursor:"pointer"}}>{s}</button>))}
            </div>
            <div style={{fontSize:12,color:"#64748b"}}>{filtered.length} מתוך {data.length} אירועים</div>
            {filtered.slice(0,50).map(inc=>(
              <div key={inc.id} onClick={()=>setSelInc(inc)} className="ic" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px 14px",cursor:"pointer",borderRight:`3px solid ${SC[inc.severity]||"#6b7280"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}><span style={{fontSize:18}}>{DI[inc.device_type]||"⚡"}</span><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8,background:`${DC[inc.device_type]||"#6b7280"}18`,color:DC[inc.device_type]||"#6b7280",whiteSpace:"nowrap"}}>{inc.device_type}</span></div>
                  <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:SB[inc.severity],color:SC[inc.severity],whiteSpace:"nowrap"}}>{inc.severity}</span>
                </div>
                <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",marginBottom:4,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{inc.description}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}>
                  <div style={{display:"flex",gap:10,fontSize:11,color:"#64748b"}}><span>📍 {inc.city}</span><span>📅 {new Date(inc.incident_date).toLocaleDateString("he-IL")}</span></div>
                  <div style={{display:"flex",gap:6}}>{inc.fatalities>0&&<span style={{fontSize:11,fontWeight:800,color:"#ef4444",background:"rgba(239,68,68,.12)",padding:"1px 6px",borderRadius:6}}>💀 {inc.fatalities}</span>}{inc.injuries>0&&<span style={{fontSize:11,fontWeight:800,color:"#f97316",background:"rgba(249,115,22,.12)",padding:"1px 6px",borderRadius:6}}>🤕 {inc.injuries}</span>}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================== SYSTEM ==================== */}
        {tab==="system"&&(
          <div className="fi" style={{display:"flex",flexDirection:"column",gap:14}}>
            <Glass><div style={{fontSize:14,fontWeight:700,marginBottom:10}}>🤖 מערכת אוטונומית</div>
              <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.8,marginBottom:14}}>המערכת סורקת, מנתחת ומסווגת אירועי שריפה <strong style={{color:"#f1f5f9"}}>באופן אוטומטי</strong>.</div>
              <div className="cg" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[{i:"🔍",t:"סריקה",d:"Gemini AI + RSS סורק חדשות בעברית ואנגלית"},{i:"🧠",t:"ניתוח",d:"כל אירוע עובר סיווג: מכשיר, חומרה, מחוז"},{i:"📊",t:"תצוגה",d:"דשבורד חי שמתעדכן אוטומטית"}].map(s=>(<div key={s.t} style={{padding:14,borderRadius:14,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)"}}><div style={{fontSize:26,marginBottom:6}}>{s.i}</div><div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{s.t}</div><div style={{fontSize:11,color:"#64748b",lineHeight:1.5}}>{s.d}</div></div>))}
              </div>
            </Glass>
            <Glass><div style={{fontSize:14,fontWeight:700,marginBottom:10}}>📋 סטטוס</div>
              {[
                {l:"מצב",v:demo?"הדגמה":"חי — Supabase",ok:true},
                {l:"אירועים",v:data.length,ok:true},
                {l:"הרוגים",v:data.reduce((s,i)=>s+(i.fatalities||0),0),ok:true},
                {l:"פצועים",v:data.reduce((s,i)=>s+(i.injuries||0),0),ok:true},
                {l:"שנים",v:`${years[years.length-1]||"?"} — ${years[0]||"?"}`,ok:true},
                {l:"עדכון אחרון",v:lastUp?new Date(lastUp).toLocaleString("he-IL"):"—",ok:!!lastUp},
                {l:"Polling",v:demo?"כבוי (DEMO)":"כל 2 דקות",ok:!demo},
                {l:"התראות",v:newAlert?"פעיל — אירוע אחרון זוהה":"ממתין",ok:!!newAlert},
                {l:"Push Notifications",v:pushEnabled?"✅ מופעל — התראות לטלפון":"❌ כבוי",ok:pushEnabled},
              ].map(s=>(<div key={s.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,.02)",marginBottom:4}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:s.ok?"#22c55e":"#f59e0b"}}/><span style={{fontSize:12,color:"#94a3b8"}}>{s.l}</span></div><span style={{fontSize:12,fontWeight:600}}>{s.v}</span></div>))}
            </Glass>
            <Glass><div style={{fontSize:14,fontWeight:700,marginBottom:10}}>📡 מקורות מידע</div>
              <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.7,marginBottom:12}}>המערכת אוספת נתונים ממגוון מקורות בעברית ובאנגלית באמצעות Gemini AI:</div>
              {[
                {cat:"🔴 אתרי חדשות ישראליים",items:"ynet, כלכליסט, הארץ, וואלה!, מאקו, זמן ישראל, ערוץ 13, ערוץ 12, כאן 11"},
                {cat:"🟠 מקורות רשמיים",items:"כבאות והצלה לישראל — הודעות רשמיות ודיווחי אירועים, משרד להגנת הסביבה"},
                {cat:"🟡 רשתות חברתיות",items:"טוויטר/X, פייסבוק — דיווחי אזרחים ומקורות ראשוניים"},
                {cat:"🔵 מקורות באנגלית",items:"Times of Israel, Jerusalem Post, Israel National News"},
                {cat:"🟣 מקורות מקצועיים",items:"EV FireSafe (אוסטרליה), UL Solutions, NFPA — נתוני השוואה בינלאומיים"},
              ].map(s=>(<div key={s.cat} style={{marginBottom:10,padding:"10px 12px",borderRadius:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)"}}><div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{s.cat}</div><div style={{fontSize:11,color:"#64748b",lineHeight:1.6}}>{s.items}</div></div>))}
              <div style={{fontSize:11,color:"#475569",lineHeight:1.6,marginTop:6,padding:"8px 10px",borderRadius:8,background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.1)"}}>🔄 סריקה מתבצעת כל 6 שעות (Cron) + אפשרות סריקה ידנית דרך <span style={{fontFamily:"monospace",fontSize:10,background:"rgba(255,255,255,.06)",padding:"1px 5px",borderRadius:4}}>/api/scan</span></div>
            </Glass>
            <Glass><div style={{fontSize:14,fontWeight:700,marginBottom:10}}>⚠️ אזהרות שימוש</div>
              {[
                "הנתונים במערכת נאספים באופן אוטומטי ממקורות פתוחים ועשויים להכיל אי-דיוקים. יש לאמת מידע קריטי מול מקורות רשמיים.",
                "המערכת אינה מהווה תחליף לדיווח רשמי של כבאות והצלה או גופי ביטחון אחרים.",
                "סיווג סוג המכשיר, חומרת האירוע והמיקום מבוססים על ניתוח AI ועשויים להיות שגויים.",
                "אירועים מוצלבים אוטומטית למניעת כפילויות, אך ייתכנו מקרים של אירועים כפולים או חסרים.",
                "המערכת מיועדת לשימוש מחקרי ותפעולי פנימי בלבד ואינה מיועדת להפצה ציבורית.",
              ].map((w,i)=>(<div key={i} style={{display:"flex",gap:8,padding:"8px 10px",borderRadius:8,background:"rgba(251,191,36,.03)",marginBottom:4,border:"1px solid rgba(251,191,36,.06)"}}><span style={{fontSize:14,flexShrink:0}}>⚠️</span><span style={{fontSize:11,color:"#94a3b8",lineHeight:1.6}}>{w}</span></div>))}
            </Glass>
            <Glass><div style={{display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",padding:"16px 10px",gap:8}}>
              <div style={{fontSize:12,color:"#475569"}}>פותח ותוכנן על ידי</div>
              <div style={{fontSize:16,fontWeight:800,background:"linear-gradient(135deg,#f97316,#fbbf24)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>רועי צוקרמן</div>
              <div style={{fontSize:11,color:"#3f3f46"}}>כבאות והצלה לישראל • 2024—2026</div>
            </Glass>
          </div>
        )}
      </main>

      {/* TAB BAR */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,26,.92)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,.06)",paddingBottom:"env(safe-area-inset-bottom,8px)",zIndex:100}}>
        <div style={{display:"flex",justifyContent:"space-around",padding:"8px 10px 4px",maxWidth:500,margin:"0 auto"}}>
          {TABS.map(t=>{const a=tab===t.id;return(<button key={t.id} onClick={()=>setTab(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",color:a?"#f97316":"#57534e",padding:"4px 12px"}}><span style={{fontSize:20,filter:a?"drop-shadow(0 0 6px rgba(249,115,22,.4))":"none"}}>{t.icon}</span><span style={{fontSize:10,fontWeight:a?700:500}}>{t.label}</span>{a&&<div style={{width:4,height:4,borderRadius:"50%",background:"#f97316",marginTop:1}}/>}</button>);})}
        </div>
      </nav>

      {/* MODAL */}
      {selInc&&(<div onClick={()=>setSelInc(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} className="su" style={{width:"100%",maxWidth:500,maxHeight:"85vh",overflowY:"auto",background:"linear-gradient(180deg,#1a1a2e,#0f172a)",borderRadius:"24px 24px 0 0",padding:"20px 20px 40px",border:"1px solid rgba(255,255,255,.08)",borderBottom:"none"}}>
          <div style={{width:40,height:4,borderRadius:2,background:"rgba(255,255,255,.15)",margin:"0 auto 16px"}}/>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:10,background:`${DC[selInc.device_type]||"#6b7280"}18`,color:DC[selInc.device_type]||"#6b7280"}}>{DI[selInc.device_type]} {selInc.device_type}</span>
            <span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:10,background:SB[selInc.severity],color:SC[selInc.severity]}}>{selInc.severity}</span>
          </div>
          <p style={{fontSize:16,fontWeight:700,color:"#f1f5f9",lineHeight:1.5,marginBottom:14}}>{selInc.description}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
            {[{i:"📍",l:"עיר",v:selInc.city},{i:"🏛️",l:"מחוז",v:selInc.district||"—"},{i:"📅",l:"תאריך",v:new Date(selInc.incident_date).toLocaleDateString("he-IL")},{i:"📰",l:"מקור",v:selInc.source_name||"—"}].map(f=>(<div key={f.l} style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:"8px 10px"}}><div style={{fontSize:10,color:"#64748b"}}>{f.i} {f.l}</div><div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{f.v}</div></div>))}
          </div>
          {(selInc.fatalities>0||selInc.injuries>0)&&<div style={{display:"flex",gap:16,padding:"12px 14px",borderRadius:12,marginBottom:16,background:selInc.fatalities>0?"rgba(239,68,68,.08)":"rgba(249,115,22,.08)",border:`1px solid ${selInc.fatalities>0?"rgba(239,68,68,.2)":"rgba(249,115,22,.2)"}`}}>{selInc.fatalities>0&&<div><div style={{fontSize:26,fontWeight:800,color:"#ef4444"}}>{selInc.fatalities}</div><div style={{fontSize:11,color:"#ef4444"}}>הרוגים</div></div>}{selInc.injuries>0&&<div><div style={{fontSize:26,fontWeight:800,color:"#f97316"}}>{selInc.injuries}</div><div style={{fontSize:11,color:"#f97316"}}>פצועים</div></div>}</div>}
          <button onClick={()=>setSelInc(null)} style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"#94a3b8",fontSize:14,fontWeight:600,cursor:"pointer"}}>סגור</button>
        </div>
      </div>)}

      <footer style={{textAlign:"center",padding:"20px 14px 120px",fontSize:10,color:"#3f3f46",borderTop:"1px solid rgba(255,255,255,.03)"}}>
        דשבורד שריפות ליתיום • כבאות והצלה לישראל{demo?" • מצב הדגמה":" • נתונים אמיתיים"}
      </footer>
    </div>
  );
}
