{{-- Single-user, tanpa login: menu pengaturan dengan akses ke semua menu. --}}
<div class="dash-profile-wrap" id="dash-profile-wrap">
  <button type="button" class="dash-profile-btn" id="dash-profile-trigger" aria-expanded="false" aria-haspopup="true" aria-controls="dash-profile-dd">
    <span class="dash-profile-avatar" aria-hidden="true"><i class="ti ti-settings"></i></span>
    <span class="dash-profile-meta">
      <span class="dash-profile-name">Settings</span>
    </span>
    <i class="ti ti-chevron-down dash-profile-chevron" aria-hidden="true"></i>
  </button>
  <div class="dash-profile-dd" id="dash-profile-dd" role="menu" aria-labelledby="dash-profile-trigger">
    <div class="dash-profile-dd-head">Configuration</div>
    <a href="{{ route('settings.plc') }}" class="dash-profile-dd-item" role="menuitem">
      <i class="ti ti-plug-connected" aria-hidden="true"></i>
      <span><strong>PLC configuration</strong><small>IP, port, devices</small></span>
    </a>
    <a href="{{ route('settings.plc-log') }}" class="dash-profile-dd-item" role="menuitem">
      <i class="ti ti-history" aria-hidden="true"></i>
      <span><strong>PLC register log</strong><small>Value change history</small></span>
    </a>
  </div>
</div>
