const STORAGE_KEY = "night-brightness-map-sessions";
const levelLabels = {
  1: "とても暗い",
  2: "暗い",
  3: "普通",
  4: "明るい",
  5: "とても明るい",
};
const levelColors = {
  1: "#7c3aed",
  2: "#2563eb",
  3: "#16a34a",
  4: "#facc15",
  5: "#f97316",
};

const app = document.getElementById("app");
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const state = {
  view: "home",
  sessions: loadSessions(),
  activeSession: null,
  recording: false,
  stream: null,
  watchId: null,
  sampleTimer: 0,
  startTime: 0,
  elapsed: 0,
  intervalMs: 1000,
  latestPosition: null,
  latestBrightness: null,
  latestLevel: null,
  latestLightSensor: "",
  sensor: null,
  message: "",
  selectedSessionId: "all",
  wakeLock: null,
};

let mapInstance = null;

render();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.recording) {
    requestWakeLock();
  }
});

window.addEventListener("pagehide", () => {
  if (state.recording) {
    stopRecording();
  }
});

function isSecureAppContext() {
  return window.isSecureContext || ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function startReadiness() {
  const checks = [
    {
      label: "HTTPS",
      ok: isSecureAppContext(),
      note: "iPhoneのカメラと位置情報にはHTTPS配信が必要です。",
    },
    {
      label: "カメラ",
      ok: Boolean(navigator.mediaDevices?.getUserMedia),
      note: "Safariで開いてください。",
    },
    {
      label: "位置情報",
      ok: Boolean(navigator.geolocation),
      note: "Safariの位置情報利用を許可してください。",
    },
  ];
  return checks;
}

function readinessMessage() {
  if (isSecureAppContext()) return "";
  return "iPhoneで記録するにはHTTPSのURLで開いてください。GitHub Pagesで公開したURLから使えます。";
}

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions));
}

function setMessage(message) {
  state.message = message;
  render();
}

function fmtDate(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function classifyBrightness(brightness) {
  if (brightness <= 40) return 1;
  if (brightness <= 80) return 2;
  if (brightness <= 120) return 3;
  if (brightness <= 170) return 4;
  return 5;
}

function averageBrightness(video) {
  if (!video.videoWidth || !video.videoHeight) return null;

  const width = 96;
  const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
  }
  return Math.round(sum / (pixels.length / 4));
}

async function startRecording() {
  if (state.recording) return;

  if (!isSecureAppContext()) {
    setMessage("iPhoneでカメラと位置情報を使うにはHTTPS配信が必要です。GitHub PagesなどのHTTPS URLで開いてください。");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage("このブラウザではカメラを利用できません。iPhoneではSafariの最新バージョンで開いてください。");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    state.stream = stream;
    state.activeSession = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      endedAt: "",
      points: [],
    };
    state.recording = true;
    state.startTime = Date.now();
    state.elapsed = 0;
    state.latestBrightness = null;
    state.latestLevel = null;
    state.latestPosition = null;
    state.message = "";
    state.view = "record";
    render();

    const video = document.getElementById("cameraPreview");
    if (video) {
      video.srcObject = stream;
      await video.play();
    }

    startGeolocation();
    startLightSensor();
    requestWakeLock();
    state.sampleTimer = window.setInterval(samplePoint, state.intervalMs);
    samplePoint();
  } catch (error) {
    console.error(error);
    setMessage(cameraErrorMessage(error));
  }
}

function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "カメラの利用が許可されていません。Safariのアドレスバー左の設定からカメラを許可してください。";
  }
  if (error?.name === "NotFoundError") {
    return "利用できるカメラが見つかりませんでした。";
  }
  if (error?.name === "NotReadableError") {
    return "カメラを開始できませんでした。他のアプリでカメラを使っていないか確認してください。";
  }
  return "カメラを開始できませんでした。Safariの権限設定とHTTPSのURLを確認してください。";
}

function startGeolocation() {
  if (!navigator.geolocation) {
    state.message = "このブラウザでは位置情報を利用できません。";
    return;
  }

  state.watchId = navigator.geolocation.watchPosition(
    (position) => {
      state.latestPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        time: new Date(position.timestamp).toISOString(),
      };
      render();
    },
    (error) => {
      console.warn(error);
      state.message = geolocationErrorMessage(error);
      render();
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    },
  );
}

function geolocationErrorMessage(error) {
  if (error.code === error.PERMISSION_DENIED) {
    return "位置情報が許可されていません。SafariのWebサイト設定、またはiPhoneの設定アプリで位置情報を許可してください。";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "現在地を取得できませんでした。屋外で空が見える場所に移動すると改善することがあります。";
  }
  if (error.code === error.TIMEOUT) {
    return "現在地の取得がタイムアウトしました。もう一度記録を開始してください。";
  }
  return "位置情報の取得に失敗しました。";
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;

  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
  } catch (error) {
    console.warn("Wake Lock unavailable", error);
  }
}

async function releaseWakeLock() {
  if (!state.wakeLock) return;

  try {
    await state.wakeLock.release();
  } catch (error) {
    console.warn("Wake Lock release failed", error);
  } finally {
    state.wakeLock = null;
  }
}

function startLightSensor() {
  if (!("AmbientLightSensor" in window)) return;

  try {
    state.sensor = new AmbientLightSensor();
    state.sensor.addEventListener("reading", () => {
      state.latestLightSensor = Math.round(state.sensor.illuminance);
    });
    state.sensor.start();
  } catch (error) {
    console.warn("AmbientLightSensor unavailable", error);
  }
}

function samplePoint() {
  if (!state.recording || !state.activeSession) return;

  const video = document.getElementById("cameraPreview");
  const brightness = video ? averageBrightness(video) : null;
  const position = state.latestPosition;
  state.elapsed = Date.now() - state.startTime;

  if (brightness !== null) {
    state.latestBrightness = brightness;
    state.latestLevel = classifyBrightness(brightness);
  }

  if (brightness !== null && position) {
    state.activeSession.points.push({
      time: new Date().toISOString(),
      latitude: Number(position.latitude.toFixed(7)),
      longitude: Number(position.longitude.toFixed(7)),
      accuracy: Math.round(position.accuracy),
      brightness,
      level: classifyBrightness(brightness),
      light_sensor: state.latestLightSensor,
    });
  }

  render();
}

function stopRecording() {
  if (!state.recording) return;

  window.clearInterval(state.sampleTimer);
  state.sampleTimer = 0;

  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }

  if (state.sensor) {
    state.sensor.stop();
    state.sensor = null;
  }

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  releaseWakeLock();

  state.recording = false;
  if (state.activeSession) {
    state.activeSession.endedAt = new Date().toISOString();
    state.sessions = [state.activeSession, ...state.sessions];
    saveSessions();
    state.selectedSessionId = state.activeSession.id;
  }
  state.activeSession = null;
  state.view = "map";
  render();
}

function changeInterval(value) {
  state.intervalMs = Number(value);
  if (state.recording && state.sampleTimer) {
    window.clearInterval(state.sampleTimer);
    state.sampleTimer = window.setInterval(samplePoint, state.intervalMs);
  }
  render();
}

function allPoints() {
  if (state.selectedSessionId === "all") {
    return state.sessions.flatMap((session) => session.points);
  }
  return state.sessions.find((session) => session.id === state.selectedSessionId)?.points || [];
}

function exportCsv() {
  const points = state.sessions.flatMap((session) => session.points);
  if (!points.length) {
    setMessage("出力できる記録がありません。");
    return;
  }

  const header = "time,latitude,longitude,accuracy,brightness,level,light_sensor";
  const rows = points.map((point) =>
    [
      formatCsvTime(point.time),
      point.latitude,
      point.longitude,
      point.accuracy,
      point.brightness,
      point.level,
      point.light_sensor ?? "",
    ].join(","),
  );
  const blob = new Blob([`${header}\n${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `night-brightness-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatCsvTime(value) {
  const date = new Date(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function deleteSession(id) {
  state.sessions = state.sessions.filter((session) => session.id !== id);
  if (state.selectedSessionId === id) state.selectedSessionId = "all";
  saveSessions();
  render();
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button class="brand" data-view="home" type="button" aria-label="ホームへ">
          <span class="brand-mark"></span>
          <span>
            <strong>夜道明るさ記録マップ</strong>
            <small>Camera brightness logger</small>
          </span>
        </button>
        <nav class="nav-tabs" aria-label="画面切り替え">
          ${navButton("home", "ホーム")}
          ${navButton("record", "記録")}
          ${navButton("map", "地図")}
          ${navButton("history", "履歴")}
        </nav>
      </header>
      ${state.message ? `<p class="message">${state.message}</p>` : ""}
      ${renderView()}
    </div>
  `;

  bindEvents();

  if (state.view === "record" && state.stream) {
    const video = document.getElementById("cameraPreview");
    if (video && video.srcObject !== state.stream) {
      video.srcObject = state.stream;
      video.play().catch(console.warn);
    }
  }

  if (state.view === "map") {
    window.setTimeout(drawMap, 0);
  }
}

function navButton(view, label) {
  const disabled = view === "record" && !state.recording ? "disabled" : "";
  return `<button class="${state.view === view ? "active" : ""}" data-view="${view}" ${disabled} type="button">${label}</button>`;
}

function renderView() {
  if (state.view === "record") return renderRecord();
  if (state.view === "map") return renderMap();
  if (state.view === "history") return renderHistory();
  return renderHome();
}

function renderHome() {
  const totalPoints = state.sessions.reduce((sum, session) => sum + session.points.length, 0);
  const latest = state.sessions[0];
  const readiness = startReadiness();

  return `
    <main class="home-grid">
      <section class="hero-panel">
        <div>
          <p class="eyebrow">Night route brightness</p>
          <h1>夜道の明るさを、歩いた場所ごとに残す。</h1>
        </div>
        <div class="hero-stats">
          <span><strong>${state.sessions.length}</strong>記録</span>
          <span><strong>${totalPoints}</strong>地点</span>
          <span><strong>${latest ? fmtDate(latest.startedAt).slice(0, 10) : "--"}</strong>最新</span>
        </div>
      </section>

      ${readinessMessage() ? `<section class="install-notice">${readinessMessage()}</section>` : ""}

      <section class="action-grid" aria-label="主要操作">
        <button class="action-button primary" data-action="start" type="button">
          <span class="button-icon record-dot"></span>
          <strong>記録開始</strong>
        </button>
        <button class="action-button" data-view="map" type="button">
          <span class="button-icon map-icon"></span>
          <strong>地図を見る</strong>
        </button>
        <button class="action-button" data-action="csv" type="button">
          <span class="button-icon csv-icon"></span>
          <strong>CSV出力</strong>
        </button>
        <button class="action-button" data-view="history" type="button">
          <span class="button-icon history-icon"></span>
          <strong>記録履歴</strong>
        </button>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>記録間隔</h2>
          <span>${state.intervalMs / 1000}秒</span>
        </div>
        <div class="segmented">
          ${[1000, 2000, 3000]
            .map(
              (value) =>
                `<button class="${state.intervalMs === value ? "active" : ""}" data-interval="${value}" type="button">${value / 1000}秒</button>`,
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>iPhone準備</h2>
          <span>${isStandaloneMode() ? "ホーム画面から起動中" : "Safariで利用"}</span>
        </div>
        <div class="check-list">
          ${readiness
            .map(
              (item) => `
                <div class="check-item ${item.ok ? "ok" : "bad"}">
                  <span>${item.ok ? "OK" : "要確認"}</span>
                  <strong>${item.label}</strong>
                  <small>${item.note}</small>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>5段階分類</h2>
          <span>平均明るさ 0-255</span>
        </div>
        <div class="level-list">
          ${[1, 2, 3, 4, 5].map(renderLevelItem).join("")}
        </div>
      </section>
    </main>
  `;
}

function renderLevelItem(level) {
  const ranges = {
    1: "0-40",
    2: "41-80",
    3: "81-120",
    4: "121-170",
    5: "171-255",
  };
  return `
    <div class="level-item">
      <span class="level-chip" style="--level-color: ${levelColors[level]}">${level}</span>
      <strong>${levelLabels[level]}</strong>
      <small>${ranges[level]}</small>
    </div>
  `;
}

function renderRecord() {
  const position = state.latestPosition;
  const level = state.latestLevel;
  return `
    <main class="record-layout">
      <section class="camera-panel">
        <video id="cameraPreview" autoplay playsinline muted></video>
        <div class="recording-badge">REC</div>
      </section>
      <section class="panel live-panel">
        <div class="section-head">
          <h2>記録中</h2>
          <span>${fmtDuration(state.elapsed)}</span>
        </div>
        <div class="meter" style="--meter: ${state.latestBrightness ?? 0}">
          <span></span>
        </div>
        <div class="data-grid">
          ${dataCell("緯度", position ? position.latitude.toFixed(6) : "--")}
          ${dataCell("経度", position ? position.longitude.toFixed(6) : "--")}
          ${dataCell("精度", position ? `${Math.round(position.accuracy)}m` : "--")}
          ${dataCell("明るさ", state.latestBrightness ?? "--")}
          ${dataCell("段階", level ? `${level} ${levelLabels[level]}` : "--")}
          ${dataCell("記録地点", state.activeSession?.points.length ?? 0)}
        </div>
        <button class="stop-button" data-action="stop" type="button">記録停止</button>
      </section>
    </main>
  `;
}

function dataCell(label, value) {
  return `
    <div class="data-cell">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderMap() {
  return `
    <main class="map-layout">
      <section class="map-toolbar">
        <select id="sessionFilter" aria-label="表示する記録">
          <option value="all" ${state.selectedSessionId === "all" ? "selected" : ""}>すべての記録</option>
          ${state.sessions
            .map(
              (session) =>
                `<option value="${session.id}" ${state.selectedSessionId === session.id ? "selected" : ""}>${fmtDate(session.startedAt)} (${session.points.length}地点)</option>`,
            )
            .join("")}
        </select>
        <button class="ghost-button" data-action="csv" type="button">CSV出力</button>
      </section>
      <section id="map" class="map-canvas" aria-label="明るさ記録地図"></section>
      <section class="legend" aria-label="色分け凡例">
        ${[1, 2, 3, 4, 5]
          .map(
            (level) =>
              `<span><i style="background:${levelColors[level]}"></i>${level} ${levelLabels[level]}</span>`,
          )
          .join("")}
      </section>
    </main>
  `;
}

function renderHistory() {
  if (!state.sessions.length) {
    return `
      <main class="empty-state">
        <h1>記録履歴</h1>
        <p>まだ記録はありません。</p>
        <button class="action-button primary inline" data-action="start" type="button">記録開始</button>
      </main>
    `;
  }

  return `
    <main class="history-list">
      <div class="page-head">
        <h1>記録履歴</h1>
        <button class="ghost-button" data-action="csv" type="button">CSV出力</button>
      </div>
      ${state.sessions.map(renderSessionCard).join("")}
    </main>
  `;
}

function renderSessionCard(session) {
  const duration = session.endedAt ? new Date(session.endedAt) - new Date(session.startedAt) : 0;
  const brightness = average(session.points.map((point) => point.brightness));
  return `
    <article class="session-card">
      <div>
        <strong>${fmtDate(session.startedAt)}</strong>
        <small>${fmtDuration(duration)} / ${session.points.length}地点 / 平均 ${brightness}</small>
      </div>
      <div class="session-actions">
        <button class="ghost-button" data-map-session="${session.id}" type="button">地図</button>
        <button class="danger-button" data-delete="${session.id}" type="button">削除</button>
      </div>
    </article>
  `;
}

function bindEvents() {
  app.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (view === "record" && !state.recording) return;
      state.view = view;
      state.message = "";
      render();
    });
  });

  app.querySelectorAll("[data-action='start']").forEach((button) => button.addEventListener("click", startRecording));
  app.querySelectorAll("[data-action='stop']").forEach((button) => button.addEventListener("click", stopRecording));
  app.querySelectorAll("[data-action='csv']").forEach((button) => button.addEventListener("click", exportCsv));
  app.querySelectorAll("[data-interval]").forEach((button) => {
    button.addEventListener("click", () => changeInterval(button.dataset.interval));
  });
  app.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteSession(button.dataset.delete));
  });
  app.querySelectorAll("[data-map-session]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSessionId = button.dataset.mapSession;
      state.view = "map";
      render();
    });
  });

  const sessionFilter = document.getElementById("sessionFilter");
  if (sessionFilter) {
    sessionFilter.addEventListener("change", () => {
      state.selectedSessionId = sessionFilter.value;
      drawMap();
    });
  }
}

function drawMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || !window.L) return;

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  const points = allPoints();
  const center = points.length ? [points[0].latitude, points[0].longitude] : [34.0658, 134.5594];
  mapInstance = L.map(mapEl, {
    zoomControl: true,
    attributionControl: true,
  }).setView(center, points.length ? 17 : 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(mapInstance);

  const latLngs = [];
  points.forEach((point) => {
    const latLng = [point.latitude, point.longitude];
    latLngs.push(latLng);
    L.circleMarker(latLng, {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: levelColors[point.level],
      fillOpacity: 0.92,
    })
      .addTo(mapInstance)
      .bindPopup(`
        <strong>${fmtDate(point.time)}</strong><br>
        明るさ: ${point.brightness}<br>
        5段階評価: ${point.level} ${levelLabels[point.level]}<br>
        緯度: ${point.latitude}<br>
        経度: ${point.longitude}<br>
        精度: ${point.accuracy}m
      `);
  });

  if (latLngs.length > 1) {
    L.polyline(latLngs, {
      color: "#111827",
      weight: 3,
      opacity: 0.45,
    }).addTo(mapInstance);
    mapInstance.fitBounds(latLngs, { padding: [24, 24] });
  }

  if (!points.length) {
    L.marker(center).addTo(mapInstance).bindPopup("記録データがありません。");
  }
}
