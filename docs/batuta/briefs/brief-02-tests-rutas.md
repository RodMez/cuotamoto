# Brief 02: Pruebas Automatizadas para Rutas de API y Elevación de Umbral de Cobertura

## Contexto del Proyecto
En CuotaMoto, la mayoría de los módulos de backend cuentan con pruebas unitarias e integración en el directorio `tests/` (como contratos, pagos, usuarios y omisiones). Sin embargo, tres rutas de la API App Router carecen actualmente de cobertura automatizada:
1. `src/app/api/vehicles/route.ts`
2. `src/app/api/clients/route.ts`
3. `src/app/api/health/route.ts`

El umbral de cobertura en `vitest.config.mts` está fijado conservadoramente en 48 % (`lines: 48, statements: 48`).

---

## Objetivo
Implementar pruebas completas para estas tres rutas, cubriendo casos normales, casos de borde, validaciones de esquema, autenticación/roles y trazabilidad de auditoría, para elevar la cobertura global y subir el umbral mínimo exigido en `vitest.config.mts` al **55 %**.

---

## Requisitos de Implementación

### 1. Archivos de Prueba a Crear
- `tests/api-vehicles.test.ts`:
  - **GET**:
    - Rechazo `401` si no hay sesión autenticada (`identity() -> null`).
    - Alcance para rol `conductor`: solo debe listar los vehículos y contratos vinculados a su ficha de cliente (`userId === me.id`).
    - Alcance para roles administrativos (`admin`, `cobrador`, `viewer`): devuelve la lista completa de vehículos, contratos y clientes.
  - **POST**:
    - Requiere rol `admin` (`requireRole("admin")`). Rechazo `401` o `403` si el usuario no tiene permisos.
    - Validación de datos (`400`): rechazar si falta la placa, si la placa está vacía, si `cuotaBase` no es un entero, o si `cuotaBase <= 0`.
    - Normalización: la placa debe guardarse en mayúsculas y sin espacios residuales.
    - Duplicados (`409`): capturar colisión si la placa ya existe en la base de datos.
    - Creación exitosa (`200`): registrar el vehículo y verificar que se insertó el registro de auditoría (`accion: "crear_vehiculo"`, `entidad: "vehicles"`) en la misma transacción.

- `tests/api-clients.test.ts`:
  - **GET**:
    - Rechazo `401` si no hay autenticación.
    - Alcance para rol `conductor`: lista únicamente su propio registro de cliente.
    - Alcance para roles con permisos: lista todos los clientes registrados.
  - **POST**:
    - Requiere roles `admin` o `cobrador` (`requireRole("admin", "cobrador")`). Rechazo `401`/`403` en roles no autorizados (`conductor`, `viewer`).
    - Validación de esquema Zod (`400`): teléfono y nombre válidos; manejo de `documento` opcional.
    - Conflicto (`409`): teléfono ya existente.
    - Creación exitosa (`200`): inserción en `clients` y verificación de `audit_log` (`accion: "crear_cliente"`, `entidad: "clients"`).

- `tests/api-health.test.ts`:
  - **GET**:
    - Retorna status `200` y JSON con `{ ok: true, app: "CuotaMoto", ts: expect.any(String) }`.
    - No requiere autenticación.

### 2. Patrones y Convenciones de Test a Seguir
- Seguir la estructura de `tests/api-contracts.test.ts` y `tests/api-users.test.ts`.
- Mocker autorización con `vi.mock("@/server/authz", ...)` y `vi.hoisted(...)`.
- Utilizar `migrateTestDb()` en `beforeAll` y limpiar mocks en `beforeEach`.
- Utilizar utilitarios de `tests/helpers.ts` (`mkVehicle`, `mkClient`, `mkUser`, `auditByAccion`).
- Mantener la ejecución serial (no alterar `fileParallelism: false` en Vitest para evitar bloqueos en SQLite).

### 3. Actualización de Umbrales en `vitest.config.mts`
Modificar la configuración de cobertura para fijar el umbral en **55 %**:
```ts
coverage: {
  provider: "v8",
  reporter: ["text", "lcov"],
  include: ["src/**/*.ts", "src/**/*.tsx"],
  exclude: ["src/**/*.test.{ts,tsx}", "**/node_modules/**"],
  thresholds: {
    lines: 55,
    statements: 55,
  },
},
```

---

## Archivos Permitidos
- `tests/api-vehicles.test.ts`
- `tests/api-clients.test.ts`
- `tests/api-health.test.ts`
- `vitest.config.mts`
- (Opcional si se requiere un helper adicional de datos): `tests/helpers.ts`

## Archivos Prohibidos
- Archivos en `src/app/api/*` (salvo corrección puntual de bugs evidenciados por los tests, requiriendo justificación).
- `.env*`, `data/*`, `drizzle/*`.
- `package.json`, `package-lock.json`.

---

## Criterios de Aceptación
1. `npm run test` corre exitosamente, pasando el 100 % de los tests nuevos y preexistentes.
2. `npm run test:coverage` reporta una cobertura de líneas y sentencias superior o igual al **55 %**, pasando el check de thresholds sin alertas.
3. `npm run verify` finaliza con código de salida `0`.

---

## Comandos de Verificación
```bash
npm run test
npm run test:coverage
npm run verify
```
