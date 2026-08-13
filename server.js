import { serve } from "bun";
import { join } from "path";

const PORT = 3000;
const BASE_DIR = import.meta.dir;

console.log(`\n🗺️  Сервер запущен! Откройте в браузере: http://localhost:${PORT}\n`);

serve({
  port: PORT,
  async fetch(req) {
    let pathname = new URL(req.url).pathname;
    if (pathname === "/") pathname = "/index.html";

    const filePath = join(BASE_DIR, decodeURIComponent(pathname));
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return new Response(file);
    }
    return new Response("Not Found", { status: 404 });
  },
});
