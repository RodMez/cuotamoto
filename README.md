# CuotaMoto

Control de pagos del alquiler de motos con **cuota diaria variable**. Tabla estilo Notion
(`Día · Fecha · Cuota · Pagos · Deuda · Estado`), multi-moto, multi-usuario y SQLite.

## Reglas de negocio

- Deuda derivada (nunca se edita directo), con **saldo corrido**:
  `saldo += cuotaDía − pagosDía`, arranca en `saldoInicial` del contrato.
  `deuda = max(0, saldo)`, `crédito = max(0, −saldo)`. El sobrepago queda
  como **saldo a favor** que cubre días siguientes (incluso exentos).
- **Invariante dura**: ningún pago sin día. Al registrar un pago, los días
  faltantes se generan en la misma transacción. El pago es **siempre hoy**
  (America/Bogota) para todos los roles.
- Cuota variable por moto (`cuotaBase`) y por día (`cuotaDia` editable por admin).
- Omisiones = día con cuota 0 (no ausencia): toggle `omitirDomingos` por contrato
  + tabla `omisiones` (taller, etc.). El día existe y acepta pagos.
- 1 contrato activo por moto. Roles: `admin` todo · `cobrador` día+pago ·
  `conductor` solo su contrato · `viewer` lectura.
- Login con rate limit (5 fallos → 15 min) y rol revalidado desde la DB.
- Trazabilidad en `audit_log` (misma transacción que el cambio, sin secretos).

## Usuarios (tab Admin → Usuarios)

- **Desactivar** es la baja normal: bloquea el acceso al instante (el token
  vivo recibe 401) y conserva pagos, auditoría y link al conductor. Reactivar
  lo devuelve todo.
- **Borrar** solo sin historial (`audit_log` ni `payments.created_by`);
  si lo tiene, 409 "tiene historial, desactívalo".
- Guards: no a ti mismo, nunca al último admin activo (contado en la misma tx).
- Restablecer clave sube `tokenVersion`: las sesiones viejas mueren al instante.
- Conductor requiere link a su ficha; una ficha linkeada a otro da 409.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # pon ADMIN_PASSWORD (≥12) y AUTH_SECRET (≥32)
npx tsx ./src/server/db/seed.ts
npm run dev
```

| Script            | Qué hace                                              |
| ----------------- | ----------------------------------------------------- |
| `npm test`        | Vitest: `getLedger` y `ensureDays` (DB `data/test.db`) |
| `npm run build`   | Build producción (webpack, sin Turbopack en ARM)       |
| `npm run db:generate` | Nueva migración drizzle (`drizzle/000X_*.sql`)     |
| `npm run backup`  | Backup online a `BACKUP_DIR` (default `/backups`)      |

## Despliegue (Coolify + Oracle, ver `README_COOLIFY.md`)

1. Env runtime: `DATABASE_URL=file:/app/data/prod.db`, `AUTH_SECRET` (≥32),
   `AUTH_URL=https://tu-dominio`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (≥12, obligatoria),
   `TZ=America/Bogota`. Nada de secretos en Build Args.
2. Volúmenes: `/app/data` (SQLite, réplicas = 1) y `/backups` (retención 7 días).
3. Healthcheck HTTP `GET :3000/api/health`, start period 60s.
4. El entrypoint valida env, corre `scripts/migrate.mjs` (baseline marcada en
   DBs legacy + migrator drizzle + admin inicial) y arranca `server.js` con `tini`.
5. **Si vienes de `admin123`**: rota la clave de prod YA (el repo es público).
