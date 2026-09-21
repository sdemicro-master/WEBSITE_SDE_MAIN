# SDE Smart Home — Cloudflare D1 + R2

Starter full-stack website yang mengikuti layout visual dari referensi yang diberikan, dengan:

- Landing page responsive.
- Katalog produk dari Cloudflare D1.
- Admin Console.
- Login admin berbasis password + signed HTTP-only cookie.
- CRUD produk.
- Upload foto produk langsung ke Cloudflare R2.
- Foto disajikan melalui Worker `/media/...`, jadi bucket R2 tidak perlu dibuat public.
- Featured products tampil otomatis di halaman depan.
- Search sederhana di admin.

## 1. Prasyarat

- Akun Cloudflare.
- Node.js 18+.
- Wrangler.

Install:

```bash
npm install
```

## 2. Buat D1

```bash
npx wrangler d1 create sde-store-db
```

Salin `database_id` hasil command ke `wrangler.toml`.

Lalu migrasi:

```bash
npm run db:migrate
```

Untuk development lokal:

```bash
npm run db:migrate:local
```

## 3. Buat R2

Buat bucket bernama:

```text
sde-product-images
```

Nama tersebut harus sama dengan `bucket_name` di `wrangler.toml`.

## 4. Secrets admin

Jangan taruh password production di source code.

Set secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
```

Untuk `ADMIN_SESSION_SECRET`, gunakan random string panjang, misalnya:

```bash
openssl rand -hex 32
```

## 5. Jalankan lokal

```bash
npm run dev
```

Buka URL Wrangler yang ditampilkan.

Admin:

```text
/admin.html
```

## 6. Deploy

```bash
npm run deploy
```

Setelah deploy, buka:

```text
https://DOMAIN-ANDA/admin.html
```

## Catatan keamanan

Implementasi ini sengaja dibuat sederhana agar mudah di-deploy sebagai satu Worker. Untuk toko production dengan banyak admin, sebaiknya ganti autentikasi sederhana ini dengan Cloudflare Access atau sistem identity/OAuth yang sesuai.

Upload membatasi tipe file ke JPG, PNG, WEBP, AVIF dan ukuran 5 MB. R2 tidak perlu public karena Worker mengirimkan objek lewat `/media/:key`.

## Struktur

```text
sde-cloudflare-store/
├─ public/
│  ├─ index.html
│  ├─ admin.html
│  ├─ app.js
│  ├─ admin.js
│  └─ styles.css
├─ src/
│  └─ index.ts
├─ schema.sql
├─ wrangler.toml
├─ package.json
└─ README.md
```


## Model katalog: lihat → detail → beli di marketplace / kontak

Website ini **tidak memiliki checkout atau keranjang belanja**. Pengunjung hanya:
1. melihat katalog,
2. membuka halaman detail produk,
3. membeli melalui link Shopee atau Tokopedia,
4. atau menghubungi admin melalui link kontak produk.

Di Admin Console setiap produk mempunyai:
- Shopee URL
- Tokopedia URL
- Kontak Produk URL (contoh link WhatsApp `https://wa.me/628xxxxxxxxxx`)

Jika salah satu link kosong, tombolnya tidak ditampilkan.
