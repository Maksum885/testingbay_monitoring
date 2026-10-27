# ERD — Testing Bay Monitoring

Diagram relasi entitas (ERD) database **SQL Server** aplikasi Testing Bay, disusun dari file migrasi di `database/migrations/` dan relasi Eloquent di `app/Models/`. Bagian akhir berisi **rekomendasi penamaan**; skema dan kode belum diubah.

---

## 1. ERD tabel inti (operasional)

```mermaid
erDiagram
  control_rooms ||--o{ testing_rooms : "memiliki"
  testing_rooms ||--o{ plc_devices : "dipasangi"
  plc_devices   ||--o{ plc_register_logs : "mencatat"
  plc_devices   ||--o{ plc_snapshots : "menghasilkan"
  plc_devices   ||--o{ alarm_logs : "memicu"
  testing_rooms ||--o{ plc_register_logs : "lokasi"
  testing_rooms ||--o{ plc_snapshots : "lokasi"
  testing_rooms ||--o{ alarm_logs : "lokasi"
  control_rooms ||--o{ plc_register_logs : "lokasi (denormalisasi)"
  control_rooms ||--o{ alarm_logs : "lokasi (denormalisasi)"

  control_rooms {
    bigint id PK
    string name "Control Room 1"
    string code UK "CR1"
    string description "nullable"
    boolean is_active "default true"
    timestamp created_at
    timestamp updated_at
  }

  testing_rooms {
    bigint id PK
    bigint control_room_id FK "cascade on delete"
    string name "Test Cell 1 / Test Pit 1"
    string code UK "TC1 / TP1"
    enum type "cell | pit"
    boolean is_active "default true"
    timestamp created_at
    timestamp updated_at
  }

  plc_devices {
    bigint id PK
    bigint testing_room_id FK "cascade on delete"
    string name "PLC Test Pit 1"
    string ip_address
    int port "default 502"
    int unit_id "default 1"
    boolean is_enabled "default true"
    enum status "online | offline | error"
    timestamp last_seen_at "nullable"
    timestamp created_at
    timestamp updated_at
  }

  plc_register_logs {
    bigint id PK
    bigint plc_device_id FK "nullable"
    bigint testing_room_id FK "nullable"
    bigint control_room_id FK "nullable"
    int register_address "40001 ... 40012"
    string register_name "alarm_alert"
    string register_description
    int old_value "nullable"
    int new_value
    string decoded_value "nullable"
    enum change_type "status_change, value_change, ..."
    timestamp occurred_at
    timestamp created_at
    timestamp updated_at
  }

  plc_snapshots {
    bigint id PK
    bigint plc_device_id FK "nullable"
    bigint testing_room_id FK "nullable"
    json register_values "semua register satu polling"
    enum poll_status "success | timeout | error"
    string error_message "nullable"
    timestamp polled_at
  }

  alarm_logs {
    bigint id PK
    bigint plc_device_id FK "nullable"
    bigint testing_room_id FK "nullable"
    bigint control_room_id FK "nullable"
    string alarm_code "ALARM_ALERT"
    string alarm_description
    enum severity "info | warning | critical"
    enum status "active | acknowledged | resolved"
    timestamp triggered_at
    timestamp acknowledged_at "nullable"
    timestamp resolved_at "nullable"
    timestamp created_at
    timestamp updated_at
  }
```

### Kardinalitas

| Relasi | Jenis | Catatan |
| --- | --- | --- |
| `control_rooms` → `testing_rooms` | 1 : N | Hapus control room ikut menghapus testing room-nya (cascade) |
| `testing_rooms` → `plc_devices` | 1 : N (praktiknya 1 : 1) | Seeder membuat tepat 1 PLC per ruang, tapi skema tidak memaksa (tidak ada unique) |
| `plc_devices` → `plc_register_logs` / `plc_snapshots` / `alarm_logs` | 1 : N | FK nullable, `no action` saat dihapus |
| `testing_rooms` → log, snapshot, alarm | 1 : N | FK nullable |
| `control_rooms` → `plc_register_logs` / `alarm_logs` | 1 : N | Denormalisasi: bisa diturunkan dari `testing_rooms.control_room_id`, disimpan untuk query cepat |

### Data hasil seeder

| Tabel | Jumlah | Isi |
| --- | --- | --- |
| `control_rooms` | 3 | CR1 (Cell 1–3), CR2 (Cell 4–5, Pit 1–2), CR3 (Pit 3–6) |
| `testing_rooms` | 11 | 5 test cell + 6 test pit |
| `plc_devices` | 11 | Satu per testing room |

---

## 2. Data yang tidak disimpan di tabel

| Data | Lokasi | Keterangan |
| --- | --- | --- |
| Snapshot PLC terbaru per ruang | Cache `plc_snapshot_{testing_room_id}` | Ditulis webhook, dibaca `/api/dashboard` dan `/api/plc/{id}/data` |
| Label register PLC | `config/plc_registers.php` | Nama & deskripsi register untuk log |
| Peta register Modbus | `python-modbus/modbus/register_map.py` | Alamat 40001–40012 → key + tipe |

---

## 3. Tabel pendukung Laravel (tanpa relasi ke tabel inti)

```mermaid
erDiagram
  sessions {
    string id PK
    bigint user_id "nullable, selalu null (tanpa login)"
    string ip_address "nullable"
    text user_agent "nullable"
    longtext payload
    int last_activity
  }
  cache {
    string key PK
    mediumtext value
    int expiration
  }
  cache_locks {
    string key PK
    string owner
    int expiration
  }
  jobs {
    bigint id PK
    string queue
    longtext payload
    tinyint attempts
    int reserved_at "nullable"
    int available_at
    int created_at
  }
```

`sessions.user_id` tidak punya tabel `users` sebagai pasangan. Kolom ini tetap diperlukan karena handler session database Laravel selalu menulisnya.

---

## 4. Rekomendasi penamaan (belum diterapkan)

Daftar ini untuk keputusan berikutnya. Semua perubahan skema di bawah membutuhkan migrasi baru dan penyesuaian kode.

### 4.1 Tabel & kolom

| Saat ini | Usulan | Alasan |
| --- | --- | --- |
| `testing_rooms`, `testing_room_id`, model `TestingRoom` | `test_rooms`, `test_room_id`, `TestRoom` | Domain memakai istilah "Test Cell / Test Pit"; filter API sudah memakai `test_cell_id` |
| Filter API `test_cell_id` (alarm, activity log) | `test_room_id` | Filter juga berlaku untuk test pit, bukan hanya test cell |
| `alarm_logs.alarm_code`, `alarm_logs.alarm_description` | `code`, `description` | Prefix `alarm_` berulang dengan nama tabel |
| `plc_snapshots.register_values` | `registers` | Lebih ringkas, sama dengan istilah payload webhook (`snapshot`) |
| `plc_register_logs.change_type` = `door_locked` untuk kunci **dan** buka | Tambah `door_unlocked` | Nilai saat ini menyesatkan ketika pintu dibuka |

### 4.2 Kode & struktur file

| Saat ini | Usulan | Alasan |
| --- | --- | --- |
| `ActivityLogController` (Web & Api), `ActivityLogService` | `PlcRegisterLogController`, `PlcRegisterLogService` | Isinya log register PLC, sesuai menu "PLC register log" |
| `resources/views/admin/…`, `resources/views/operator/…` | `resources/views/settings/…` | Peran admin/operator sudah tidak ada |
| `resources/js/services/authService.js` | `apiClient.js` | Tidak ada autentikasi lagi; isinya helper `fetch` |
| `api_room_id` (JS) | `db_id` atau `test_room_id` | `id` di frontend berupa `cell1`/`pit1`; nama ini menjelaskan bahwa nilainya ID database |

### 4.3 Key register PLC (campuran bahasa)

| Address | Saat ini | Usulan |
| --- | --- | --- |
| 40001 | `tekanan_masuk` | `inlet_pressure` |
| 40004 | `roof_tertutup` | `roof_closed` |
| 40005 | `roof_terbuka` | `roof_open` |
| 40006 | `roof_bergerak_buka` | `roof_opening` |
| 40007 | `roof_bergerak_tutup` | `roof_closing` |
| 40008 | `pintu_terkunci` | `door_locked` |
| 40009 | `testing_dimulai` | `test_running` |

Key ini dipakai bersama oleh `python-modbus`, `config/plc_registers.php`, dan `resources/js/dashboard/main.js`, dan tersimpan di `plc_register_logs.register_name` serta `plc_snapshots.register_values`. Jika diganti, data log lama tetap memakai key lama.

### 4.4 Relasi Eloquent yang belum ada

Tidak mengubah skema, aman ditambahkan kapan saja:

- `TestingRoom::plcRegisterLogs()` — hasMany `PlcRegisterLog`.
- `ControlRoom::alarmLogs()` dan `ControlRoom::plcRegisterLogs()` — hasMany.
- Opsional: ganti `TestingRoom::plcDevices()` menjadi `hasOne` (`plcDevice()`) dan tambahkan unique index pada `plc_devices.testing_room_id` jika memang selalu 1 PLC per ruang.
