@extends('admin.layout')

@section('title', 'PLC register log')

@section('content')
<div class="admin-page">
  <div class="admin-page-head">
    <div>
      <h1 class="admin-page-title">PLC register log</h1>
      <p class="admin-page-lead">History of register value changes from the bridge. Optional filters by room or change type.</p>
    </div>
    <div class="admin-page-head-actions">
      <a href="{{ route('dashboard') }}" class="admin-btn admin-btn--ghost">
        <i class="ti ti-arrow-left" aria-hidden="true"></i> Back to dashboard
      </a>
    </div>
  </div>

  <form method="GET" action="{{ route('settings.plc-log') }}" class="admin-filters admin-card">
    <div class="admin-filters-grid">
      <div class="admin-field">
        <label for="testing_room_id">Test room</label>
        <select id="testing_room_id" name="testing_room_id" onchange="this.form.submit()">
          <option value="">All</option>
          @foreach ($rooms as $tr)
            <option value="{{ $tr->id }}" @selected((string) request('testing_room_id') === (string) $tr->id)>
              {{ $tr->controlRoom->code ?? '' }} · {{ $tr->name }}
            </option>
          @endforeach
        </select>
      </div>
      <div class="admin-field">
        <label for="change_type">Change type</label>
        <select id="change_type" name="change_type" onchange="this.form.submit()">
          <option value="">All</option>
          @foreach ($changeTypes as $ct)
            <option value="{{ $ct }}" @selected(request('change_type') === $ct)>{{ $ct }}</option>
          @endforeach
        </select>
      </div>
    </div>
  </form>

  <div class="admin-table-wrap admin-mt">
    <table class="admin-table admin-table--compact">
      <thead>
        <tr>
          <th>Time</th>
          <th>Room</th>
          <th>Register</th>
          <th>Value</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        @forelse ($logs as $log)
          <tr>
            <td class="admin-nowrap">{{ $log->occurred_at?->timezone(config('app.timezone'))->format('Y-m-d H:i:s') }}</td>
            <td>{{ $log->testingRoom->name ?? '—' }}</td>
            <td class="admin-table-sub">{{ \Illuminate\Support\Str::limit($log->displayRegisterLabel(), 56) }}</td>
            <td class="admin-table-sub">
              @if($log->old_value !== null || $log->new_value !== null)
                <span class="admin-mono">{{ $log->old_value }} → {{ $log->new_value }}</span>
              @elseif($log->decoded_value !== null)
                <span class="admin-mono">{{ is_array($log->decoded_value) ? json_encode($log->decoded_value) : $log->decoded_value }}</span>
              @else
                —
              @endif
            </td>
            <td><span class="admin-pill admin-pill--muted">{{ $log->change_type ?? '—' }}</span></td>
          </tr>
        @empty
          <tr>
            <td colspan="5" class="admin-table-empty">No log entries yet.</td>
          </tr>
        @endforelse
      </tbody>
    </table>
  </div>

  <div class="admin-pagination">
    {{ $logs->links('vendor.pagination.admin') }}
  </div>
</div>
@endsection
