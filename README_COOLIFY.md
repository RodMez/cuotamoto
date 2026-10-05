# CuotaMoto — Deploy en Coolify (Oracle Ubuntu)

App: Next.js TS + SQLite (`/app/data/prod.db`, WAL). Una sola réplica.

## 1. Subir a GitHub
```bash
cd cuotamoto
git add .
git commit -m "feat: CuotaMoto v1"
git branch -M main
git remote add origin <tu-repo>
git push -u origin main
```

## 2. Coolify
1. New Resource → Application → Public/Private Repo → rama `main`
2. Build: Dockerfile (puerto 3000). Healthcheck: `/api/health`
3. Domains → `https://tudominio.com` → SSL auto
4. Volumes: `cuotamoto-data:/app/data` — **replicas = 1** (SQLite no escala)
5. Env:
```
DATABASE_URL=file:/app/data/prod.db
AUTH_SECRET=<32+ chars random>
AUTH_URL=https://tudominio.com
ADMIN_EMAIL=admin@cuotamoto.local
ADMIN_PASSWORD=<cámbiala>
```
6. Deploy. El seed crea admin + moto demo PMO-001 con días 89/90 como tu imagen.

## 3. Uso
- `/login` → admin entra con email, conductor con teléfono.
- `/` dashboard: selector de moto, KPIs, tabla Día|Fecha|Cuota|Pago SUM|Deuda|Estado. `+ Generar día` con cuota variable, `+ pago aquí` N veces por día.
- `/pendientes` solo visual semáforo.
- `/mi-cuenta` vista conductor (solo su contrato).
- `/admin` crear motos y usuarios (solo admin).

Lógica: `deuda(n)=deuda(n-1)+cuotaDia-SUM(pagos dia)`, `estado=deuda<=0?Al día:Pendiente`.

## 4. Backup SQLite
En Coolify → Terminal del contenedor, cron diario:
```bash
sqlite3 /app/data/prod.db ".backup '/app/data/backups/prod-$(date +%F).db'"
```
El volumen `cuotamoto-data` ya persiste. Descarga backups desde Volumes o S3 en V2.

## 5. Crear conductor con login
1. Admin → crea usuario rol `conductor`, teléfono `300...`, clave.
2. En DB linkea `clients.userId`: por ahora crea el cliente con mismo teléfono y luego en terminal sqlite: `UPDATE clients SET user_id='<userId>' WHERE telefono='300...';`
V2: UI para linkear directo.
