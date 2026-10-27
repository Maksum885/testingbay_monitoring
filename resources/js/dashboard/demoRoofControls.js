import { store, ui } from "./state.js";

function dummyDashboardEnabled() {
    return import.meta.env.VITE_DASHBOARD_USE_DUMMY === "true";
}

function collectRooms() {
    const list = [];
    for (const d of Object.values(store.data)) {
        for (const r of d.rooms || []) {
            list.push({ id: r.id, nm: r.nm || r.id });
        }
    }
    list.sort((a, b) => a.nm.localeCompare(b.nm, undefined, { numeric: true }));
    return list;
}

/**
 * Panel demo atap (hanya admin + VITE_DASHBOARD_USE_DUMMY=true).
 * @param {{ findRoom: Function, findCR: Function, renderRoomPanelPanes: Function, applyDummyRoofPreset: Function }} main
 */
export function initDemoRoofControls(main) {
    if (!dummyDashboardEnabled()) return;

    const mapEl = document.getElementById("dash-map");
    if (!mapEl) return;

    const panel = document.createElement("div");
    panel.id = "dash-demo-roof";
    panel.className = "dash-demo-roof";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Demo roof control");
    panel.innerHTML = `
      <div class="dash-demo-roof__head">
        <i class="ti ti-tool" aria-hidden="true"></i>
        <span class="dash-demo-roof__title">Demo roof</span>
        <span class="dash-demo-roof__badge">Dummy data</span>
      </div>
      <label class="dash-demo-roof__label" for="dash-demo-roof-room">Room</label>
      <select id="dash-demo-roof-room" class="dash-demo-roof__select"></select>
      <div class="dash-demo-roof__actions">
        <button type="button" class="dash-demo-roof__btn" data-preset="close">Close</button>
        <button type="button" class="dash-demo-roof__btn" data-preset="open">Open</button>
      </div>
    `;
    mapEl.appendChild(panel);

    const selectEl = panel.querySelector("#dash-demo-roof-room");

    function fillRoomOptions() {
        const rooms = collectRooms();
        const prev = selectEl.value;
        selectEl.innerHTML = rooms
            .map((r) => `<option value="${r.id}">${r.nm}</option>`)
            .join("");
        if (prev && rooms.some((r) => r.id === prev)) selectEl.value = prev;
        else if (ui.curRoomId && rooms.some((r) => r.id === ui.curRoomId)) selectEl.value = ui.curRoomId;
        else if (rooms.length) selectEl.value = rooms[0].id;
    }

    function refreshRoomPanelIfOpen(roomId) {
        if (ui.panelMode !== "room" || ui.curRoomId !== roomId) return;
        const room = main.findRoom(roomId);
        const crId = main.findCR(roomId);
        if (room && crId) main.renderRoomPanelPanes(room, crId);
    }

    function onPreset(presetKey) {
        const roomId = selectEl.value;
        main.applyDummyRoofPreset(roomId, presetKey);
        refreshRoomPanelIfOpen(roomId);
    }

    panel.querySelectorAll("[data-preset]").forEach((btn) => {
        btn.addEventListener("click", () => onPreset(btn.getAttribute("data-preset")));
    });

    selectEl.addEventListener("change", () => {
        if (ui.curRoomId === selectEl.value) refreshRoomPanelIfOpen(selectEl.value);
    });

    fillRoomOptions();

    window.__syncDemoRoofSelect = (roomId) => {
        if (!roomId || !selectEl) return;
        if ([...selectEl.options].some((o) => o.value === roomId)) selectEl.value = roomId;
    };
}
