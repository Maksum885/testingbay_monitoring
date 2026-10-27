import { store, ui, ROOM_TO_CR } from "./state.js";
import { getDashboardData, PlcAPI } from "../services/dashboardData.js";

let isRefreshingRoom = false;
let isRefreshingDashboard = false;
let plcEchoChannelName = null;

/** ACK alarm demo (VITE_DASHBOARD_USE_DUMMY) — hanya di memori; hilang setelah refresh halaman. */
const dummyAlarmAcks = new Map();

function realtimeEnabled() {
    return Boolean(import.meta.env.VITE_PUSHER_APP_KEY && typeof window.Echo !== "undefined");
}

function pollIntervalRoomMs() {
    return realtimeEnabled() ? 12000 : 3000;
}

function pollIntervalGlobalMs() {
    return realtimeEnabled() ? 25000 : 4000;
}

function stopPlcEcho() {
    if (window.Echo && plcEchoChannelName && typeof window.Echo.leave === "function") {
        try {
            window.Echo.leave(plcEchoChannelName);
        } catch {
            /* ignore */
        }
    }
    plcEchoChannelName = null;
}

function findRoomByApiId(apiRoomId) {
    for (const d of Object.values(store.data)) {
        const r = d.rooms.find((x) => x.api_room_id === apiRoomId);
        if (r) return r;
    }
    return null;
}

function renderPlcStatusBadge(status) {
    const st = status || "offline";
    const isOnline = st === "online";
    const isError = st === "error";
    const label = isOnline ? "PLC connected" : isError ? "PLC error" : "PLC offline";
    const mod = isOnline ? "rp-plc-badge--on" : isError ? "rp-plc-badge--err" : "rp-plc-badge--off";
    const icon = isOnline ? "ti-plug-connected" : isError ? "ti-alert-triangle" : "ti-plug-off";
    return `<span class="rp-plc-badge ${mod}" role="status"><i class="ti ${icon}" aria-hidden="true"></i><span>${label}</span></span>`;
}

function updateRoomPlcStrip(room) {
    const el = document.getElementById("rp-plc-strip");
    if (!el) return;
    if (room?.api_room_id) {
        el.classList.remove("is-hidden");
        const st = room.plc_link_status || "offline";
        el.innerHTML = renderPlcStatusBadge(st);
    } else {
        el.classList.add("is-hidden");
        el.innerHTML = "";
    }
}

function bindPlcEchoForRoom(room) {
    stopPlcEcho();
    if (!realtimeEnabled() || !room?.api_room_id) return;

    const ch = `plc.room.${room.api_room_id}`;
    plcEchoChannelName = ch;
    const plcEchoChannel = window.Echo.channel(ch);
    plcEchoChannel.listen(".PlcRoomUpdated", (payload) => {
        const rid = payload?.room_id;
        if (!rid) return;

        const target = findRoomByApiId(rid) || (ui.curRoomId ? findRoom(ui.curRoomId) : null);
        if (!target) return;

        syncRoomPlcLinkFromPollPayload(target, payload);

        const snap = payload?.data;
        const pollOk = (payload?.status || "") === "success";
        if (!pollOk || !snap || typeof snap !== "object") clearLiveSnapshotFields(target);
        else applySnapshotToRoom(target, snap);

        buildSidebarRooms();
        updateAlarmSidebar();

        if (ui.panelMode === "room" && ui.curRoomId === target.id) {
            const crId = findCR(target.id);
            if (crId) renderRoomPanelPanes(target, crId);
        }
    });
}

export function findCR(id) {
    if (store.data[id]) return id;
    return ROOM_TO_CR[id] || null;
}

export function findRoom(roomId) {
    for (const d of Object.values(store.data)) {
        const r = d.rooms.find((x) => x.id === roomId);
        if (r) return r;
    }
    return null;
}

/** true = sedang pengujian aktif (tekanan/proses uji berjalan) */
export function isRoomActivelyTesting(r) {
    return ["RUNNING", "HOLDING", "PRESSURIZING"].includes(r.phase);
}

function useDummyDashboard() {
    return import.meta.env.VITE_DASHBOARD_USE_DUMMY === "true";
}

/** Realtime: alarm register hanya dipercaya saat PLC online (sama seperti EMERGENCY). */
function plcRegistersTrusted(r) {
    return useDummyDashboard() || (r?.plc_link_status || "") === "online";
}

/**
 * #40001 tekanan masuk sebelum testing: alarm bila ada tekanan (nilai > 0, berapapun besarnya)
 * saat testing belum dimulai. Dummy/API boleh set `alarm_pressure_in` langsung.
 */
export function hasInletPressureAlarm(r) {
    if (!r) return false;
    if (useDummyDashboard() && dummyAlarmAcks.get(r.id)?.has("pressure_in")) return false;
    if (r.alarm_pressure_in === true) return plcRegistersTrusted(r);
    const pres = Number(r.pres_in ?? 0);
    return plcRegistersTrusted(r) && pres > 0 && !isRoomActivelyTesting(r);
}

function sidebarRoomDotClass(r) {
    return (r.plc_link_status || "") === "online" ? "room-dot-st--on" : "room-dot-st--off";
}

/**
 * Sidebar: dua badge — kiri Running/Idle (#40009), kanan Auto/Maint (#40003).
 * Lebih jelas daripada satu badge berprioritas (MAINT menutupi TEST, dll.).
 */
function sidebarModeBadges(r) {
    const testBadge = isRoomActivelyTesting(r)
        ? `<span class="badge-sm badge-run" title="Test status: running">Run</span>`
        : `<span class="badge-sm badge-idle" title="Test status: idle">Idle</span>`;
    const modeBadge =
        r.mode === "MAINTENANCE"
            ? `<span class="badge-sm badge-maint" title="Panel mode: maintenance">Maint</span>`
            : `<span class="badge-sm badge-auto" title="Panel mode: auto">Auto</span>`;
    return `<span class="room-badges">${testBadge}${modeBadge}</span>`;
}

function fmtRegBar(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return Number(n).toFixed(1);
}

/** #40011 / #40012 — tampilan satuan PSI (nilai dari register, tanpa badge Normal/High). */
function fmtPressurePsi(value) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return Number(value).toFixed(1);
}

/** Label panel Operational status — selaras phase RUNNING, bukan "standby". */
function operationalTestStatusLabel(r) {
    return isRoomActivelyTesting(r) ? "Running" : "Idle";
}

/** OPEN | CLOSE | MOVING_OPEN | MOVING_CLOSE — prioritas: limit switch > motor running. */
function normalizedRoofState(r) {
    if (r.reg_roof_open) return "OPEN";
    if (r.reg_roof_closed) return "CLOSE";
    if (r.roof_moving_open) return "MOVING_OPEN";
    if (r.roof_moving_close) return "MOVING_CLOSE";
    const rs = String(r.roof_state || "CLOSE").toUpperCase();
    if (rs === "OPEN") return "OPEN";
    return "CLOSE";
}

const DUMMY_ROOF_PRESETS = {
    close:   { roof_state: "CLOSE", reg_roof_open: false, reg_roof_closed: true,  roof_moving_open: false, roof_moving_close: false },
    closing: { roof_state: "CLOSE", reg_roof_open: false, reg_roof_closed: false, roof_moving_open: false, roof_moving_close: true  },
    opening: { roof_state: "OPEN",  reg_roof_open: false, reg_roof_closed: false, roof_moving_open: true,  roof_moving_close: false },
    open:    { roof_state: "OPEN",  reg_roof_open: true,  reg_roof_closed: false, roof_moving_open: false, roof_moving_close: false },
};

/**
 * Demo roof — hanya saat VITE_DASHBOARD_USE_DUMMY=true.
 * Tombol tampil di renderRoofPositionHtml(); panel peta 3D di demoRoofControls.js (admin).
 */
export function applyDummyRoofPreset(roomId, presetKey) {
    if (!useDummyDashboard() || !roomId) return;
    const preset = DUMMY_ROOF_PRESETS[presetKey];
    const room = findRoom(roomId);
    if (!room || !preset) return;
    Object.assign(room, preset);
    if (ui.panelMode === "room" && ui.curRoomId === roomId) {
        const crId = findCR(roomId);
        if (crId) renderRoomPanelPanes(room, crId);
    }
}

function renderRoofPositionHtml(r) {
    const state = normalizedRoofState(r);
    const open = state === "OPEN";
    if (useDummyDashboard()) {
        const movOpen  = state === "MOVING_OPEN";
        const movClose = state === "MOVING_CLOSE";
        const closed   = state === "CLOSE";
        return `
  <div class="rp-overview-block rp-overview-block--roof">
    <div class="section-label">Roof position</div>
    <div class="roof-segment roof-segment--demo" role="group" aria-label="Demo roof control">
      <button type="button" class="roof-segment__cell roof-segment__btn${open    ? " is-active is-open"   : ""}" onclick="applyDummyRoofPreset('${r.id}','open')">
        <i class="ti ti-chevrons-up" aria-hidden="true"></i><span>OPEN</span>
      </button>
      <button type="button" class="roof-segment__cell roof-segment__btn${movOpen  ? " is-active is-moving" : ""}" onclick="applyDummyRoofPreset('${r.id}','opening')">
        <i class="ti ti-chevrons-up" aria-hidden="true"></i><span>OPENING</span>
      </button>
      <button type="button" class="roof-segment__cell roof-segment__btn${movClose ? " is-active is-moving" : ""}" onclick="applyDummyRoofPreset('${r.id}','closing')">
        <i class="ti ti-chevrons-down" aria-hidden="true"></i><span>CLOSING</span>
      </button>
      <button type="button" class="roof-segment__cell roof-segment__btn${closed   ? " is-active is-close"  : ""}" onclick="applyDummyRoofPreset('${r.id}','close')">
        <i class="ti ti-chevrons-down" aria-hidden="true"></i><span>CLOSE</span>
      </button>
    </div>
  </div>`;
    }

    let openCls = "";
    let closeCls = "";
    let openLabel = "OPEN";
    let closeLabel = "CLOSE";

    if (state === "OPEN") {
        openCls = " is-active is-open";
    } else if (state === "CLOSE") {
        closeCls = " is-active is-close";
    } else if (state === "MOVING_OPEN") {
        openCls = " is-active is-moving";
        openLabel = "OPENING…";
    } else if (state === "MOVING_CLOSE") {
        closeCls = " is-active is-moving";
        closeLabel = "CLOSING…";
    }

    return `
  <div class="rp-overview-block rp-overview-block--roof">
    <div class="section-label">Roof position</div>
    <div class="roof-segment" role="status" aria-label="Roof ${state.toLowerCase().replace("_", " ")}">
      <div class="roof-segment__cell${openCls}">
        <i class="ti ti-chevrons-up" aria-hidden="true"></i>
        <span>${openLabel}</span>
      </div>
      <div class="roof-segment__cell${closeCls}">
        <i class="ti ti-chevrons-down" aria-hidden="true"></i>
        <span>${closeLabel}</span>
      </div>
    </div>
  </div>`;
}

export function renderRoomPanelPanes(r, crId) {
    if (!r) return;
    // Don't blow away a focused pressure input mid-type
    const skipOverview = useDummyDashboard() &&
        document.activeElement?.classList.contains("demo-pressure-input");
    if (!skipOverview) renderPaneOverview(r, crId);
    renderPaneLog(r);
}

function renderPaneOverview(r, crId) {
    const p1 = Number(r.pres_bbm ?? r.test_pressure ?? 0);
    const p2 = Number(r.pres_2 ?? 0);
    const maint = r.mode === "MAINTENANCE";
    const testStatusLabel = operationalTestStatusLabel(r);
    const testActive = isRoomActivelyTesting(r);
    const locked = r.door_lock === "locked";
    const emergOn = plcRegistersTrusted(r) && Boolean(r.alarm_emergency);
    const dummy = useDummyDashboard();

    const pressureSection = dummy
        ? renderDummyPressureControls(r)
        : `
  <div class="rp-overview-block">
    <div class="section-label">Pressure</div>
    <div class="sensor-grid-v2">
      <div class="sensor-card-v2">
        <div class="sn">Pressure 1</div>
        <div class="sv">${fmtPressurePsi(p1)}<span class="su"> PSI</span></div>
      </div>
      <div class="sensor-card-v2">
        <div class="sn">Pressure 2</div>
        <div class="sv">${fmtPressurePsi(p2)}<span class="su"> PSI</span></div>
      </div>
    </div>
  </div>`;

    const opsSection = dummy
        ? renderDummyOpControls(r)
        : `
  <div class="rp-overview-block">
    <div class="section-label">Operational status</div>
    <div class="roof-card-v2">
      <div class="roof-row-v2">
        <span class="rp-field-label">Panel mode</span>
        <span class="st-badge-v2" style="${maint ? "background:#ede9fe;color:#7c3aed" : "background:#dbeafe;color:#1e40af"}">${maint ? "Maintenance" : "Auto"}</span>
      </div>
      <div class="roof-row-v2">
        <span class="rp-field-label">Test status</span>
        <span class="st-badge-v2" style="${testActive ? "background:#dcfce7;color:#15803d" : "background:#f3f4f6;color:#374151"}">${testStatusLabel}</span>
      </div>
      <div class="roof-row-v2">
        <span class="rp-field-label">Access door</span>
        <span class="st-badge-v2" style="${locked ? "background:#fee2e2;color:#b91c1c" : "background:#dcfce7;color:#15803d"}"><i class="ti ${locked ? "ti-lock" : "ti-lock-open"}"></i> ${locked ? "Locked" : "Unlocked"}</span>
      </div>
      <div class="roof-row-v2">
        <span class="rp-field-label">Emergency</span>
        <span class="st-badge-v2" style="${emergOn ? "background:#fee2e2;color:#b91c1c" : "background:#f3f4f6;color:#374151"}">${emergOn ? "ON" : "OFF"}</span>
      </div>
    </div>
  </div>`;

    document.getElementById("pane-o").innerHTML = `
  ${pressureSection}
  ${renderRoofPositionHtml(r)}
  ${opsSection}
  ${dummy ? renderDummyPlcControls(r) : ""}
  ${dummy ? renderDummyAlarmTriggers(r) : ""}
  ${renderRoomAlarmSection(r)}`;
}

function renderPaneLog(r) {
    const ev = r.events && r.events.length ? r.events : [];
    let h = `<div class="section-label">Event log</div>`;
    if (!ev.length) {
        h += `<div style="font-size:12px;color:#6b7280;padding:8px 0">No log entries yet.</div>`;
    } else {
        ev.forEach((e) => {
            let box = "info";
            let ico = "ti-info-circle";
            if (e.c === "cr") {
                box = "danger";
                ico = "ti-alert-triangle";
            } else if (e.c === "wa") {
                box = "warn";
                ico = "ti-shield";
            } else if (e.c === "ok") {
                box = "ok";
                ico = "ti-check";
            }
            h += `<div class="log-item-v2">
      <div class="log-icon-v2 ${box}"><i class="ti ${ico}"></i></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:var(--txt)">${e.m}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px">${e.t}</div>
      </div>
    </div>`;
        });
    }
    document.getElementById("pane-e").innerHTML = h;
}

const DUMMY_ALARM_LABELS = {
    emergency: "EMERGENCY",
    pressure_in: "ALARM PRESSURE",
    left_motor: "LEFT MOTOR FAIL",
    right_motor: "RIGHT MOTOR FAIL",
    motor: "MOTOR FAIL",
};

/**
 * Acknowledge alarm di mode dummy (in-memory). Setelah refresh browser, data dummy asli kembali.
 */
export function ackDummyRoomAlarm(roomId, alarmKey) {
    if (!useDummyDashboard() || !roomId) return;

    const room = findRoom(roomId);
    if (!room) return;

    if (!DUMMY_ALARM_LABELS[alarmKey]) return;

    if (!dummyAlarmAcks.has(roomId)) dummyAlarmAcks.set(roomId, new Set());
    dummyAlarmAcks.get(roomId).add(alarmKey);

    switch (alarmKey) {
        case "emergency":
            room.alarm_emergency = false;
            break;
        case "pressure_in":
            room.alarm_pressure_in = false;
            break;
        case "left_motor":
            room.alarm_left_motor = false;
            break;
        case "right_motor":
            room.alarm_right_motor = false;
            break;
        case "motor":
            room.alarm_motor = false;
            break;
    }

    const ackLabel = DUMMY_ALARM_LABELS[alarmKey] || alarmKey;
    if (!Array.isArray(room.events)) room.events = [];
    room.events.unshift({
        t: getNow(),
        c: "ok",
        m: `${ackLabel} acknowledged (demo)`,
    });

    updateAlarmSidebar();
    buildSidebarRooms();
    if (ui.panelMode === "room" && ui.curRoomId === roomId) {
        const crId = findCR(roomId);
        if (crId) renderRoomPanelPanes(room, crId);
    }
}

/* ── Demo simulation render helpers ──────────────────────────────────────── */

function renderDummyPressureControls(r) {
    const p1 = Number(r.pres_bbm ?? r.test_pressure ?? 0).toFixed(1);
    const p2 = Number(r.pres_2 ?? 0).toFixed(1);
    return `
  <div class="rp-overview-block">
    <div class="section-label">Pressure</div>
    <div class="sensor-grid-v2">
      <div class="sensor-card-v2">
        <label class="sn" for="dp1-${r.id}">Pressure 1</label>
        <div class="sv"><input type="number" id="dp1-${r.id}" class="demo-pressure-input demo-pres-inline"
          value="${p1}" min="0" max="9999" step="0.1"
          oninput="setDummyPressure('${r.id}',1,this.value)"
          onchange="setDummyPressure('${r.id}',1,this.value)"><span class="su"> PSI</span></div>
      </div>
      <div class="sensor-card-v2">
        <label class="sn" for="dp2-${r.id}">Pressure 2</label>
        <div class="sv"><input type="number" id="dp2-${r.id}" class="demo-pressure-input demo-pres-inline"
          value="${p2}" min="0" max="9999" step="0.1"
          oninput="setDummyPressure('${r.id}',2,this.value)"
          onchange="setDummyPressure('${r.id}',2,this.value)"><span class="su"> PSI</span></div>
      </div>
    </div>
  </div>`;
}

function renderDummyOpControls(r) {
    const maint   = r.mode === "MAINTENANCE";
    const running = isRoomActivelyTesting(r);
    const locked  = r.door_lock === "locked";
    const emergOn = Boolean(r.alarm_emergency);
    return `
  <div class="rp-overview-block">
    <div class="section-label">Operational status</div>
    <div class="roof-card-v2">
      <div class="roof-row-v2">
        <span class="rp-field-label">Panel mode</span>
        <button class="st-badge-v2 st-badge-v2--btn"
                style="${maint ? "background:#ede9fe;color:#7c3aed" : "background:#dbeafe;color:#1e40af"}"
                onclick="setDummyPanelMode('${r.id}','${maint ? "AUTO" : "MAINTENANCE"}')" title="Klik untuk ganti mode">
          ${maint ? "Maintenance" : "Auto"} <span class="st-badge-chev">&#9662;</span>
        </button>
      </div>
      <div class="roof-row-v2">
        <span class="rp-field-label">Test status</span>
        <button class="st-badge-v2 st-badge-v2--btn"
                style="${running ? "background:#dcfce7;color:#15803d" : "background:#f3f4f6;color:#374151"}"
                onclick="setDummyTestStatus('${r.id}','${running ? "STANDBY" : "RUNNING"}')" title="Klik untuk ganti status">
          ${running ? "Running" : "Idle"} <span class="st-badge-chev">&#9662;</span>
        </button>
      </div>
      <div class="roof-row-v2">
        <span class="rp-field-label">Access door</span>
        <button class="st-badge-v2 st-badge-v2--btn"
                style="${locked ? "background:#fee2e2;color:#b91c1c" : "background:#dcfce7;color:#15803d"}"
                onclick="setDummyDoorLock('${r.id}','${locked ? "unlocked" : "locked"}')" title="Klik untuk ganti status pintu">
          <i class="ti ${locked ? "ti-lock" : "ti-lock-open"}"></i> ${locked ? "Locked" : "Unlocked"} <span class="st-badge-chev">&#9662;</span>
        </button>
      </div>
      <div class="roof-row-v2">
        <span class="rp-field-label">Emergency</span>
        <button class="st-badge-v2 st-badge-v2--btn"
                style="${emergOn ? "background:#fee2e2;color:#b91c1c" : "background:#f3f4f6;color:#374151"}"
                onclick="setDummyEmergency('${r.id}',${emergOn ? "false" : "true"})" title="Klik untuk toggle emergency">
          ${emergOn ? "ON" : "OFF"} <span class="st-badge-chev">&#9662;</span>
        </button>
      </div>
    </div>
  </div>`;
}

function renderDummyPlcControls(r) {
    const online = (r.plc_link_status || "") === "online";
    const stOnline  = online  ? "background:#15803d;color:#fff;border-color:#166534"   : "background:#f0fdf4;color:#166534;border-color:#bbf7d0";
    const stOffline = !online ? "background:#b91c1c;color:#fff;border-color:#991b1b"   : "background:#fecaca;color:#991b1b;border-color:#fca5a5";
    return `
  <div class="rp-overview-block">
    <div class="section-label">PLC connection</div>
    <div class="demo-seg">
      <button class="demo-seg__btn" style="${stOnline}"  onclick="setDummyPlcStatus('${r.id}','online')"><i class="ti ti-plug-connected"></i> Online</button>
      <button class="demo-seg__btn" style="${stOffline}" onclick="setDummyPlcStatus('${r.id}','offline')"><i class="ti ti-plug-off"></i> Offline</button>
    </div>
  </div>`;
}

function renderDummyAlarmTriggers(r) {
    const motorBtns = r.dual_motor
        ? `<button class="demo-trigger-btn demo-trigger-btn--warn" onclick="triggerDummyAlarm('${r.id}','left_motor')">Left Motor Fail</button>
           <button class="demo-trigger-btn demo-trigger-btn--warn" onclick="triggerDummyAlarm('${r.id}','right_motor')">Right Motor Fail</button>`
        : `<button class="demo-trigger-btn demo-trigger-btn--warn" onclick="triggerDummyAlarm('${r.id}','motor')">Motor Fail</button>`;
    return `
  <div class="rp-overview-block">
    <div class="section-label">Trigger alarm</div>
    <div class="demo-trigger-grid">
      <button class="demo-trigger-btn demo-trigger-btn--danger" onclick="triggerDummyAlarm('${r.id}','emergency')">Emergency</button>
      ${motorBtns}
      <button class="demo-trigger-btn demo-trigger-btn--warn" onclick="triggerDummyAlarm('${r.id}','pressure_in')">Pressure Alarm</button>
    </div>
  </div>`;
}

/* ── Demo simulation setters ──────────────────────────────────────────────── */

function dummyRoomLog(room, cls, msg) {
    if (!Array.isArray(room.events)) room.events = [];
    room.events.unshift({ t: getNow(), c: cls, m: msg });
    if (room.events.length > 20) room.events.length = 20;
}

function dummyRefreshRoom(roomId, room) {
    buildSidebarRooms();
    updateAlarmSidebar();
    if (ui.panelMode === "room" && ui.curRoomId === roomId) {
        const crId = findCR(roomId);
        if (crId) renderRoomPanelPanes(room, crId);
    }
}

export function setDummyPressure(roomId, slot, value) {
    if (!useDummyDashboard() || !roomId) return;
    const room = findRoom(roomId);
    if (!room) return;
    const v = parseFloat(value);
    if (Number.isNaN(v) || v < 0) return;
    if (String(slot) === "1") {
        if (room.tp === "TEST PIT") room.test_pressure = v;
        else room.pres_bbm = v;
    } else {
        room.pres_2 = v;
    }
}

export function setDummyPanelMode(roomId, mode) {
    if (!useDummyDashboard() || !roomId) return;
    const room = findRoom(roomId);
    if (!room) return;
    room.mode = mode;
    dummyRoomLog(room, mode === "MAINTENANCE" ? "wa" : "ok", `Panel mode → ${mode} (demo)`);
    dummyRefreshRoom(roomId, room);
}

export function setDummyTestStatus(roomId, status) {
    if (!useDummyDashboard() || !roomId) return;
    const room = findRoom(roomId);
    if (!room) return;
    room.phase = status;
    dummyRoomLog(room, status === "RUNNING" ? "ok" : "info", `Test status → ${status === "RUNNING" ? "Running" : "Idle"} (demo)`);
    dummyRefreshRoom(roomId, room);
}

export function setDummyDoorLock(roomId, state) {
    if (!useDummyDashboard() || !roomId) return;
    const room = findRoom(roomId);
    if (!room) return;
    room.door_lock = state;
    dummyRoomLog(room, state === "locked" ? "wa" : "ok", `Door → ${state} (demo)`);
    buildSidebarRooms();
    if (ui.panelMode === "room" && ui.curRoomId === roomId) {
        const crId = findCR(roomId);
        if (crId) renderRoomPanelPanes(room, crId);
    }
}

export function setDummyEmergency(roomId, on) {
    if (!useDummyDashboard() || !roomId) return;
    const room = findRoom(roomId);
    if (!room) return;
    room.alarm_emergency = Boolean(on);
    dummyAlarmAcks.get(roomId)?.delete("emergency");
    dummyRoomLog(room, on ? "cr" : "ok", `Emergency → ${on ? "ACTIVE" : "cleared"} (demo)`);
    dummyRefreshRoom(roomId, room);
}

export function setDummyPlcStatus(roomId, status) {
    if (!useDummyDashboard() || !roomId) return;
    const room = findRoom(roomId);
    if (!room) return;
    room.plc_link_status = status;
    updateRoomPlcStrip(room);
    dummyRoomLog(room, status === "online" ? "ok" : "wa", `PLC → ${status} (demo)`);
    dummyRefreshRoom(roomId, room);
}

export function triggerDummyAlarm(roomId, alarmKey) {
    if (!useDummyDashboard() || !roomId) return;
    const room = findRoom(roomId);
    if (!room) return;
    dummyAlarmAcks.get(roomId)?.delete(alarmKey);
    switch (alarmKey) {
        case "emergency":    room.alarm_emergency = true; break;
        case "pressure_in":  room.alarm_pressure_in = true; break;
        case "left_motor":   room.alarm_left_motor = true; break;
        case "right_motor":  room.alarm_right_motor = true; break;
        case "motor":        room.alarm_motor = true; break;
    }
    const label = DUMMY_ALARM_LABELS[alarmKey] || alarmKey;
    dummyRoomLog(room, "cr", `${label} — triggered (demo)`);
    dummyRefreshRoom(roomId, room);
}

function renderRoomAlarmSection(r) {
    const rows = [];
    if (r.alarm_emergency && plcRegistersTrusted(r))
        rows.push({ key: "emergency", t: "EMERGENCY", sub: r.nm });
    if (hasInletPressureAlarm(r))
        rows.push({ key: "pressure_in", t: "ALARM PRESSURE", sub: r.nm });
    if (r.dual_motor) {
        if (r.alarm_left_motor)
            rows.push({ key: "left_motor", t: "LEFT MOTOR FAIL", sub: r.nm });
        if (r.alarm_right_motor)
            rows.push({ key: "right_motor", t: "RIGHT MOTOR FAIL", sub: r.nm });
    } else if (r.alarm_motor) {
        rows.push({ key: "motor", t: "MOTOR FAIL", sub: r.nm });
    }
    if (!rows.length)
        return `<div class="section-label" style="margin-top:10px">Room alarms</div><div style="font-size:11px;color:#6b7280">No active alarms in this room.</div>`;
    const dummy = useDummyDashboard();
    let h = `<div class="section-label" style="margin-top:10px">Room alarms</div>`;
    rows.forEach((x) => {
        const ackBtn = dummy
            ? `<button type="button" class="btn-ack" onclick="ackDummyRoomAlarm('${r.id}','${x.key}')" title="Acknowledge (demo — resets on page refresh)">ACK</button>`
            : `<button type="button" class="btn-ack" disabled title="Acknowledge PLC alarm (live mode)">ACK</button>`;
        h += `<div class="alarm-room-v2">
    <i class="ti ti-alert-triangle" style="font-size:15px;color:var(--cr)"></i>
    <div style="flex:1"><div class="alarm-room-title">${x.t}</div><div class="alarm-room-sub">${x.sub}</div></div>
    ${ackBtn}
  </div>`;
    });
    return h;
}

export function updateCenterStatusBar() {
    /* Bottom status bar removed from layout */
}

function sortRoomsByDisplayName(rooms) {
    return [...rooms].sort((a, b) =>
        (a.nm || "").localeCompare(b.nm || "", undefined, { numeric: true, sensitivity: "base" }),
    );
}

function roomSidebarRowHtml(r, crId) {
    ROOM_TO_CR[r.id] = crId;
    return `<div class="room-item room-item--v2" id="ri-${r.id}" onclick="openRoomPanel('${r.id}','${crId}')">
        <div class="room-dot-st ${sidebarRoomDotClass(r)}"></div>
        <div class="room-v2-body">
          <div class="room-v2-top">
            <span class="room-v2-name">${r.nm}</span>
            ${sidebarModeBadges(r)}
          </div>
        </div>
      </div>`;
}

export function buildSidebarRooms() {
    Object.entries(store.data).forEach(([crId, d]) => {
        const cont = document.getElementById(`rooms-${crId}`);
        if (!cont) return;
        cont.innerHTML = sortRoomsByDisplayName(d.rooms || [])
            .map((r) => roomSidebarRowHtml(r, crId))
            .join("");
    });
    updateCenterStatusBar();
}

export function toggleRooms(crId) {
    const cont = document.getElementById(`rooms-${crId}`);
    const btn = document.getElementById(`exp-${crId}`);
    if (!cont || !btn) return;
    const isOpen = cont.classList.contains("open");
    ["cr1", "cr2", "cr3"].forEach((k) => {
        const c = document.getElementById(`rooms-${k}`);
        const b = document.getElementById(`exp-${k}`);
        if (c) c.classList.remove("open");
        if (b) b.classList.remove("open");
    });
    const willExpand = !isOpen;
    if (willExpand) {
        cont.classList.add("open");
        btn.classList.add("open");
    }

    /** Control room tidak membuka panel kanan — hanya submenu + penanda nav */
    if (willExpand) {
        stopPlcEcho();
        updateRoomPlcStrip(null);
        if (ui.lv) {
            clearInterval(ui.lv);
            ui.lv = null;
        }
        ui.curRoomId = null;
        ui.curId = null;
        ui.panelMode = "none";
        document.getElementById("rpanel").classList.remove("open");
        document.querySelectorAll(".room-item").forEach((el) => el.classList.remove("active"));
        ["cr1", "cr2", "cr3"].forEach((k) => {
            const nav = document.getElementById(`nav-${k}`);
            if (nav) nav.classList.toggle("active", k === crId);
        });
    } else {
        ["cr1", "cr2", "cr3"].forEach((k) => {
            const nav = document.getElementById(`nav-${k}`);
            if (nav) nav.classList.remove("active");
        });
    }
}

export function openRoomPanel(roomId, crId) {
    const r = findRoom(roomId);
    const crD = store.data[crId];
    if (!r || !crD) return;

    ui.panelMode = "room";
    ui.curRoomId = roomId;
    ui.curId = crId;

    const rp = document.getElementById("rpanel");
    const col = r.col || "#059652";
    document.getElementById("rp-accent").style.background = col;
    rp.style.setProperty("--ra", col);

    const titleEl = document.getElementById("rp-title");
    if (titleEl) titleEl.textContent = r.nm || "—";

    updateRoomPlcStrip(r);

    renderRoomPanelPanes(r, crId);
    swTab("o");
    rp.classList.add("open");

    ["cr1", "cr2", "cr3"].forEach((k) => {
        const nav = document.getElementById(`nav-${k}`);
        if (nav) nav.classList.remove("active");
    });
    const navCr = document.getElementById(`nav-${crId}`);
    if (navCr) navCr.classList.add("active");
    document
        .querySelectorAll(".room-item")
        .forEach((el) => el.classList.remove("active"));
    const ri = document.getElementById(`ri-${roomId}`);
    if (ri) ri.classList.add("active");

    if (typeof window.__syncDemoRoofSelect === "function") {
        window.__syncDemoRoofSelect(roomId);
    }

    const cont = document.getElementById(`rooms-${crId}`);
    const btn = document.getElementById(`exp-${crId}`);
    if (cont && btn) {
        cont.classList.add("open");
        btn.classList.add("open");
    }

    bindPlcEchoForRoom(r);

    if (ui.lv) clearInterval(ui.lv);
    ui.lv = setInterval(async () => {
        if (ui.panelMode !== "room" || !ui.curRoomId) return;
        await refreshCurrentRoomFromApi();
        const crIdCur = findCR(ui.curRoomId);
        const rr = findRoom(ui.curRoomId);
        if (!rr) return;
        renderRoomPanelPanes(rr, crIdCur);
        updateAlarmSidebar();
        updateCenterStatusBar();
    }, pollIntervalRoomMs());
}

/** Hanya membuka submenu control room di sidebar (panel kanan untuk CR tidak dipakai). */
export function openPanel(id) {
    if (!store.data[id]) return;
    toggleRooms(id);
}

export function closePanel() {
    stopPlcEcho();
    updateRoomPlcStrip(null);
    const tEl = document.getElementById("rp-title");
    if (tEl) tEl.textContent = "—";
    document.getElementById("rpanel").classList.remove("open");
    ui.curId = null;
    ui.curRoomId = null;
    ui.panelMode = "none";
    if (ui.lv) {
        clearInterval(ui.lv);
        ui.lv = null;
    }
    ["cr1", "cr2", "cr3"].forEach((k) => {
        const nav = document.getElementById(`nav-${k}`);
        if (nav) nav.classList.remove("active");
    });
    document.querySelectorAll(".room-item").forEach((el) => el.classList.remove("active"));
}

/** Control room — hanya tekanan saluran */
export function renderSensor(id) {
    const el = document.getElementById("pane-o");
    if (!el) return;
    const d = store.data[id];
    const p = d.line_pressure ?? 0;
    el.innerHTML = `
  <div class="rp-sec">Line pressure</div>
  <div class="mc-grid">
    <div class="mc P" style="grid-column:1/-1">
      <div class="mc-lbl">LINE PRESSURE (bar)</div>
      <div class="mc-val">${typeof p === "number" ? p.toFixed(2) : p}</div>
      <div class="mc-st ok">NORMAL</div>
    </div>
  </div>
  <div style="margin-top:10px;font-family:var(--M);font-size:9px;color:var(--dim);text-align:right">
    Update: <span style="color:var(--ok)">${new Date().toLocaleTimeString("en-GB")}</span>
  </div>`;
}

/** Control room — satu switch door lock area */
export function renderLock(id) {
    const el = document.getElementById("pane-o");
    if (!el) return;
    const d = store.data[id];
    const locked = d.door_lock === "locked";
    el.innerHTML = `
  <div class="rp-sec">SWITCH DOOR LOCK</div>
  <div class="lk-item">
    <i class="ti ${locked ? "ti-lock" : "ti-lock-open"} lk-ico" style="color:${locked ? "var(--ok)" : "var(--cr)"}"></i>
    <div style="flex:1">
      <div class="lk-name">Control room area / test access</div>
      <div class="lk-time">Switch ${locked ? "locked" : "open"}</div>
    </div>
    <div class="lk-badge ${locked ? "lk" : "ul"}">${locked ? "LOCKED" : "OPEN"}</div>
  </div>`;
}

export function renderEvents(id) {
    const d = store.data[id];
    let h = `<div class="rp-sec">Latest log</div>`;
    d.events.forEach((e) => {
        h += `<div class="ev-row">
      <div class="ev-t">${e.t}</div>
      <div class="ev-d ${e.c}"></div>
      <div class="ev-m">${e.m}</div>
    </div>`;
    });
    document.getElementById("pane-e").innerHTML = h;
}

export function swTab(n) {
    ["o", "e"].forEach((t) => {
        const tab = document.getElementById(`tab-${t}`);
        const pane = document.getElementById(`pane-${t}`);
        if (tab) tab.classList.remove("on");
        if (pane) pane.style.display = "none";
    });
    const activeTab = document.getElementById(`tab-${n}`);
    const activePane = document.getElementById(`pane-${n}`);
    if (activeTab) activeTab.classList.add("on");
    if (activePane) activePane.style.display = "block";
}

function pushAlarm(out, lv, nm, sub, crId, roomId) {
    out.push({ lv, nm, sub, crId, roomId, time: getNow() });
}

/** Motor fail (PLC / simulasi). */
export function getSidebarAlarms() {
    const out = [];
    for (const [crId, d] of Object.entries(store.data)) {
        for (const r of d.rooms) {
            const nm = `${r.nm}`;
            if (r.dual_motor) {
                if (r.alarm_left_motor)
                    pushAlarm(out, "cr", nm, "LEFT MOTOR FAIL", crId, r.id);
                if (r.alarm_right_motor)
                    pushAlarm(out, "cr", nm, "RIGHT MOTOR FAIL", crId, r.id);
            } else if (r.alarm_motor) {
                pushAlarm(out, "wa", nm, "MOTOR FAIL", crId, r.id);
            }
        }
    }
    return out;
}

/** Emergency dari holding register #40002 (`alarm_alert`). */
function getSidebarEmergencyAlerts() {
    const out = [];
    for (const [crId, d] of Object.entries(store.data)) {
        for (const r of d.rooms) {
            if (plcRegistersTrusted(r) && r.alarm_emergency)
                pushAlarm(out, "cr", `${r.nm}`, "EMERGENCY", crId, r.id);
        }
    }
    return out;
}

/** #40001 — tekanan masuk sebelum testing dimulai. */
function getSidebarPressureInAlerts() {
    const out = [];
    for (const [crId, d] of Object.entries(store.data)) {
        for (const r of d.rooms) {
            if (hasInletPressureAlarm(r))
                pushAlarm(out, "wa", `${r.nm}`, "ALARM PRESSURE", crId, r.id);
        }
    }
    return out;
}

/** Satu daftar sidebar: emergency, pressure in, lalu motor. */
export function getSidebarCombinedAlerts() {
    return [
        ...getSidebarEmergencyAlerts(),
        ...getSidebarPressureInAlerts(),
        ...getSidebarAlarms(),
    ];
}

export function getNow() {
    return new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function updateAlarmSidebar() {
    const combined = getSidebarCombinedAlerts();
    const count = combined.length;
    const ac = document.getElementById("al-count");
    if (ac) {
        ac.textContent = String(count);
        ac.className =
            "alarm-count " +
            (count > 0
                ? combined.some((a) => a.lv === "cr")
                    ? ""
                    : "wa"
                : "ok");
    }
    const list = document.getElementById("al-list");
    if (!count) {
        list.innerHTML = `<div class="al-empty-row"><i class="ti ti-circle-check"></i>No active alarms</div>`;
    } else {
        list.innerHTML = combined
            .map((a) => {
                const click =
                    a.roomId && a.crId
                        ? ` onclick="openRoomPanel('${a.roomId}','${a.crId}')"`
                        : "";
                return `
      <div class="al-row"${click}>
        <div class="al-bar ${a.lv}"></div>
        <div class="al-txt"><div class="al-name">${a.nm}</div><div class="al-sub al-sub--type">${a.sub}</div></div>
        <div class="al-time">${a.time}</div>
      </div>`;
            })
            .join("");
    }

    updateCenterStatusBar();

    document.getElementById("hkpi-alarm").textContent = count;
    document.getElementById("hkpi-alarm-dot").style.background =
        count > 0
            ? combined.some((a) => a.lv === "cr")
                ? "var(--cr)"
                : "var(--wa)"
            : "var(--ok)";
    let active = 0;
    Object.values(store.data).forEach((d) =>
        d.rooms.forEach((r) => {
            if (r.st === "ACTIVE" || r.st === "OPERATIONAL") active++;
        }),
    );
    document.getElementById("hkpi-active").textContent = active;
}

export function updateUtilSidebar() {
    const el = document.getElementById("hkpi-pwr");
    if (el && store.util?.listrik)
        el.textContent = `${store.util.listrik.total_kw.toFixed(0)} kW`;
}

/** Dulu memuat animasi angka acak untuk mode dummy; sekarang tidak mengubah data (hindari “random” di UI). */
export function tickRoom() {}

export function tickUtil() {}

function extractSnapshotValue(snapshot, keys, fallback = null) {
    for (const key of keys) {
        const node = snapshot?.[key];
        if (node && typeof node === "object" && "value" in node) {
            return node.value;
        }
    }
    return fallback;
}

/** Hentikan bit emergency / tekanan dari snapshot cache bila tidak ada data baru dari PLC. */
function clearLiveSnapshotFields(room) {
    room.alarm_emergency = false;
    room.alarm_pressure_in = false;
    room.pres_in = 0;
    room.pres_2 = 0;
    if (room.tp === "TEST PIT") room.test_pressure = 0;
    else room.pres_bbm = 0;
}

/** Samakan dengan webhook: `success` → online; selain itu jangan percaya register di cache. */
function syncRoomPlcLinkFromPollPayload(room, payload) {
    const s = payload?.status;
    if (s === "success") room.plc_link_status = "online";
    else if (s === "error") room.plc_link_status = "error";
    else if (s === "no_data" || s === "offline" || s === "timeout" || s) room.plc_link_status = "offline";
}

function applySnapshotToRoom(room, snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;

    const plcLive = (room.plc_link_status || "") === "online";

    const rawIn = Number(extractSnapshotValue(snapshot, ["40001", "tekanan_masuk", "line_pressure"], NaN));
    const processPressure = Number(extractSnapshotValue(snapshot, ["40011", "pressure_1"], NaN));
    const pres2 = Number(extractSnapshotValue(snapshot, ["40012", "pressure_2"], NaN));
    const alarmAlert = Boolean(extractSnapshotValue(snapshot, ["40002", "alarm_alert"], false));
    const maintenance = Boolean(extractSnapshotValue(snapshot, ["40003", "mode_maintenance"], false));
    const roofClosed = Boolean(extractSnapshotValue(snapshot, ["40004", "roof_tertutup"], false));
    const roofOpenBit = Boolean(extractSnapshotValue(snapshot, ["40005", "roof_terbuka"], false));
    const roofMovingOpen = Boolean(
        extractSnapshotValue(snapshot, ["40006", "roof_bergerak_buka"], false),
    );
    const roofMovingClose = Boolean(
        extractSnapshotValue(snapshot, ["40007", "roof_bergerak_tutup"], false),
    );
    const doorLocked = Boolean(
        extractSnapshotValue(snapshot, ["40008", "pintu_terkunci", "door_locked"], false),
    );
    if (!Number.isNaN(rawIn)) {
        const bar = rawIn > 50 ? rawIn / 100 : rawIn;
        room.pres_in = +bar.toFixed(2);
    }
    const testingOn = Boolean(
        extractSnapshotValue(snapshot, ["40009", "testing_dimulai", "testing_running"], false),
    );
    if (!Number.isNaN(processPressure)) {
        if (room.tp === "TEST PIT") room.test_pressure = +processPressure.toFixed(2);
        else room.pres_bbm = +processPressure.toFixed(2);
    }
    if (!Number.isNaN(pres2)) room.pres_2 = +pres2.toFixed(2);

    room.reg_roof_open = roofOpenBit;
    room.reg_roof_closed = roofClosed;
    room.roof_moving_open = roofMovingOpen;
    room.roof_moving_close = roofMovingClose;

    if (roofOpenBit) room.roof_state = "OPEN";
    else if (roofClosed) room.roof_state = "CLOSE";
    else if (roofMovingOpen) room.roof_state = "OPEN";
    else if (roofMovingClose) room.roof_state = "CLOSE";
    else room.roof_state = "CLOSE";

    /* Hanya percaya register PLC jika ruang bertanda online (hindari cache lama saat putus). */
    room.alarm_emergency = plcLive && alarmAlert;
    room.mode = maintenance ? "MAINTENANCE" : "AUTO";
    room.door_lock = doorLocked ? "locked" : "unlocked";
    room.phase = testingOn ? "RUNNING" : "STANDBY";
    /* #40001: tekanan masuk sebelum testing — alarm jika ada tekanan (> 0) saat #40009 belum ON. */
    const presInBar = Number(room.pres_in ?? 0);
    room.alarm_pressure_in = plcLive && presInBar > 0 && !testingOn;
}

async function refreshCurrentRoomFromApi() {
    if (isRefreshingRoom || !ui.curRoomId) return;
    const room = findRoom(ui.curRoomId);
    if (!room || !room.api_room_id) return;

    isRefreshingRoom = true;
    try {
        const payload = await PlcAPI.getRoomData(room.api_room_id);
        if (payload && typeof payload === "object") syncRoomPlcLinkFromPollPayload(room, payload);

        if (payload?.data && typeof payload.data === "object" && payload.status === "success") {
            applySnapshotToRoom(room, payload.data);
        } else {
            clearLiveSnapshotFields(room);
        }
    } catch (err) {
        console.warn("[Realtime] room polling gagal:", err?.message || err);
        room.alarm_emergency = false;
        room.alarm_pressure_in = false;
    } finally {
        isRefreshingRoom = false;
    }
}

async function refreshDashboardFromApi() {
    if (isRefreshingDashboard) return;
    isRefreshingDashboard = true;
    try {
        const payload = await getDashboardData();
        if (payload?.controlRooms) {
            store.data = payload.controlRooms;
            Object.keys(ROOM_TO_CR).forEach((key) => delete ROOM_TO_CR[key]);
            buildSidebarRooms();
            updateUtilSidebar();
            updateCenterStatusBar();
        }
    } catch (err) {
        console.warn("[Realtime] dashboard refresh gagal:", err?.message || err);
    } finally {
        isRefreshingDashboard = false;
    }
}

export function startLiveLoop() {
    const useDummy = import.meta.env.VITE_DASHBOARD_USE_DUMMY === "true";

    setInterval(async () => {
        if (useDummy) {
            /* Dummy statis dari getDashboardData — tanpa random walk per frame. */
        } else {
            await refreshDashboardFromApi();
            if (ui.panelMode === "room") await refreshCurrentRoomFromApi();
        }

        updateAlarmSidebar();
        updateUtilSidebar();
        updateCenterStatusBar();
        if (ui.curRoomId && ui.panelMode === "room") {
            const crId = findCR(ui.curRoomId);
            const room = findRoom(ui.curRoomId);
            if (room && crId) renderRoomPanelPanes(room, crId);
        }
    }, pollIntervalGlobalMs());
}

export function toggleSidebar() {
    const sb = document.getElementById("lsb"),
        ov = document.getElementById("overlay");
    const open = sb.classList.toggle("open");
    ov.style.display = "block";
    setTimeout(() => (ov.style.opacity = open ? "1" : "0"), 10);
    if (!open) setTimeout(() => (ov.style.display = "none"), 300);
}

export function closeSidebar() {
    document.getElementById("lsb").classList.remove("open");
    const ov = document.getElementById("overlay");
    ov.style.opacity = "0";
    setTimeout(() => (ov.style.display = "none"), 300);
}

export function initClock() {
    const tick = () => {
        const n = new Date(),
            p = (v) => String(v).padStart(2, "0");
        document.getElementById("clk").textContent =
            `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
        setTimeout(tick, 1000);
    };
    tick();
}

export function initLogoFallback() {
    const img = document.querySelector(".logo-img");
    const fb = document.querySelector(".logo-fallback");
    if (!img || !fb) return;
    img.addEventListener("error", () => {
        img.classList.add("is-broken");
        fb.classList.add("is-visible");
    });
}

export function initOptionalTabs() {}

export function registerGlobals() {
    window.toggleSidebar = toggleSidebar;
    window.closeSidebar = closeSidebar;
    window.openPanel = openPanel;
    window.openRoomPanel = openRoomPanel;
    window.closePanel = closePanel;
    window.swTab = swTab;
    window.toggleRooms = toggleRooms;
    window.ackDummyRoomAlarm = ackDummyRoomAlarm;
    window.applyDummyRoofPreset = applyDummyRoofPreset;
    window.setDummyPressure = setDummyPressure;
    window.setDummyPanelMode = setDummyPanelMode;
    window.setDummyTestStatus = setDummyTestStatus;
    window.setDummyDoorLock = setDummyDoorLock;
    window.setDummyEmergency = setDummyEmergency;
    window.setDummyPlcStatus = setDummyPlcStatus;
    window.triggerDummyAlarm = triggerDummyAlarm;
}
