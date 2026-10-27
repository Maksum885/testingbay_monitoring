# Testing Bay Dashboard

Web-based SCADA dashboard untuk **testing bay** — monitoring test pit dan test cell, dan telemetri PLC.

## Fitur

- **Peta fasilitas 3D** dengan panel detail per ruang
- **Integrasi PLC** via Modbus TCP (`python-modbus` bridge → Laravel webhook)
- **Single-user, tanpa login** — satu operator, akses penuh ke semua menu
- **Realtime updates** via Laravel Echo / Pusher (opsional)
- **Dummy mode** untuk demo UI tanpa PLC live (`VITE_DASHBOARD_USE_DUMMY`)

## Tech stack

| Layer       | Stack                                         |
| ----------- | --------------------------------------------- |
| Backend     | Laravel 12, PHP 8.2+                          |
| Frontend    | Vite, JavaScript, Three.js                    |
| Database    | SQL Server (sqlsrv)                           |
| PLC bridge  | Python 3.10+, FastAPI, pymodbus 3.x           |

## Requirements

- PHP 8.2+, Composer, Node.js (LTS), npm
- Python 3.10+ untuk `python-modbus/` (server PC)
- SQL Server + ekstensi PHP `pdo_sqlsrv` / `sqlsrv` (ODBC Driver 17/18)
- PLC Schneider M221 TM221CE24R via Modbus TCP port 502

## Quick start

```bash
# 1. Environment
cp .env.example .env
php artisan key:generate

# 2. Dependencies
composer install
npm install

# 3. Database (buat dulu database kosong di SQL Server)
php artisan migrate
php artisan db:seed   # wajib: membuat 3 control room + 11 ruang uji

# 4. Run — masing-masing di terminal terpisah
php artisan serve
php artisan queue:listen --tries=1
npm run dev
```

> Di Windows, hindari `composer run dev`: perintah itu ikut menjalankan `php artisan pail`
> yang butuh ekstensi `pcntl` (tidak ada di Windows) sehingga semua proses ikut berhenti.

Buka `http://127.0.0.1:8000` — langsung masuk dashboard, **tanpa login**. Satu
pengguna dengan akses penuh ke semua menu (dashboard, PLC config, PLC register log).

### Optional services

**PLC bridge** (`python-modbus/`) — jalankan di server PC:

```bash
cd python-modbus
python -m venv .venv
# activate venv, lalu:
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

**UI-only demo** (tanpa PLC):

```env
VITE_DASHBOARD_USE_DUMMY=true
```

## Variabel lingkungan penting

Lihat [`.env.example`](.env.example) untuk penjelasan lengkap.

| Variabel                   | Fungsi                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| `PLC_BRIDGE_TOKEN`         | Token untuk bridge API Python (`bridge-devices`)                   |
| `PLC_WEBHOOK_SECRET`       | Header `X-PLC-Secret` pada PLC webhook                             |
| `VITE_DASHBOARD_USE_DUMMY` | Data statis demo + panel Demo roof                                 |

## Struktur project

```
testing-bay/
├── app/                 # Aplikasi Laravel
├── resources/js/        # Dashboard (Vite + Three.js)
├── python-modbus/       # Polling Modbus TCP → webhook Laravel
├── database/            # Migrations & seeders
└── docs/                # Dokumentasi teknis (Bahasa Indonesia)
```

## Dokumentasi

| Dokumen                                                                                | Keterangan                          |
| -------------------------------------------------------------------------------------- | ----------------------------------- |
| [docs/GAMBARAN_SISTEM.md](docs/GAMBARAN_SISTEM.md)                                     | Gambaran sistem & fitur             |
| [docs/PANDUAN_MENJALANKAN_SISTEM.md](docs/PANDUAN_MENJALANKAN_SISTEM.md)               | Panduan instalasi & operasional     |
| [docs/SISTEM_CARA_KERJA_DAN_INDEKS_FILE.md](docs/SISTEM_CARA_KERJA_DAN_INDEKS_FILE.md) | Arsitektur & indeks file            |
| [docs/PENJELASAN_CARA_KERJA_SISTEM.md](docs/PENJELASAN_CARA_KERJA_SISTEM.md)           | Alur data end-to-end                |
| [docs/ERD.md](docs/ERD.md)                                                             | Diagram relasi database (ERD)       |
| [docs/SOFTWARE.md](docs/SOFTWARE.md)                                                   | Proposal / deskripsi perangkat lunak |
| [ROADMAP.md](ROADMAP.md)                                                               | Rencana penyempurnaan               |

## Testing & code style

```bash
php artisan test
vendor/bin/pint
```

## License

Kerangka aplikasi mengikuti lisensi **Laravel** ([MIT](https://opensource.org/licenses/MIT)). Lisensi produk mengikuti kebijakan pemilik repositori.
