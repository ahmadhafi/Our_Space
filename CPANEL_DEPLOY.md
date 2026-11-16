# Panduan Lengkap Deploy Our Space ke cPanel (NyanHosting) 🚀

Panduan ini memandu langkah demi langkah memindahkan (migrasi) deployment aplikasi **Our Space** dari **Vercel** ke **cPanel NyanHosting**.

---

## 🌟 Keuntungan Pindah ke cPanel NyanHosting
1. **Penyimpanan Permanen (Local Storage)**: Foto, video, voice note, dan avatar sekarang tersimpan langsung di hosting tanpa khawatir terhapus saat server dingin (cold start).
2. **Tidak Perlu Layanan Tambahan Berbayar**: Upload media berjalan secara lokal (folder `uploads/`), tidak wajib langganan Vercel Blob.
3. **LiteSpeed Web Server**: NyanHosting menggunakan LiteSpeed yang sangat cepat untuk melayani file statis dan aplikasi Node.js.
4. **Data Aman**: Menggunakan database PostgreSQL cloud (seperti Neon.tech gratis atau Vercel Postgres lama Anda).

---

## 📋 Ringkasan File Siap Deploy
Kami sudah menyiapkan skrip otomatis untuk membungkus seluruh aplikasi menjadi file zip siap upload:
- File: `cpanel-deploy.zip` (~0.9 MB)
- Sudah termasuk React client yang sudah di-build (`client/dist`)
- Entry point cPanel: `app.js`
- Konfigurasi server: Express + Phusion Passenger + `.htaccess`

---

## 🛠️ Langkah 1: Persiapan Database PostgreSQL

Aplikasi Our Space menggunakan database PostgreSQL. Karena shared hosting cPanel biasanya default menggunakan MySQL, solusi terbaik, gratis, dan paling stabil adalah menggunakan **PostgreSQL Cloud**:

### Opsi A (Jika Ingin Mempertahankan Data Lama dari Vercel)
Jika di Vercel Anda sudah ada postingan, cerita, atau chat:
1. Buka dashboard [Vercel](https://vercel.com).
2. Masuk ke project Our Space -> tab **Storage** -> pilih **Postgres** (Neon).
3. Buka tab **.env.local** atau **Connection String**.
4. Salin string koneksinya (berawalan `postgresql://...` atau `postgres://...`).
5. *Semua data lama Anda akan langsung terbaca di cPanel!*

### Opsi B (Database Baru Gratis via Neon)
Jika ingin membuat database baru:
1. Buka [Neon.tech](https://neon.tech) dan daftar gratis (bisa login dengan akun Google/GitHub).
2. Buat project baru (misal diberi nama `ourspace`).
3. Pilih region terdekat (misal `Singapore` / `ap-southeast-1`).
4. Salin **Connection String** yang diberikan (pilih mode `Node.js` / Direct Connection, pastikan ada `sslmode=require`).
5. Tabel database akan otomatis dibuat saat aplikasi dijalankan pertama kali.

---

## 📦 Langkah 2: Menyiapkan File Deployment (`cpanel-deploy.zip`)

File `cpanel-deploy.zip` sudah otomatis kami buatkan di folder proyek. Jika suatu saat Anda mengubah kode dan ingin membuat zip baru, cukup jalankan:

```bash
npm run package:cpanel
```

File `cpanel-deploy.zip` akan otomatis ter-generate di folder utama.

---

## 🌐 Langkah 3: Upload ke File Manager cPanel

1. Login ke akun [NyanHosting Member Area](https://nyanhosting.id/member) -> Pilih paket hosting Anda -> Klik **"Login to cPanel"**.
2. Di dashboard cPanel, buka menu **File Manager**.
3. Di root akun Anda (folder `/home/username/`), buat folder baru bernama:
   ```
   ourspace
   ```
   *(Tips: Sangat disarankan menaruh folder aplikasi di `/home/username/ourspace` di luar `public_html` agar file backend dan file `.env` aman tidak terekspos ke publik).*
4. Masuk ke folder `ourspace`.
5. Klik menu **Upload** di bagian atas, pilih file `cpanel-deploy.zip`.
6. Setelah progress upload berwarna hijau (100%), kembali ke File Manager.
7. Klik kanan pada file `cpanel-deploy.zip` -> pilih **Extract** -> **Extract Files**.
8. Sekarang file proyek Anda (`app.js`, `package.json`, `.htaccess`, `server/`, `client/dist/`, `uploads/`) sudah berada di dalam folder `ourspace`.

---

## ⚙️ Langkah 4: Setup Node.js App di cPanel

1. Kembali ke halaman utama cPanel.
2. Cari dan klik menu **Setup Node.js App** (biasanya di bagian kategori *Software*).
3. Klik tombol **Create Application** di kanan atas.
4. Isi form pengaturan sebagai berikut:
   - **Node.js version**: Pilih versi **20.x** (atau **22.x** / minimal **18.x**).
   - **Application mode**: Pilih **Production**.
   - **Application root**: Ketik `ourspace` (sesuai nama folder tempat extract tadi).
   - **Application URL**: Pilih nama domain atau subdomain Anda (misal `ourverse.my.id` atau `space.domainanda.com`).
   - **Application startup file**: Ketik `app.js`.
5. Klik tombol **Create** di kanan atas.
6. Halaman akan memuat ulang dan aplikasi Node.js sudah terdaftar.

---

## 🔐 Langkah 5: Buat File `.env` (Konfigurasi Rahasia)

1. Buka kembali **File Manager** cPanel -> folder `ourspace`.
2. Pastikan opsi *Show Hidden Files (dotfiles)* aktif di menu *Settings* kanan atas File Manager jika file berawalan titik tidak terlihat.
3. Cari file `.env.example`, klik kanan -> pilih **Copy** -> beri nama baru:
   ```
   .env
   ```
4. Klik kanan file `.env` -> pilih **Edit**.
5. Isi konfigurasi sesuai kebutuhan:

```env
NODE_ENV=production
PORT=3001

# JWT Secrets (buat string acak panjang, bedakan keduanya)
JWT_SECRET=buat_random_panjang_minimal_32_karakter_contoh_a8f9c7e12...
JWT_REFRESH_SECRET=buat_random_panjang_lainnya_minimal_32_karakter_b4d2...

# URL Domain Anda (tanpa garis miring di akhir)
CORS_ORIGIN=https://domainkamu.com

# Database PostgreSQL (dari Neon.tech atau Vercel Postgres)
DATABASE_URL=postgresql://username:password@ep-sample-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Uploads Folder (kosongkan saja untuk menggunakan default folder ./uploads)
UPLOADS_PATH=
```

> **Tips Generator Secret**:
> Anda bisa membuat string acak dengan menjalankan perintah ini di terminal:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

6. Klik **Save Changes**.

---

## 📥 Langkah 6: Install Dependencies

1. Kembali ke menu **Setup Node.js App** di cPanel.
2. Di bagian detail aplikasi `ourspace`, Anda akan melihat tombol **"Run NPM Install"**.
3. Klik tombol **"Run NPM Install"**.
4. Tunggu sekitar 1 - 2 menit sampai proses instalasi selesai.

### Alternatif jika ingin install lewat Terminal cPanel:
1. Di bagian atas halaman Node.js App, ada perintah untuk masuk ke virtual environment, contohnya:
   ```bash
   source /home/username/nodevenv/ourspace/20/bin/activate && cd /home/username/ourspace
   ```
2. Salin perintah tersebut.
3. Buka menu **Terminal** di cPanel, paste perintah tersebut lalu tekan Enter.
4. Jalankan:
   ```bash
   npm install --omit=dev
   ```

---

## 🚀 Langkah 7: Restart & Nikmati Aplikasi

1. Di halaman **Setup Node.js App** cPanel, klik tombol **Restart** (ikon panah melingkar).
2. Pastikan status aplikasi menunjukkan **Started** (berwarna hijau).
3. Buka domain Anda di browser:
   ```
   https://domainkamu.com
   ```
4. Aplikasi Our Space Anda sudah aktif dan live di cPanel NyanHosting! 🎉

---

## 👤 Akun Default & Setup Admin

Database PostgreSQL akan otomatis terisi dua akun default saat pertama kali dijalankan:
- Akun 1:
  - Username: `hafi`
  - Password default: `sayanglila`
- Akun 2:
  - Username: `lila`
  - Password default: `password123`

*(Anda bisa langsung mengganti password setelah login di menu Profile).*

### Menjadikan Akun Anda sebagai Admin:
Buka **Terminal** di cPanel, masuk ke environment Node.js aplikasi, lalu jalankan:
```bash
node server/scripts/make-admin.js hafi
```
Ganti `hafi` dengan username Anda. Anda sekarang memiliki hak akses Admin untuk mengelola dan menghapus postingan/aktivitas.

---

## ❓ FAQ & Troubleshooting

### 1. Website menampilkan error 503 Service Unavailable
- Periksa log error di cPanel atau jalankan `node app.js` lewat Terminal cPanel untuk melihat pesan error.
- Biasanya disebabkan oleh salah penulisan `DATABASE_URL` di file `.env` atau dependensi belum selesai di-install.

### 2. Apakah foto/video yang di-upload aman?
- Ya! Foto dan video tersimpan di folder `uploads/` di dalam hosting Anda secara permanen.
- Jika Anda sebelumnya menggunakan Vercel Blob dan ingin tetap memakai Vercel Blob untuk foto, Anda cukup menambahkan `BLOB_READ_WRITE_TOKEN=token_anda` di file `.env`. Sistem akan otomatis mendeteksi dan menggunakannya.

### 3. Cara Mengaktifkan SSL (HTTPS)?
- Di cPanel NyanHosting, buka menu **SSL/TLS Status**.
- Pilih domain Anda dan klik **Run AutoSSL**. SSL gratis dari Let's Encrypt / Sectigo akan terpasang otomatis dalam beberapa menit.
