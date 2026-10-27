/** Mutable runtime store; filled by getDashboardData(). */
export const store = {
    data: {},
    util: {},
};

/** Sidebar: room id → parent control room id */
export const ROOM_TO_CR = {};

export const ui = {
    hov: null,
    mdx: 0,
    mdy: 0,
    curId: null,
    curRoomId: null,
    panelMode: "none",
    lv: null,
};
