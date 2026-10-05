import fs from "node:fs";
import path from "node:path";

const src = process.env.DATABASE_URL?.replace("file:", "") ?? "./data/prod.db";
const dir = path.join(path.dirname(src), "backups");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const dest = path.join(dir, `prod-${new Date().toISOString().slice(0, 10)}.db`);
// .backup via sqlite CLI recomendado en Coolify cron; aquí copia simple (WAL checkpoint previo ideal)
fs.copyFileSync(src, dest);
console.log(`[backup] ${src} -> ${dest}`);
