# SPEC-000: [Nombre de la Especificación]

## Objetivo
[Descripción concisa del problema que se busca resolver, la motivación técnica o de negocio, y el resultado esperado al finalizar la tarea.]

---

## Contexto y restricciones
- **Contexto técnico**: [Detalles de la arquitectura, tecnologías involucradas (Next.js 16, React 19, SQLite, Drizzle ORM, Vitest, etc.) y estado actual del código.]
- **Restricciones generales**:
  - No romper funcionalidades existentes ni alterar el comportamiento de contratos, ledger o auditoría sin justificación.
  - No agregar dependencias de `npm` a menos que se autorice explícitamente.
  - No acceder, inspeccionar ni imprimir variables de entorno reales (`.env*`) ni bases de datos de producción.
  - Prohibido ejecutar scripts destructivos (`scripts/backup.mjs`).
  - Todo cambio debe realizarse en un worktree o rama designada con commits pequeños y atómicos.

---

## Requisitos (lista de verificación)
- [ ] [Requisito 1: Descripción clara y granular]
- [ ] [Requisito 2: Descripción clara y granular]
- [ ] [Requisito 3: Descripción clara y granular]

---

## Archivos permitidos
> Lista exhaustiva (whitelist) de rutas donde el agente tiene autorización para crear o modificar código:
- `src/...`
- `tests/...`

---

## Archivos prohibidos
> Rutas protegidas o fuera del alcance de esta especificación. Cualquier modificación requerirá aprobación humana previa:
- `.env*`
- `Dockerfile`
- `docker-compose.yml`
- `docker-entrypoint.sh`
- `README_COOLIFY.md`
- `scripts/backup.mjs`
- `scripts/migrate.mjs`
- `drizzle/*` (migraciones existentes ya generadas)
- `.github/workflows/*`
- `package-lock.json`
- `data/*`

---

## Criterios de aceptación (cada uno con su comando)
1. **Verificación de estilo y linting**:
   - Condición: Cero errores y advertencias de ESLint en los archivos modificados y en el proyecto.
   - Comando: `npm run lint`
2. **Verificación de tipos estáticos**:
   - Condición: TypeScript compila en modo estricto sin errores de tipo.
   - Comando: `npm run typecheck`
3. **Suite de pruebas unitarias e integración**:
   - Condición: Todas las pruebas existentes y nuevas pasan en verde.
   - Comando: `npm run test`
4. **Cobertura de código (si aplica)**:
   - Condición: La cobertura cumple o supera el umbral configurado.
   - Comando: `npm run test:coverage`
5. **Compilación de producción**:
   - Condición: El build de Next.js genera los artefactos sin fallos.
   - Comando: `npm run build`

---

## Comandos de verificación
Secuencia ordenada obligatoria para certificar la tarea:
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
O de forma unificada:
```bash
npm run verify
```

---

## Pruebas requeridas (casos de borde)
- **Casos de éxito (happy path)**: [Pruebas de la funcionalidad esperada con datos válidos.]
- **Casos de borde (edge cases)**:
  - Entradas vacías, nulas, con espacios en blanco o tipos inesperados.
  - Manejo de fechas y zona horaria (`America/Bogota`).
  - Límite de montos (números negativos, decimales no permitidos, cuota base cero).
- **Autorización y roles**:
  - Peticiones sin autenticación (`401`).
  - Peticiones con roles sin permisos suficientes (`403`).
- **Integridad y transacciones**:
  - Verificación de inserción en `audit_log` en la misma transacción.
  - Verificación de atomicidad ante fallos (rollback de base de datos).

---

## Preguntas abiertas y supuestos
- **Supuestos asumidos**:
  - [Supuesto 1: e.g., Se asume que el esquema actual de la base de datos no requiere migraciones.]
- **Preguntas abiertas**:
  - [Duda 1: e.g., ¿Se requiere paginación en esta respuesta?]

---

## Specs afectadas
- [Listar otras especificaciones, módulos o APIs que tengan dependencia o impacto mutuo, e.g., SPEC-001, API de contratos, etc.]

---

## Fuera de alcance
- [Funcionalidad A que no forma parte de este sprint/tarea.]
- [Modificaciones de diseño de frontend fuera de la UI requerida.]
- [Optimización de rendimiento no especificada.]
