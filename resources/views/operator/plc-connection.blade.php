<!DOCTYPE html>
<html lang="en" class="settings-html">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Settings — SPM SCADA</title>
@vite(['resources/css/dashboard.css', 'resources/js/profile-menu.js'])
</head>
<body class="settings-app">
<header class="dash-topbar hdr settings-app__hdr">
  <a href="{{ route('dashboard') }}" class="dash-brand logo settings-app__brand" title="Back to dashboard">
    <img src="{{ asset('images/logospm1.png') }}" alt="SPM Oil &amp; Gas" class="logo-img">
  </a>
  <div class="hdr-r dash-topbar-actions settings-app__hdr-actions">
    @include('partials.profile-menu')
  </div>
</header>

<main class="settings-layout">
  <div class="admin-page-head admin-page-head--stack">
    <div>
      <h1 class="settings-page-title">Settings</h1>
      <p class="settings-page-lead">Manage how each test room talks to its PLC. Changes here are saved to the server only.</p>
    </div>
    <div class="admin-page-head-actions">
      <a href="{{ route('dashboard') }}" class="admin-btn admin-btn--ghost">
        <i class="ti ti-arrow-left" aria-hidden="true"></i> Back to dashboard
      </a>
    </div>
  </div>

  <section class="settings-section" aria-labelledby="plc-heading">
    <h2 id="plc-heading" class="settings-section-title"><i class="ti ti-plug-connected" aria-hidden="true"></i> PLC connection</h2>

    @if (session('status'))
      <div class="settings-flash" role="status">{{ session('status') }}</div>
    @endif

    @if ($devices->isEmpty())
      <p class="settings-empty">No PLC devices found. Run <code>php artisan db:seed</code> or add rooms in the database.</p>
    @else
      @foreach ([
        'pit' => ['label' => 'Test pits', 'icon' => 'ti-box-multiple'],
        'cell' => ['label' => 'Test cells', 'icon' => 'ti-building'],
        'other' => ['label' => 'Other rooms', 'icon' => 'ti-layout-grid'],
      ] as $kind => $meta)
        @php $group = $devicesByKind[$kind] ?? collect(); @endphp
        @if ($group->isNotEmpty())
          <h3 class="settings-group-title" id="settings-group-{{ $kind }}">
            <i class="ti {{ $meta['icon'] }}" aria-hidden="true"></i> {{ $meta['label'] }}
            <span class="settings-group-count">{{ $group->count() }}</span>
          </h3>
          <div class="settings-cards-grid">
            @foreach ($group as $d)
              @include('operator.partials.plc-device-card', ['d' => $d, 'highlightRoomId' => $highlightRoomId])
            @endforeach
          </div>
        @endif
      @endforeach
    @endif
  </section>
</main>
@if ($highlightRoomId)
<script>
  document.getElementById("room-{{ $highlightRoomId }}")?.scrollIntoView({ behavior: "smooth", block: "center" });
</script>
@endif
</body>
</html>
