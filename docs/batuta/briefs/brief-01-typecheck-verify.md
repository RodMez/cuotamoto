# Brief 01: Incorporación de Scripts de Verificación y Typecheck

## Contexto del Proyecto
CuotaMoto utiliza TypeScript 5, ESLint 9, Next.js 16 y Vitest 5. Para permitir que el orquestador Batuta valide automáticamente los cambios en worktrees aislados, el repositorio debe exponer comandos estandarizados de validación de tipos y verificación integral.

---

## Objetivo
Agregar a `package.json` los scripts `"typecheck"` y `"verify"`, garantizando que la suite completa de calidad del código pueda ejecutarse de forma determinista y secuencial.

---

## Requisitos y Cambios Solicitados
1. Editar exclusivamente `package.json`.
2. Agregar el script `"typecheck"`:
   ```json
   "typecheck": "tsc --noEmit"
   ```
3. Agregar el script `"verify"`:
   ```json
   "verify": "npm run lint && npm run typecheck && npm run test && npm run build"
   ```
4. **No modificar** ninguno de los scripts preexistentes (`dev`, `build`, `start`, `lint`, `test`, `test:coverage`, `db:seed`, `db:generate`, `backup`).
5. **No agregar** dependencias ni devDependencies adicionales.

---

## Archivos Permitidos
- `package.json`

## Archivos Prohibidos
- `package-lock.json`
- Cualquier otro archivo del repositorio.

---

## Criterios de Aceptación
1. `npm run typecheck` ejecuta `tsc --noEmit` y finaliza con código de salida `0`.
2. `npm run verify` ejecuta sucesivamente:
   - `lint`
   - `typecheck`
   - `test`
   - `build`
   y termina exitosamente sin fallos. Si cualquiera de los pasos falla, el proceso debe abortar inmediatamente.

---

## Comandos de Verificación
```bash
npm run typecheck
npm run verify
```
