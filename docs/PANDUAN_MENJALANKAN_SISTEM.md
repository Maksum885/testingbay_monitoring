# Panduan Menjalankan Sistem Testing Bay (dari awal sampai operasional)

Dokumen ini menjelaskan **tahapan berurutan** untuk menyiapkan lingkungan pengembangan atau produksi hingga semua layanan (Laravel, frontend, bridge Modbus) dapat digunakan bersama PLC.

---

## Ringkasan komponen

| Komponen     | Teknologi                           | Dijalankan di | Fungsi                                                |
| ------------ | ----------------------------------- | ------------- | ----------------------------------------------------- |
| Aplikasi web | Laravel 12 (PHP 8.2+)               | Server PC     | Dashboard, API, penyimpanan data PLC                  |
| Antarmuka    | Vite + JavaScript + Three.js        | Server PC     | Dashboard, peta 3D, settings PLC, log register        |
| Bridge PLC   | Python 3.10+, FastAPI, pymodbus 3.x | Server PC     | Polling Modbus TCP → webhook ke Laravel               |
| Database     | SQL Server                          | Server PC     | Ruang uji, `plc_devices`, log, snapshot, alarm, sesi  |
| PLC          | Schneider M221 TM221CE24R           | Lapangan      | Sensor/aktuator via Modbus TCP port 502               |

Aplikasi bersifat **single-user tanpa login** — tidak ada akun yang perlu dibuat.

---

## Prasyarat perangkat lunak (Server PC)

1. **PHP 8.2 atau lebih baru** — ekstensi: `openssl`, `pdo`, `pdo_sqlsrv`, `sqlsrv`, `mbstring`, `tokenizer`, `xml`, `ctype`, `json`, `fileinfo`, `curl`.
2. **Microsoft ODBC Driver 17/18 for SQL Server** — dibutuhkan oleh `pdo_sqlsrv`.
3. **Composer** — manajer dependensi PHP.
4. **Node.js** (LTS) dan **npm** — untuk Vite dan aset frontend.
5. **Python 3.10+** — untuk `python-modbus/`.
6. **SQL Server** — database utama.
7. **Git** (opsional) — kontrol versi.

### Mengaktifkan driver SQL Server di PHP (Windows)

File DLL `php_sqlsrv_83_nts_x64.dll` dan `php_pdo_sqlsrv_83_nts_x64.dll` (sesuaikan versi PHP, NTS/TS, dan arsitektur) harus ada di folder `ext` PHP. Tambahkan ke `php.ini`:

```ini
extension=sqlsrv_83_nts_x64
extension=pdo_sqlsrv_83_nts_x64
```

Cek dengan `php -m | findstr sqlsrv`. Jika muncul error **`could not find driver`**, berarti langkah ini belum dilakukan.

---

## Tahap 1 — Siapkan file lingkungan Laravel

1. Buka folder root proyek (berisi `artisan`, `composer.json`, `package.json`).
2. Salin file lingkungan:
    ```powershell
    cp .env.example .env
    ```
3. Generate kunci aplikasi:
    ```powershell
    php artisan key:generate
    ```
4. **Database** di `.env` — proyek memakai SQL Server:
    ```env
    DB_CONNECTION=sqlsrv
    DB_HOST=127.0.0.1
    DB_PORT=1433
    DB_DATABASE=db_testingbay_monitoring
    DB_USERNAME=sa
    DB_PASSWORD=YourStrongPassword
    ```
5. Buat database kosong di SQL Server (mis. lewat SSMS):
    ```sql
    CREATE DATABASE db_testingbay_monitoring;
    ```

---

## Tahap 2 — Instal dependensi PHP dan Node

Dari root proyek:

```powershell
composer install
npm install
```

---

## Tahap 3 — Migrasi dan seed database

```powershell
php artisan migrate
php artisan db:seed
```

Untuk menyegarkan total dari nol (**menghapus semua data lama**):

```powershell
php artisan migrate:fresh --seed
```

Seeder membuat **3 control room**, **11 testing room** (Test Cell 1–5, Test Pit 1–6), dan **11 `plc_devices`** (satu per ruang). Tanpa seeder, sidebar dan peta 3D tidak memiliki ruang yang bisa dipilih.

---

## Tahap 4 — Konfigurasi variabel penting Laravel

Tambahkan atau sesuaikan di **`.env`** Laravel (referensi di `.env.example`):

| Variabel                   | Keterangan                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| `APP_URL`                  | URL dasar aplikasi, mis. `http://127.0.0.1:8000`                                  |
| `PLC_BRIDGE_TOKEN`         | Token untuk `GET /api/plc/bridge-devices?token=...`                               |
| `PLC_WEBHOOK_SECRET`       | Jika diisi, webhook Python harus mengirim header `X-PLC-Secret` dengan nilai sama |
| `VITE_DASHBOARD_USE_DUMMY` | `true` = data demo + panel Demo roof (tanpa PLC live)                             |

Setelah mengubah variabel `VITE_*`, jalankan ulang `npm run dev` atau `npm run build`.

**Realtime (opsional):** set `BROADCAST_CONNECTION=pusher` dan isi kunci Pusher/Reverb serta `VITE_PUSHER_*`.

---

## Tahap 5 — Menjalankan server Laravel

```powershell
php artisan serve
```

Default: `http://127.0.0.1:8000`. Jika memakai `QUEUE_CONNECTION=database`, jalankan juga worker antrean di terminal terpisah:

```powershell
php artisan queue:listen --tries=1
```

> **Windows:** `composer run dev` ikut menjalankan `php artisan pail`, yang membutuhkan ekstensi `pcntl` (tidak tersedia di Windows). Karena memakai `--kill-others`, semua proses ikut berhenti. Jalankan `serve`, `queue:listen`, dan `npm run dev` di terminal terpisah.

---

## Tahap 6 — Menjalankan frontend (Vite)

Development (hot reload):

```powershell
npm run dev
```

Produksi (build statis, lalu serve via web server):

```powershell
npm run build
```

---

## Tahap 7 — Bridge Python / Modbus (Server PC)

### 7.1 Lingkungan virtual dan dependensi

```powershell
cd python-modbus
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 7.2 File `.env` di `python-modbus/`

Pastikan minimal:

| Variabel                     | Contoh                                                   | Keterangan                                                                      |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `LARAVEL_WEBHOOK_URL`        | `http://127.0.0.1:8000/api/plc/webhook`                  | Target POST hasil polling                                                       |
| `POLL_INTERVAL_SEC`          | `1`                                                      | Interval antar siklus polling (detik, default 1)                                |
| `ENABLE_POLLING`             | `1`                                                      | Aktifkan loop polling saat FastAPI startup                                      |
| `PLC_WEBHOOK_SECRET`         | (sama dengan Laravel)                                    | Header `X-PLC-Secret` jika Laravel memvalidasi                                  |
| `LARAVEL_BRIDGE_DEVICES_URL` | `http://127.0.0.1:8000/api/plc/bridge-devices?token=...` | IP/port/unit_id PLC diambil dari Laravel Settings (token = `PLC_BRIDGE_TOKEN`) |

### 7.3 Menjalankan uvicorn

```powershell
cd python-modbus
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8001
```

---

## Tahap 8 — Jaringan dan PLC

1. **PLC Schneider M221** harus dapat dijangkau dari PC server (python-modbus) via jaringan LAN.
2. Di **Settings → PLC configuration** di website, set **IP, port (502), unit_id (1)** sesuai konfigurasi fisik PLC.
3. **Peta register** PLC harus selaras dengan `python-modbus/modbus/register_map.py`:
    - Holding register 40001–40009: uint16/boolean
    - Holding register 40010: tidak dipakai (tetap ikut terbaca agar offset float benar)
    - Holding register 40011–40012: float32 tekanan (2 word masing-masing)
    - Total 14 word (PDU 0–13)

---

## Tahap 9 — Verifikasi end-to-end

1. Buka aplikasi web — dashboard langsung tampil (tanpa login).
2. Sidebar menampilkan Control Room 1–3; klik untuk membuka daftar test cell / test pit.
3. Klik ruang (di sidebar atau peta 3D) → panel detail kanan terbuka.
4. Buka **Settings → PLC configuration** — device enabled, IP/port/unit_id benar.
5. Pastikan **uvicorn** (`python-modbus`) berjalan — badge PLC berubah menjadi online, dan `GET /api/plc/{room_id}/data` mengembalikan snapshot.
6. Buka **Settings → PLC register log** untuk melihat riwayat perubahan register.

---

## Urutan start yang disarankan

1. SQL Server aktif
2. `php artisan serve`
3. `php artisan queue:listen --tries=1` (jika memakai antrean database)
4. `npm run dev` / `npm run build`
5. `uvicorn main:app ...` di `python-modbus/`

Matikan dengan `Ctrl+C` pada masing-masing terminal.

---

## Troubleshooting singkat

| Gejala                                         | Periksa                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `could not find driver` (sqlsrv)               | Aktifkan `pdo_sqlsrv` + `sqlsrv` di `php.ini`; buka ulang terminal                          |
| Error sertifikat SSL ke SQL Server             | ODBC Driver 18 mewajibkan enkripsi; aktifkan `trust_server_certificate` di `config/database.php` + `DB_TRUST_SERVER_CERTIFICATE=true` |
| `Unsupported cipher or incorrect key length`   | `APP_KEY` kosong/tidak valid → `php artisan key:generate`                                   |
| `Invalid column name 'user_id'` (sessions)     | Jalankan `php artisan migrate` — kolom `sessions.user_id` wajib ada untuk session database  |
| Sidebar kosong / ruang tidak bisa diklik       | Database belum di-seed → `php artisan db:seed`                                              |
| `Vite manifest not found`                      | Jalankan `npm run dev` atau `npm run build`                                                 |
| 403 pada bridge devices                        | `PLC_BRIDGE_TOKEN` Laravel sama dengan `?token=` di URL Python                              |
| 401 pada webhook                               | `PLC_WEBHOOK_SECRET` cocok di kedua sisi (atau kosongkan keduanya untuk dev)                |
| PLC timeout                                    | IP/port, kabel/jaringan, PLC program run, unit_id=1                                         |
| Python tidak ikut Settings                     | Set `LARAVEL_BRIDGE_DEVICES_URL`; pastikan device `is_enabled` di DB                        |

---

## Dokumen terkait

- **`docs/GAMBARAN_SISTEM.md`** — ringkasan produk dan fitur.
- **`docs/PENJELASAN_CARA_KERJA_SISTEM.md`** — alur kerja dari sisi tampilan dan sisi kode.
- **`docs/SISTEM_CARA_KERJA_DAN_INDEKS_FILE.md`** — arsitektur dan indeks file.
