# Gambaran Sistem — Testing Bay Dashboard

Dokumen ini menjelaskan **apa yang dilakukan sistem** dan **fitur utama** dalam bahasa yang mudah dipahami tim operasional maupun pengembang. Untuk instalasi teknis, lihat [`PANDUAN_MENJALANKAN_SISTEM.md`](PANDUAN_MENJALANKAN_SISTEM.md).

---

## Apa yang dilakukan sistem ini

Repositori ini berisi **sistem dan dashboard monitoring** untuk area **testing bay**: pengawas melihat kondisi tiap **test pit** dan **test cell** dari browser, tanpa harus berdiri di depan panel PLC.

Aplikasi web dibangun dengan **Laravel** (backend + API) dan **JavaScript/Vite** (tampilan dashboard). Data dari PLC di lapangan masuk ke server melalui **jembatan polling** (`python-modbus/`) yang mengirim hasil baca Modbus ke aplikasi.

Aplikasi bersifat **single-user tanpa login**: siapa pun yang membuka URL aplikasi di jaringan internal langsung masuk ke dashboard dan dapat membuka semua menu.

---

## Ringkasan kemampuan

- Menyatukan tampilan **3 control room** dan **11 ruang uji** (6 test pit + 5 test cell) dalam satu halaman utama.
- Menampilkan **status koneksi PLC** per ruang (online/offline/error).
- Memuat **tekanan**, **posisi atap**, **mode panel**, **status uji**, **pintu**, dan **kondisi darurat** dari register PLC.
- Menampilkan **alarm aktif** (darurat, tekanan masuk, motor) di sidebar.
- **Log peristiwa** ringkas per ruang di panel detail dan **riwayat perubahan register** di halaman tersendiri.
- Pembaruan data berkala dari API dan, bila dikonfigurasi, **realtime** lewat Pusher/Echo.
- **Mode dummy** (`VITE_DASHBOARD_USE_DUMMY=true`): uji UI tanpa PLC live — dengan panel **Demo roof** dan kontrol simulasi di panel ruang.

---

## Fitur utama (sisi pengguna)

| Area                 | Fitur                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Dashboard**        | Peta fasilitas **3D**; pemilihan ruang; panel kanan: tekanan, atap, status operasi, alarm ruangan |
| **Navigasi**         | Sidebar: control room → daftar test pit / test cell; klik gedung di peta 3D                        |
| **Settings PLC**     | IP, port, unit ID, enable polling per ruang (`/settings/plc`)                                      |
| **PLC register log** | Riwayat perubahan nilai register dengan filter (`/settings/plc-log`)                               |
| **API**              | Endpoint publik: dashboard, ruang, PLC, alarm, log; bridge berbasis token untuk Python             |

Menu **Settings** (kanan atas) berisi tautan ke PLC configuration dan PLC register log.

---

## Isi repositori (gambaran)

| Folder                          | Fungsi                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `app/`, `routes/`, `resources/` | Aplikasi web Laravel + dashboard Vite                     |
| `python-modbus/`                | Polling Modbus TCP → webhook Laravel (jalan di server PC) |
| `database/`                     | Migrasi skema dan seeder data awal                        |
| `docs/`                         | Panduan instalasi, arsitektur, indeks file                |

---

## Menyiapkan lingkungan (ringkas)

1. Salin `.env` dari `.env.example`; `php artisan key:generate`.
2. `composer install` dan `npm install`.
3. Buat database SQL Server, lalu `php artisan migrate --seed`.
4. Jalankan `php artisan serve` dan `npm run dev`.
5. PLC bridge: konfigurasi `python-modbus/.env` + `uvicorn`.
6. Dummy UI saja: `VITE_DASHBOARD_USE_DUMMY=true` — tidak perlu PLC.

Detail lengkap: [`PANDUAN_MENJALANKAN_SISTEM.md`](PANDUAN_MENJALANKAN_SISTEM.md).

---

## Dokumentasi teknis

| File                                                                           | Isi                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| [`SISTEM_CARA_KERJA_DAN_INDEKS_FILE.md`](SISTEM_CARA_KERJA_DAN_INDEKS_FILE.md) | Arsitektur, alur data PLC, ERD, indeks file |
| [`PANDUAN_MENJALANKAN_SISTEM.md`](PANDUAN_MENJALANKAN_SISTEM.md)               | Instalasi langkah demi langkah            |
| [`PENJELASAN_CARA_KERJA_SISTEM.md`](PENJELASAN_CARA_KERJA_SISTEM.md)           | Alur pengguna dan rantai kode             |
| [`ERD.md`](ERD.md)                                                             | Diagram relasi database + rekomendasi penamaan |
| [`SOFTWARE.md`](SOFTWARE.md)                                                   | Proposal / deskripsi perangkat lunak      |
| [`../ROADMAP.md`](../ROADMAP.md)                                               | Rencana penyempurnaan                     |

---

## Uji & gaya kode PHP

```bash
php artisan test
vendor/bin/pint
```

---

## Lisensi

Kerangka aplikasi mengikuti lisensi **Laravel** ([MIT](https://opensource.org/licenses/MIT)). Lisensi produk lengkap mengikuti kebijakan pemilik repositori.
