<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Testing Bay</title>
<link rel="icon" type="image/png" href="{{ asset('images/logospm4.png') }}">
@vite(['resources/css/dashboard.css', 'resources/js/app.js'])
</head>
<body class="scada-dashboard">
<div class="dash-wrap">
  <header class="dash-topbar hdr" id="dash-topbar">
    <div class="dash-brand logo">
      <img src="{{ asset('images/logospm1.png') }}" alt="SPM Oil &amp; Gas" class="logo-img">
    </div>
    <div class="hdr-r dash-topbar-actions">
      <div class="clk dash-clock" id="clk">00:00:00</div>
      @include('partials.profile-menu')
      <button type="button" class="ham" onclick="toggleSidebar()"><i class="ti ti-menu-2"></i></button>
    </div>
  </header>

  <div class="dash-main">
    <aside class="dash-sidebar lsb" id="lsb">
      <div class="lscroll dash-sidebar-scroll">
        <div class="dash-sidebar-section">Monitoring Area</div>
        <div class="dash-sidebar-nav dash-sidebar-nav--admin">
        <div class="cr-item active cr-item--ic" id="nav-cr1">
          <div class="cr-info" onclick="openPanel('cr1')">
            <div class="cr-name">Control Room 1</div>
            <div class="cr-sub">Cell 1 · Cell 2 · Cell 3</div>
          </div>
          <button type="button" class="cr-expand-btn" id="exp-cr1" onclick="toggleRooms('cr1')" aria-label="Toggle rooms"><i class="ti ti-chevron-right"></i></button>
        </div>
        <div class="cr-rooms" id="rooms-cr1"></div>

        <div class="cr-item cr-item--ic" id="nav-cr2">
          <div class="cr-info" onclick="openPanel('cr2')">
            <div class="cr-name">Control Room 2</div>
            <div class="cr-sub">Cell 4 · Cell 5 · Pit 1 · Pit 2</div>
          </div>
          <button type="button" class="cr-expand-btn" id="exp-cr2" onclick="toggleRooms('cr2')" aria-label="Toggle rooms"><i class="ti ti-chevron-right"></i></button>
        </div>
        <div class="cr-rooms" id="rooms-cr2"></div>

        <div class="cr-item cr-item--ic" id="nav-cr3">
          <div class="cr-info" onclick="openPanel('cr3')">
            <div class="cr-name">Control Room 3</div>
            <div class="cr-sub">Pit 3 · Pit 4 · Pit 5 · Pit 6</div>
          </div>
          <button type="button" class="cr-expand-btn" id="exp-cr3" onclick="toggleRooms('cr3')" aria-label="Toggle rooms"><i class="ti ti-chevron-right"></i></button>
        </div>
        <div class="cr-rooms" id="rooms-cr3"></div>
        </div>

        <div class="dash-alarm-block">
  <div class="alarm-header dash-alarm-header">
    <div class="alarm-title">
      <i class="ti ti-bell-ringing"></i>
      Active alarms
    </div>

    <div class="alarm-count" id="al-count">
      0
    </div>
  </div>

  <div class="alarm-list dash-alarm-list" id="dash-alarm-scroll">

    <div id="al-list" class="dash-alarm-list-inner">

      <div class="al-empty-msg">
        No active alarms
      </div>

    </div>

  </div>
</div>
    </aside>

    <div class="dash-center">
      <div class="dash-map" id="dash-map">
        <canvas id="cv"></canvas>
        <svg id="lyr-svg"></svg>
        <div class="lyr" id="lyr"></div>
        <div id="tip"></div>
      </div>
    </div>

    <aside class="rpanel dash-rpanel" id="rpanel">
      <div class="rp-accent" id="rp-accent"></div>
      <div class="rp-hdr rp-hdr--detail">
        <div class="rp-hdr-row rp-hdr-row--detail">
          <div class="rp-detail-head">
            <h2 class="rp-title" id="rp-title">—</h2>
          </div>
          <div class="rp-hdr-actions">
            <div id="rp-plc-strip" class="rp-plc-strip is-hidden" aria-live="polite"></div>
            <button type="button" class="rp-close" onclick="closePanel()" title="Close"><i class="ti ti-x"></i></button>
          </div>
        </div>
      </div>
      <div class="rp-tabs rp-tabs--two" id="rp-tabs">
        <div class="rp-tab on" id="tab-o" onclick="swTab('o')">Overview</div>
        <div class="rp-tab" id="tab-e" onclick="swTab('e')">Event log</div>
      </div>
      <div class="rp-body rp-body--scroll">
        <div id="pane-o"></div>
        <div id="pane-e"></div>
      </div>
    </aside>
  </div>
</div>

<div class="overlay" id="overlay" onclick="closeSidebar()"></div>

<div class="toast" id="toast"></div>
<span id="hkpi-alarm" class="dashboard-kpi-hidden"></span>
<span id="hkpi-alarm-dot" class="dashboard-kpi-hidden"></span>
<span id="hkpi-active" class="dashboard-kpi-hidden"></span>
<span id="hkpi-pwr" class="dashboard-kpi-hidden"></span>
</body>
</html>
