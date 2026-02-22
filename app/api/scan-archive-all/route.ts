// app/api/scan-archive-all/route.ts
// Auto-runner: Gemini knowledge scan for all months
// Usage: /api/scan-archive-all
//        /api/scan-archive-all?from=2023&to=2025

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromYear = parseInt(url.searchParams.get("from") || "2023");
  const toYear = parseInt(url.searchParams.get("to") || "2025");
  const toMonth = parseInt(url.searchParams.get("tomonth") || "2");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>סורק ארכיון — Gemini</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
    h1 { color: #ff6b35; margin-bottom: 8px; font-size: 1.5em; }
    .subtitle { color: #888; margin-bottom: 20px; font-size: 0.9em; }
    .controls { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    button { padding: 10px 24px; border-radius: 10px; border: none; font-size: 1em; cursor: pointer; font-weight: 600; }
    #startBtn { background: #ff6b35; color: white; }
    #startBtn:disabled { background: #555; }
    #stopBtn { background: #333; color: #ff4444; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .stat { background: #1a1a1a; border-radius: 10px; padding: 12px; text-align: center; }
    .stat-num { font-size: 1.8em; font-weight: 700; color: #ff6b35; }
    .stat-label { font-size: 0.75em; color: #888; margin-top: 4px; }
    .progress { background: #1a1a1a; border-radius: 10px; padding: 4px; margin-bottom: 20px; }
    .progress-bar { height: 8px; background: linear-gradient(90deg, #ff6b35, #ff8f65); border-radius: 6px; transition: width 0.3s; }
    .current { background: #1a1a1a; border-radius: 10px; padding: 12px; margin-bottom: 16px; font-size: 0.95em; }
    .current .label { color: #888; font-size: 0.8em; }
    .log { background: #111; border-radius: 10px; padding: 12px; max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 0.8em; line-height: 1.8; }
    .log-ok { color: #4caf50; }
    .log-found { color: #ff9800; }
    .log-err { color: #f44336; }
    .log-info { color: #64b5f6; }
  </style>
</head>
<body>
  <h1>🔋 סורק ארכיון — Gemini</h1>
  <p class="subtitle">סריקת ידע Gemini | ${fromYear}—${toYear}</p>

  <div class="controls">
    <button id="startBtn" onclick="startScan()">&#9654; התחל סריקה</button>
    <button id="stopBtn" onclick="stopScan()">&#9632; עצור</button>
  </div>

  <div class="progress"><div class="progress-bar" id="progressBar" style="width:0%"></div></div>

  <div class="stats">
    <div class="stat"><div class="stat-num" id="totalFound">0</div><div class="stat-label">אירועים זוהו</div></div>
    <div class="stat"><div class="stat-num" id="totalInserted">0</div><div class="stat-label">נוספו ל-DB</div></div>
    <div class="stat"><div class="stat-num" id="totalDups">0</div><div class="stat-label">כפילויות</div></div>
    <div class="stat"><div class="stat-num" id="totalErrors">0</div><div class="stat-label">שגיאות</div></div>
  </div>

  <div class="current">
    <span class="label">סטטוס: </span>
    <span id="status">ממתין להתחלה...</span>
  </div>

  <div class="log" id="log"></div>

  <script>
    let stopped = false;
    let stats = { found: 0, inserted: 0, dups: 0, errors: 0 };

    // Build task list — just Gemini for each month
    const tasks = [];
    for (let year = ${fromYear}; year <= ${toYear}; year++) {
      const maxMonth = (year === ${toYear}) ? ${toMonth} : 12;
      for (let month = 1; month <= maxMonth; month++) {
        tasks.push({
          label: year + "/" + String(month).padStart(2, "0"),
          url: "/api/scan-archive?year=" + year + "&month=" + month
        });
      }
    }

    function log(msg, cls) {
      var el = document.getElementById("log");
      var time = new Date().toLocaleTimeString("he-IL");
      el.innerHTML += '<div class="' + (cls || '') + '">[' + time + '] ' + msg + '</div>';
      el.scrollTop = el.scrollHeight;
    }

    function updateStats() {
      document.getElementById("totalFound").textContent = stats.found;
      document.getElementById("totalInserted").textContent = stats.inserted;
      document.getElementById("totalDups").textContent = stats.dups;
      document.getElementById("totalErrors").textContent = stats.errors;
    }

    async function runTask(task, index) {
      document.getElementById("status").textContent = task.label + " (" + (index + 1) + "/" + tasks.length + ")";
      document.getElementById("progressBar").style.width = ((index + 1) / tasks.length * 100) + "%";

      try {
        var res = await fetch(task.url);
        var data = await res.json();

        if (data.status === "ok") {
          var found = data.found || 0;
          var inserted = data.inserted || 0;
          var dups = data.duplicates || 0;

          stats.found += found;
          stats.inserted += inserted;
          stats.dups += dups;
          updateStats();

          if (inserted > 0) {
            log(task.label + " — " + inserted + " נוספו! (" + found + " אירועים, " + dups + " כפילויות)", "log-ok");
          } else if (found > 0) {
            log(task.label + " — " + found + " אירועים (" + dups + " כפילויות)", "log-found");
          } else {
            log(task.label + " — 0 אירועים", "log-info");
          }
        } else {
          stats.errors++;
          updateStats();
          log(task.label + " — שגיאה: " + (data.message || "unknown"), "log-err");
        }
      } catch (e) {
        stats.errors++;
        updateStats();
        log(task.label + " — שגיאה: " + e.message, "log-err");
      }
    }

    async function startScan() {
      stopped = false;
      document.getElementById("startBtn").disabled = true;
      stats = { found: 0, inserted: 0, dups: 0, errors: 0 };
      updateStats();
      document.getElementById("log").innerHTML = "";
      log("מתחיל סריקה — " + tasks.length + " חודשים", "log-info");

      for (var i = 0; i < tasks.length; i++) {
        if (stopped) { log("נעצר", "log-err"); break; }
        await runTask(tasks[i], i);
        // 5 second delay between months (Gemini 15 RPM = 1 per 4 sec)
        if (!stopped && i < tasks.length - 1) await new Promise(function(r) { setTimeout(r, 5000); });
      }

      document.getElementById("status").textContent = stopped ? "נעצר" : "הסתיים!";
      document.getElementById("startBtn").disabled = false;
      log("סיכום: " + stats.found + " אירועים, " + stats.inserted + " נוספו, " + stats.dups + " כפילויות, " + stats.errors + " שגיאות", "log-ok");
    }

    function stopScan() { stopped = true; }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
