<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas del repositorio para agentes

## Estructura del proyecto
- `src/app`: Enrutamiento con App Router de Next.js, páginas, vistas, componentes de interfaz y endpoints de API en `src/app/api/`.
- `src/server/db`: Lógica del backend y base de datos: esquemas Drizzle (`schema.ts`), conexión SQLite (`index.ts`), ledger de cuentas (`ledger.ts`), cálculo y aseguramiento de días (`ensure.ts`), y registro de auditoría (`audit.ts`).
- `tests/`: Pruebas automatizadas (Vitest) ubicadas fuera del directorio `src/`.
- `drizzle/`: Migraciones SQL generadas por Drizzle Kit.

## Comandos de verificación y su orden
Los agentes deben ejecutar y validar los comandos en el siguiente orden secuencial:
1. `npm run lint` — Valida estilo y reglas con ESLint.
2. `npm run typecheck` — Valida tipos estáticos de TypeScript con `tsc --noEmit`.
3. `npm run test:coverage` — Ejecuta la suite de pruebas unitarias e integración con Vitest y valida la cobertura.
4. `npm run build` — Compila el artefacto de producción de Next.js.

Comando unificado para validar todo el pipeline:
```bash
npm run verify
```

### Cobertura de código y pruebas individuales
- **Cobertura**: `npm run test:coverage` valida que la cobertura cumpla el umbral mínimo del **55 %** (líneas y sentencias en `vitest.config.mts`).
- **Ejecutar un solo archivo de pruebas**:
  ```bash
  npx vitest run tests/<archivo>
  ```

### Variables de entorno para gates y pruebas
Los gates de verificación y las pruebas en worktrees o CI requieren las siguientes variables de entorno con valores de prueba (nunca usar credenciales reales ni de producción):
```bash
DATABASE_URL=file:./data/test.db
ADMIN_PASSWORD=test-password-12345
AUTH_SECRET=ci-secret-minimo-32-caracteres-xxxxxx
```

## Reglas de negocio clave
- **Saldo corrido y deuda acumulada**: La deuda es un valor derivado (nunca se edita directamente). Se calcula con saldo corrido: `saldo += cuotaDía − pagosDía`, partiendo de `saldoInicial` del contrato. `deuda = max(0, saldo)`, `crédito = max(0, −saldo)`. Todo sobrepago permanece como **saldo a favor** que cubre automáticamente días siguientes (incluso días exentos).
- **Invariante dura de pagos**: Ningún pago sin día. Al registrar un pago, los días faltantes entre la última fecha registrada y hoy se generan automáticamente dentro de la **misma transacción**. El pago es **siempre hoy** en zona horaria `America/Bogota` para todos los roles.
- **Trazabilidad en `audit_log`**: Toda acción crítica debe registrar un evento en la tabla `audit_log` dentro de la **misma transacción** que ejecuta el cambio, sin incluir contraseñas ni datos sensibles/secretos.
- **Roles y permisos**:
  - `admin`: Acceso y modificación total (usuarios, motos, contratos, omisiones, cuotas diarias).
  - `cobrador`: Gestión de día a día y registro de pagos.
  - `conductor`: Acceso restringido exclusivamente a su propio contrato y ficha vinculada.
  - `viewer`: Solo lectura.
  - Login con rate limit (5 intentos fallidos activan bloqueo de 15 minutos). El rol se revalida activamente contra la base de datos en cada sesión.

## Cambios de esquema de base de datos
- Los cambios de esquema se realizan única y exclusivamente ejecutando:
  ```bash
  npm run db:generate
  ```
- **NUNCA** editar manualmente archivos de migración ya generados ni aplicados en `drizzle/`.

## Rutas protegidas (requieren aprobación humana previa)
Cualquier modificación o eliminación en las siguientes rutas está terminantemente prohibida sin aprobación humana explícita:
- `.env*`
- `Dockerfile`
- `docker-compose.yml`
- `docker-entrypoint.sh`
- `README_COOLIFY.md`
- `scripts/backup.mjs`
- `scripts/migrate.mjs`
- `drizzle/` (migraciones existentes)
- `.github/workflows/`
- `package-lock.json`
- `data/`

