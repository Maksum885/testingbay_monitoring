# Roadmap Penyempurnaan Testing Bay

Dokumen ini merapikan rencana perbaikan agar transisi dari mode simulasi ke mode produksi berjalan aman dan bertahap.

## 1) Security Baseline (prioritas tinggi)

- [x] Tambahkan validasi `PLC_WEBHOOK_SECRET` pada endpoint `POST /api/plc/webhook`.
- [x] Kirim header `X-PLC-Secret` dari service Python (`python-modbus`) jika secret diisi.
- [ ] Tambahkan rate-limit khusus webhook via route middleware terpisah (`throttle:plc-webhook`).
- [ ] Tambahkan allowlist IP untuk host PLC bridge (opsional jika infra mendukung).
- [ ] Batasi akses aplikasi ke jaringan internal (aplikasi single-user tanpa login; semua rute terbuka).

## 2) Data Integrity PLC

- [ ] Standarisasi register map menjadi satu file referensi (`docs/plc-register-map.md`).
- [ ] Terapkan schema validasi item `changes[*]` (register_address, old/new value, register_name).
- [ ] Tandai `poll_status=error` + simpan `error_message` saat polling gagal.
- [ ] Tambahkan mekanisme dedup jika payload yang sama terkirim berulang.

## 3) Realtime & Frontend

- [ ] Ganti loop random `tickRoom()/tickUtil()` dengan polling API room aktif.
- [ ] Tambahkan fallback UI jika snapshot room kosong (`status: no_data`).
- [x] Integrasikan broadcast (Echo/Pusher) — event `PlcRoomUpdated` + subscribe channel `plc.room.{id}` (isi `VITE_PUSHER_*` + `BROADCAST_CONNECTION=pusher`).

## 4) Akses & Audit

- [x] Aplikasi disederhanakan menjadi single-user tanpa login (tabel `users`, Sanctum, middleware role dihapus).
- [x] Fitur kamera / Computer Vision dihapus (folder `camera/`, tabel `room_cameras`, register CV 40010).
- [ ] Tambahkan audit log untuk aksi `ack/resolve alarm` dan perubahan settings PLC.

## 5) Observability & Ops

- [ ] Dashboard health untuk Laravel + Python bridge + koneksi PLC.
- [ ] Structured logging (`request_id`, `room_id`, `poll_status`) di webhook.
- [ ] Job pruning berkala untuk `plc_snapshots` dan `plc_register_logs` (retensi data).
- [ ] Backup strategy untuk database produksi.

## 6) Testing & CI

- [ ] Feature test: webhook valid/invalid secret.
- [ ] Feature test: `AlarmController` ack/resolve.
- [ ] Feature test: halaman settings PLC (index/update).
- [ ] Unit test: mapping payload `PlcDataService`.

## 7) Deployment Plan Bertahap

1. Stabilkan security baseline + test.
2. Aktifkan polling PLC nyata di Python.
3. Migrasi UI dari dummy/random ke API room aktif.
4. Aktifkan broadcast realtime.
5. Terapkan pruning + monitoring produksi.
