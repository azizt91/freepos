# 🧾 FreePOS (v2.0)

**FreePOS** adalah aplikasi kasir (Point of Sale) gratis, *offline-first*, dan *mobile-first* yang dirancang khusus untuk UMKM (Usaha Mikro, Kecil, dan Menengah) di Indonesia. Semua data disimpan secara lokal di perangkat pengguna — **tanpa server, tanpa pendaftaran, dan 100% gratis**.

---

## ✨ Fitur Unggulan

- **Varian Produk (Baru!)** — Kelola satu produk dengan banyak pilihan (ukuran, warna, rasa) dengan harga dan stok terpisah.
- **Batalkan Transaksi (Baru!)** — Fitur pembatalan transaksi (Void) yang otomatis mengembalikan stok ke gudang.
- **PIN Keamanan (Baru!)** — Lindungi data bisnis bapak dengan PIN 4 digit saat membuka aplikasi.
- **Ekspor Laporan (Baru!)** — Download laporan penjualan dan detail produk dalam format **Excel** dan **PDF**.
- **Kasir (POS)** — Interface kasir lengkap dengan keranjang, diskon per item/transaksi, dan kalkulasi kembalian otomatis.
- **Manajemen Stok** — Catat barang masuk dari supplier dan barang keluar (rusak, hilang, retur).
- **HPP Otomatis & Manual** — Harga Pokok Penjualan dihitung otomatis (Weighted Average) atau bisa dikoreksi secara manual.
- **Laporan Penjualan** — Grafik tren 7/30 hari, produk terlaris, total pendapatan, dan laba kotor.
- **PWA (Progressive Web App)** — Bisa di-install ke Home Screen HP dan diakses penuh secara offline.
- **Backup & Restore** — Ekspor/Impor seluruh data dalam format JSON untuk keamanan data jangka panjang.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Database | IndexedDB via Dexie.js |
| Charts | Recharts |
| Icons | Lucide React |
| PWA | vite-plugin-pwa (Workbox) |
| Export | SheetJS (XLSX) & jsPDF |

---

## 🚀 Memulai (Getting Started)

### Prasyarat
- [Node.js](https://nodejs.org/) v18+
- npm, yarn, atau bun

### Instalasi Lokal
```bash
# Clone repository
git clone https://github.com/azizt91/freepos.git
cd freepos

# Install dependensi
npm install

# Jalankan server development
npm run dev
```
Aplikasi akan berjalan di `http://localhost:8080`.

---

## 💾 Penyimpanan Data

Seluruh data disimpan secara lokal di browser menggunakan **IndexedDB** (melalui Dexie.js). Tidak ada data yang dikirim ke server manapun, sehingga privasi data bapak 100% terjaga.

### Tabel Database Utama
- `products`: Master produk (termasuk flag `hasVariants`).
- `productVariants`: Detail varian produk (nama, harga, stok, hpp).
- `transactions`: Catatan penjualan (termasuk status `isCanceled`).
- `transactionItems`: Detail item per transaksi.
- `stockIns` & `stockOuts`: Riwayat pergerakan stok.
- `storeSettings`: Pengaturan toko & PIN keamanan.

---

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan ajukan **Pull Request** atau hubungi developer jika bapak memiliki ide fitur baru.

- Seluruh UI menggunakan **Bahasa Indonesia**.
- Gunakan komponen `shadcn/ui` yang sudah tersedia.
- Nilai mata uang disimpan sebagai **Integer** (Rupiah).
- Pastikan fitur baru tetap bekerja 100% secara offline.

---

## 📄 Lisensi

[MIT License](LICENSE)

---

## 🙏 Credits

Dibangun dengan ❤️ untuk kemajuan UMKM Indonesia.
- Pengembang: [azizt91](https://github.com/azizt91)
- Support: [Traktir Kopi ☕](https://lynk.id/payme/azizt91)
