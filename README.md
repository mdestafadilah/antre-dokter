# AntreDokter - Sistem Antrian Dokter Online

Aplikasi web untuk mengelola antrian pasien dokter dengan fitur real-time notification dan laporan komprehensif. Sistem ini dirancang khusus untuk praktek dokter dengan dua tipe pengguna utama: **Admin** dan **Pasien**.

## Fitur Utama

### 🏥 Modul Pasien
- Pendaftaran dan login akun pasien
- Pemesanan antrian online dengan pemilihan tanggal dan slot waktu
- Melihat status antrian real-time
- Riwayat pemesanan lengkap
- Pembatalan antrian dengan notifikasi otomatis
- Notifikasi real-time untuk update status antrian
- Request reschedule antrian jika diperlukan

### 👨‍💼 Modul Admin
- **Manajemen Pasien**: Kelola data pasien, lihat riwayat kunjungan
- **Manajemen Antrian Real-time**: Monitor dan update status antrian (panggil, selesai, batal)
- **Dashboard Statistik**: Overview harian dengan grafik dan metrics
- **Laporan Komprehensif**: Report bulanan/periode dengan filter tanggal dan export
- **Pengaturan Praktik**: Konfigurasi jam operasional, slot waktu, dan quota harian
- **Emergency Closure**: Sistem penutupan darurat dengan notifikasi otomatis ke semua pasien
- **Kalender Antrian**: View kalender lengkap dengan management antrian
- **Notifikasi Management**: Kelola dan kirim notifikasi ke pasien
- **Reschedule Management**: Approve/reject request reschedule dari pasien

## Struktur Proyek

```
AntreDokter/
├── frontend/          # React.js application
├── backend/           # Node.js/Express API
├── docs/             # Documentation
└── README.md
```

## Quick Start

Make sure [bun](https://bun.sh) is installed and PostgreSQL 12+

```bash
bun --version
```

Run the command below to make a new AntreDokter project

```bash
git clone https://github.com/mdestafadilah/antre-dokter.git
```

Once complete run the dev server

```bash
cd AntreDokter
bun install
bun run dev
```


### Environment Variables

**Server (.env):**
```
PORT=5001
NODE_ENV=production
DB_HOST=your-db-host
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-db-password
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGIN=https://your-frontend-domain.com
```

**Client (.env):**
```
REACT_APP_API_URL=https://your-api-domain.com/api
GENERATE_SOURCEMAP=false
```