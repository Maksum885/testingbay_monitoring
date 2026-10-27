# Proposal Perangkat Lunak
# Testing Bay Monitoring Dashboard

---

**Nama Sistem** : Testing Bay Monitoring Dashboard  
**Jenis Sistem** : Web-based SCADA Dashboard  
**Platform**     : Browser — LAN / Intranet  
**Pengguna**     : Single-user (operator), tanpa login  
**Versi Dokumen**: 1.1  
**Tanggal**      : Oktober 2026  

---

## Daftar Isi

1. [Latar Belakang](#1-latar-belakang)
2. [Tujuan Sistem](#2-tujuan-sistem)
3. [Fungsi Utama Sistem](#3-fungsi-utama-sistem)
4. [Data dan Informasi yang Ditampilkan](#4-data-dan-informasi-yang-ditampilkan)
5. [Pengguna dan Akses](#5-pengguna-dan-akses)
6. [Alur Operasional dari Sisi Pengguna](#6-alur-operasional-dari-sisi-pengguna)
7. [Komponen Sistem](#7-komponen-sistem)
8. [Spesifikasi Teknis Ringkas](#8-spesifikasi-teknis-ringkas)

---

## 1. Latar Belakang

Fasilitas **Testing Bay SPM Oil & Gas** memiliki beberapa ruang pengujian yang terdiri dari **Test Pit** dan **Test Cell**. Setiap ruang dilengkapi dengan **PLC (Programmable Logic Controller) Schneider M221** sebagai pengendali mesin dan peralatan — mengatur tekanan, posisi atap hidrolik, sistem pintu, serta indikator darurat.

Sebelum sistem ini dibangun, kondisi operasional setiap ruang hanya dapat dipantau secara langsung di depan panel PLC masing-masing. Hal ini menyebabkan beberapa kendala:

- Operator tidak dapat memantau lebih dari satu ruang secara bersamaan
- Tidak ada pencatatan otomatis riwayat perubahan kondisi mesin
- Kejadian alarm dan darurat tidak terdokumentasi secara sistematis

Sistem ini dibangun untuk menjawab kendala tersebut melalui sebuah antarmuka web terpusat yang dapat diakses dari mana saja di jaringan internal fasilitas.

---

## 2. Tujuan Sistem

| No | Tujuan |
|----|--------|
| 1 | Menyediakan tampilan terpusat untuk memantau semua ruang uji secara bersamaan dari satu browser |
| 2 | Menampilkan data kondisi PLC mendekati real-time tanpa perlu refresh manual |
| 3 | Merekam seluruh perubahan kondisi dan kejadian alarm secara otomatis ke database |
| 4 | Menyediakan sistem alarm yang memberi notifikasi segera kepada operator saat kondisi berbahaya terdeteksi |
| 5 | Memudahkan konfigurasi koneksi PLC langsung dari browser tanpa mengubah kode |

---

## 3. Fungsi Utama Sistem

### 3.1 Pemantauan PLC (Modbus TCP)

Sistem membaca data dari PLC di setiap ruang uji secara otomatis menggunakan protokol **Modbus TCP** melalui layanan `python-modbus` yang berjalan di background. Data dibaca setiap **1 detik** (default, dapat diatur) dan diteruskan ke server web untuk ditampilkan di dashboard. Jika ada nilai register yang berubah, sistem mencatatnya ke riwayat secara permanen.

Register yang dibaca mencakup: tekanan masuk, tekanan 1 dan 2, posisi atap (4 register), mode panel, status pengujian, status pintu, dan status emergency.

### 3.2 Sistem Alarm

Alarm ditampilkan di sidebar kiri dashboard:

| Sumber Alarm | Keterangan |
|---|---|
| Register PLC 40002 (Emergency) | Alarm darurat dari PLC aktif — dicatat ke database dengan kode `ALARM_ALERT` |
| Register PLC 40001 + 40009 (Tekanan masuk) | Ada tekanan masuk saat pengujian belum dimulai — "ALARM PRESSURE" |
| Alarm motor (kiri/kanan) | Berdasarkan alarm aktif di `alarm_logs` |

Setiap alarm di database memiliki siklus: `active` → `acknowledged` → `resolved`, dan seluruh riwayat tersimpan permanen.

### 3.3 Pencatatan Data Otomatis (Data Logging)

Semua perubahan kondisi dan kejadian alarm dicatat ke tiga tabel database:

| Tabel | Isi | Kapan Ditulis |
|---|---|---|
| `plc_register_logs` | Nilai register sebelum dan sesudah perubahan, dengan cap waktu | Setiap kali ada register yang berubah nilainya |
| `alarm_logs` | Riwayat lengkap siklus alarm (aktif, acknowledged, resolved) | Setiap perubahan status alarm |
| `plc_snapshots` | Snapshot seluruh register satu ruang pada satu waktu | Setiap webhook polling |

Riwayat perubahan register dapat dilihat di menu **Settings → PLC register log**.

### 3.4 Visualisasi Peta 3D Fasilitas

Dashboard menampilkan denah tiga dimensi interaktif seluruh fasilitas testing bay menggunakan WebGL (Three.js). Pengguna dapat mengklik bangunan Test Pit atau Test Cell langsung dari peta 3D untuk membuka panel detail ruang tersebut.

### 3.5 Konfigurasi dari Browser

Pengaturan koneksi PLC (IP address, port, unit ID, aktif/nonaktif polling) per ruang dapat diubah langsung dari menu **Settings → PLC configuration**.

---

## 4. Data dan Informasi yang Ditampilkan

Berikut data yang ditampilkan di dashboard saat pengguna memilih sebuah ruang uji:

| No | Data / Informasi | Sumber | Keterangan |
|----|---|---|---|
| 1 | **Status Koneksi PLC** | Modbus TCP | Online / Offline / Error |
| 2 | **Tekanan 1** | Register 40011 | Nilai sensor tekanan pertama dalam PSI |
| 3 | **Tekanan 2** | Register 40012 | Nilai sensor tekanan kedua dalam PSI |
| 4 | **Posisi Atap** | Register 40004–40007 | Open / Close / Moving Open / Moving Close |
| 5 | **Mode Panel** | Register 40003 | Auto (normal) / Maintenance (perawatan) |
| 6 | **Status Pengujian** | Register 40009 | Running (berjalan) / Standby (siaga) |
| 7 | **Status Pintu** | Register 40008 | Locked / Unlocked |
| 8 | **Status Emergency** | Register 40002 | ON / OFF — alarm darurat aktif atau tidak |
| 9 | **Alarm Aktif Ruang** | PLC + `alarm_logs` | Daftar alarm yang sedang aktif di ruang tersebut |
| 10 | **Event Log** | `plc_register_logs` | 8 perubahan register PLC terakhir dengan waktu dan deskripsi |
| 11 | **Peta 3D Fasilitas** | Three.js (WebGL) | Denah interaktif seluruh Test Pit dan Test Cell |

> **Catatan**: Data diperbarui otomatis tanpa perlu refresh halaman — lewat polling API berkala, atau realtime jika Pusher/Echo dikonfigurasi.

---

## 5. Pengguna dan Akses

Sistem dirancang untuk **satu pengguna (operator) tanpa login**. Siapa pun yang membuka alamat aplikasi di jaringan internal memiliki akses penuh ke:

- Semua Control Room dan seluruh ruang uji
- Status PLC dan alarm semua ruang
- Konfigurasi PLC (IP address, port, unit ID per ruang)
- PLC register log (riwayat perubahan)
- Mode demo untuk keperluan presentasi atau pengujian tampilan

> Karena tidak ada autentikasi, aplikasi sebaiknya hanya dapat dijangkau dari jaringan internal yang tertutup.

---

## 6. Alur Operasional dari Sisi Pengguna

```
┌─────────────────────────────────────────────────────────┐
│  LANGKAH 1 — Akses Sistem                               │
│  Buka browser → ketik URL server di jaringan internal   │
│  Dashboard langsung tampil (tanpa login)                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  LANGKAH 2 — Dashboard Utama                            │
│                                                         │
│  ┌─────────────────┐  ┌───────────────────────────────┐ │
│  │  Sidebar Kiri   │  │   Area Tengah — Peta 3D       │ │
│  │                 │  │                               │ │
│  │ • Control room  │  │  Visualisasi 3D seluruh       │ │
│  │   & ruang uji   │  │  Test Pit & Test Cell         │ │
│  │ • Active Alarms │  │                               │ │
│  │   (semua ruang) │  │  Klik bangunan untuk          │ │
│  │                 │  │  membuka detail ruang         │ │
│  └─────────────────┘  └───────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  LANGKAH 3 — Pilih Ruang Uji                            │
│  Klik control room → klik nama ruang di sidebar         │
│  — atau —                                               │
│  Klik bangunan di peta 3D                               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  LANGKAH 4 — Panel Detail Ruang (sisi kanan layar)      │
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │   Tab: Overview     │  │   Tab: Event Log         │  │
│  │                     │  │                          │  │
│  │ • Tekanan 1 & 2     │  │ • 8 perubahan register   │  │
│  │ • Posisi Atap       │  │   PLC terakhir           │  │
│  │ • Mode Panel        │  │ • Waktu kejadian         │  │
│  │ • Status Pengujian  │  │ • Deskripsi perubahan    │  │
│  │ • Status Pintu      │  │                          │  │
│  │ • Emergency Status  │  └──────────────────────────┘  │
│  │ • Alarm Ruang Ini   │                                │
│  │ • Badge PLC Status  │                                │
│  └─────────────────────┘                                │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐   ┌──────────────────────────────────┐
│  Kondisi Normal  │   │  Kondisi Alarm                   │
│                  │   │                                  │
│ • Pantau data    │   │ • Alarm muncul otomatis          │
│   PLC secara     │   │   di sidebar kiri                │
│   berkala        │   │ • Buka ruang yang bersangkutan   │
│ • Baca event log │   │ • Cek detail di panel kanan      │
│                  │   │ • Lakukan tindakan lapangan      │
└──────────────────┘   └──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  LANGKAH 5 — Konfigurasi                                │
│                                                         │
│  Menu Settings (kanan atas):                            │
│  • PLC configuration — ubah IP, port, unit ID           │
│  • PLC register log — riwayat perubahan register        │
└─────────────────────────────────────────────────────────┘
```

### Catatan Alarm Otomatis

Sistem memantau PLC di latar belakang secara terus-menerus. Ketika kondisi berbahaya terdeteksi — misalnya alarm emergency aktif atau ada tekanan masuk sebelum pengujian dimulai — notifikasi muncul **otomatis di sidebar kiri** tanpa operator perlu me-refresh halaman.

---

## 7. Komponen Sistem

| Komponen | Fungsi (dari sisi pengguna) | Lokasi |
|---|---|---|
| **Aplikasi Web Dashboard** | Tampilan utama yang dibuka melalui browser — peta 3D, panel detail ruang, alarm, settings | PC Server |
| **Bridge Modbus (`python-modbus`)** | Membaca data dari PLC secara berkala dan mengirimkannya ke sistem web — berjalan otomatis di background | PC Server |
| **PLC Schneider M221** | Pengendali mesin di lapangan — menyimpan semua data kondisi (tekanan, atap, alarm, dll.) | Panel Lapangan |
| **Database SQL Server** | Menyimpan semua log, alarm, dan konfigurasi PLC secara permanen | PC Server |

---

## 8. Spesifikasi Teknis Ringkas

| Aspek | Detail |
|---|---|
| **Framework Backend** | Laravel 12 (PHP 8.2+) |
| **Frontend** | Blade Template + Vanilla JavaScript + Vite |
| **Visualisasi 3D** | Three.js (WebGL) |
| **Protokol PLC** | Modbus TCP |
| **Library Modbus** | pymodbus 3.x (Python) |
| **Database** | Microsoft SQL Server |
| **Interval Polling PLC** | 1 detik (dapat diatur via environment variable `POLL_INTERVAL_SEC`) |
| **Realtime (opsional)** | Laravel Echo + Pusher |
| **Akses** | Browser di jaringan LAN/Intranet — tidak memerlukan koneksi internet, tanpa login |
| **Jumlah Ruang Uji** | 6 Test Pit + 5 Test Cell = 11 ruang, dalam 3 Control Room |

---

*Dokumen ini menggambarkan sistem Testing Bay Monitoring Dashboard versi 1.1 — Oktober 2026.*
