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
2. Build: Dockerfile (puerto 3000). Healthcheck HTTP `GET :3000/api/health`, intervalo 30s, timeout 5s, reintentos 3, **start period 60s** (sin esto Coolify lo mata antes de calentar).
3. Domains → `https://tudominio.com` → SSL auto
4. Storages: volumen persistente en `/app/data` — **replicas = 1** (SQLite no escala)
5. Env (solo runtime, nunca Build Args):
```
DATABASE_URL=file:/app/data/prod.db
AUTH_SECRET=<32+ chars random>
AUTH_URL=https://tudominio.com
ADMIN_EMAIL=admin@cuotamoto.local
ADMIN_PASSWORD=<cámbiala>
TZ=America/Bogota
```
6. Deploy **sin caché** tras cambiar el Dockerfile. El entrypoint (`tini` + `docker-entrypoint.sh`) valida env, corre `scripts/migrate.mjs` (crea tablas + admin si `users` vacía) y arranca `server.js`. Moto demo PMO-001 días 89/90 solo en seed local.

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
1. Admin → tab Conductores → crea la ficha del conductor (nombre + teléfono).
2. Admin → tab Usuarios → crea usuario rol `conductor` con ese teléfono y clave.
3. Edita el usuario y vincúlalo a su ficha (select de conductor). Sin vínculo, `/mi-cuenta` muestra "Sin contrato".
