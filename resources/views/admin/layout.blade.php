<!DOCTYPE html>
<html lang="id" class="settings-html admin-html">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>@yield('title', 'Admin') — SPM SCADA</title>
<link rel="icon" type="image/png" href="{{ asset('images/logospm4.png') }}">
@vite(['resources/css/dashboard.css', 'resources/js/profile-menu.js'])
</head>
<body class="settings-app admin-app">
<header class="dash-topbar hdr settings-app__hdr admin-app__hdr">
  <a href="{{ route('dashboard') }}" class="dash-brand logo settings-app__brand" title="Dashboard">
    <img src="{{ asset('images/logospm1.png') }}" alt="SPM Oil &amp; Gas" class="logo-img">
  </a>
  <div class="hdr-r dash-topbar-actions admin-app__hdr-actions">
    @include('partials.profile-menu')
  </div>
</header>

<main class="admin-shell">
  @if (session('status'))
    <div class="admin-flash" role="status">{{ session('status') }}</div>
  @endif
  @if ($errors->any())
    <div class="admin-flash admin-flash--err" role="alert">
      <ul class="admin-flash-list">
        @foreach ($errors->all() as $err)
          <li>{{ $err }}</li>
        @endforeach
      </ul>
    </div>
  @endif
  @yield('content')
</main>
</body>
</html>
