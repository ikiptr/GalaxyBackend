# Galaxy POS — Backend

REST API untuk Galaxy POS. Dibangun dengan **Hono.js** + **PostgreSQL** + **Drizzle ORM**.

## Stack

| Layer    | Tech                  |
|----------|-----------------------|
| Runtime  | Node.js 22            |
| Framework| Hono.js 4             |
| Database | PostgreSQL 17         |
| ORM      | Drizzle ORM           |
| Auth     | JWT (jsonwebtoken)    |
| Hashing  | bcryptjs              |
| Validation | Zod               |

## Setup lokal

```bash
cd backend
cp .env.example .env
# edit .env — isi DATABASE_URL dan JWT_SECRET
npm install
npm run db:push      # buat tabel di DB
node --experimental-strip-types src/seed.ts  # buat superadmin default
npm run dev
```

## Deploy di Coolify

1. Buat **PostgreSQL** service di Coolify → copy connection string ke `DATABASE_URL`
2. Buat **new service** → pilih "Dockerfile" → arahkan ke folder `backend/`
3. Set environment variables:
   - `DATABASE_URL` — dari Coolify managed DB
   - `JWT_SECRET` — string acak panjang (misal hasil `openssl rand -hex 32`)
   - `CORS_ORIGIN` — URL frontend produksi, misal `https://pos.yourdomain.com`
   - `PORT` — `3001`
4. Deploy → Coolify akan build Docker image otomatis
5. Jalankan seed setelah deploy pertama:
   ```bash
   # via Coolify terminal / exec
   node dist/seed.js
   ```

## API Endpoints

### Auth
| Method | Path              | Akses       | Keterangan        |
|--------|-------------------|-------------|-------------------|
| POST   | /api/auth/login   | Public      | Login → JWT token |
| POST   | /api/auth/logout  | Public      | Acknowledge only  |

### Barang
| Method | Path             | Akses       |
|--------|------------------|-------------|
| GET    | /api/barang      | Semua login |
| POST   | /api/barang      | Boss+       |
| PUT    | /api/barang/:id  | Boss+       |
| DELETE | /api/barang/:id  | Superadmin  |

### Kategori & Supplier
Sama pola dengan Barang di `/api/kategori` dan `/api/supplier`.

### Penjualan
| Method | Path               | Akses       |
|--------|--------------------|-------------|
| GET    | /api/penjualan     | Semua login |
| POST   | /api/penjualan     | Semua login |
| DELETE | /api/penjualan/:id | Superadmin  |

### Pemesanan
| Method | Path                        | Akses       |
|--------|-----------------------------|-------------|
| GET    | /api/pemesanan              | Semua login |
| POST   | /api/pemesanan              | Semua login |
| PATCH  | /api/pemesanan/:id/payment  | Semua login |
| DELETE | /api/pemesanan/:id          | Boss+       |

### Absensi
| Method | Path                    | Akses       |
|--------|-------------------------|-------------|
| GET    | /api/absensi            | Semua login |
| POST   | /api/absensi/toggle     | Semua login |
| POST   | /api/absensi/reset-paid | Semua login |

### Akun
| Method | Path           | Akses       |
|--------|----------------|-------------|
| GET    | /api/akun      | Boss+       |
| POST   | /api/akun      | Superadmin  |
| PUT    | /api/akun/:id  | Superadmin  |
| DELETE | /api/akun/:id  | Superadmin  |

## Role Hierarchy

```
superadmin > boss > karyawan
```

- **karyawan** — bisa input penjualan, pemesanan, absensi
- **boss** — tambahan: kelola barang, kategori, supplier, lihat semua akun
- **superadmin** — akses penuh termasuk hapus data dan kelola akun
