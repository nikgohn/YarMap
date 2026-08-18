#!/usr/bin/env bun
import fs from "fs";
import path from "path";

const BASE_DIR = import.meta.dir;
const MAPS_DIR = path.join(BASE_DIR, "maps");

function tile2lon(x, z) {
  return (x / Math.pow(2, z)) * 360.0 - 180.0;
}

function tile2lat(y, z) {
  const n = Math.PI - (2.0 * Math.PI * y) / Math.pow(2, z);
  return (Math.atan(Math.sinh(n)) * 180.0) / Math.PI;
}

function processMaps() {
  if (!fs.existsSync(MAPS_DIR)) {
    console.error(`❌ Ошибка: Папка ${MAPS_DIR} не найдена!`);
    return;
  }

  console.log("🔍 Сканирование папки maps/ на наличие карт...");
  const mapIds = [];
  const entries = fs.readdirSync(MAPS_DIR).sort();

  for (const entry of entries) {
    const mapPath = path.join(MAPS_DIR, entry);
    if (!fs.statSync(mapPath).isDirectory() || entry.startsWith(".")) continue;

    const files = fs.readdirSync(mapPath);
    const zoomDirs = files.filter(f => /^\d+$/.test(f)).map(Number).sort((a, b) => a - b);
    if (zoomDirs.length === 0) continue;

    const minZoom = zoomDirs[0];
    const maxZoom = zoomDirs[zoomDirs.length - 1];

    const zp = path.join(mapPath, String(maxZoom));
    const xDirs = fs.readdirSync(zp).filter(f => /^\d+$/.test(f)).map(Number).sort((a, b) => a - b);
    if (xDirs.length === 0) continue;

    const minX = xDirs[0];
    const maxX = xDirs[xDirs.length - 1];

    const ys = [];
    let ext = "png";

    for (const x of xDirs) {
      const xDir = path.join(zp, String(x));
      const tileFiles = fs.readdirSync(xDir);
      for (const tf of tileFiles) {
        const parts = tf.split(".");
        if (parts.length === 2 && /^\d+$/.test(parts[0])) {
          ys.push(Number(parts[0]));
          ext = parts[1].toLowerCase();
        }
      }
    }

    if (ys.length === 0) continue;
    ys.sort((a, b) => a - b);
    const minY = ys[0];
    const maxY = ys[ys.length - 1];

    const west = tile2lon(minX, maxZoom);
    const east = tile2lon(maxX + 1, maxZoom);
    const north = tile2lat(minY, maxZoom);
    const south = tile2lat(maxY + 1, maxZoom);

    const bounds = [
      [Number(south.toFixed(5)), Number(west.toFixed(5))],
      [Number(north.toFixed(5)), Number(east.toFixed(5))]
    ];

    const dotMapDir = path.join(mapPath, ".map");
    if (!fs.existsSync(dotMapDir)) fs.mkdirSync(dotMapDir, { recursive: true });

    let originalFile = "";
    const dotMapFiles = fs.readdirSync(dotMapDir);
    // 1. Ищем original.*
    for (const f of dotMapFiles) {
      if (f.toLowerCase().startsWith("original.")) {
        originalFile = f;
        break;
      }
    }
    // 2. Ищем любое изображение в .map/
    if (!originalFile) {
      for (const f of dotMapFiles) {
        if (f.toLowerCase() !== "info.json" && /\.(jpg|jpeg|png|webp|tif|tiff|pdf)$/i.test(f)) {
          originalFile = f;
          break;
        }
      }
    }

    const infoPath = path.join(dotMapDir, "info.json");
    let info = {};
    const isNew = !fs.existsSync(infoPath);

    if (!isNew) {
      try {
        info = JSON.parse(fs.readFileSync(infoPath, "utf-8"));
      } catch (e) {
        console.warn(`  ⚠️ Не удалось прочитать ${infoPath}`);
      }
    }

    // 1. Всегда синхронизируем id с именем папки
    info.id = entry;

    // 2. Дефолтный title, если пустой или из шаблона
    if (!info.title || info.title === "Название исторического плана или карты") {
      info.title = `Исторический план (${entry})`;
    }
    if (info.year === undefined) info.year = "";
    if (!info.description) info.description = "Описание исторического плана.";
    if (!info.source) info.source = "Городской архив";
    if (info.group === undefined) info.group = "";
    if (info.groupTitle === undefined) info.groupTitle = "";

    // 3. Синхронизируем оригинал по реальному файлу на диске
    if (info.original) {
      if (!fs.existsSync(path.join(dotMapDir, info.original))) {
        info.original = originalFile;
      }
    } else {
      info.original = originalFile;
    }

    // 4. Технические параметры
    info.tileFormat = ext;
    info.minZoom = minZoom;
    info.maxNativeZoom = maxZoom;
    info.maxZoom = 22;
    if (info.defaultVisible === undefined) info.defaultVisible = false;
    if (info.defaultOpacity === undefined) info.defaultOpacity = 0.85;
    info.bounds = bounds;

    fs.writeFileSync(infoPath, JSON.stringify(info, null, 2), "utf-8");

    const status = isNew ? "✨ [НОВАЯ КАРТА]" : "🔄 [ОБНОВЛЕНО]";
    console.log(`  ${status} ${entry} (зумы: ${minZoom}–${maxZoom}, формат: ${ext}, охват: [${bounds[0]}, ${bounds[1]}])`);

    mapIds.push(entry);
  }

  const manifestPath = path.join(MAPS_DIR, "maps.json");
  fs.writeFileSync(manifestPath, JSON.stringify(mapIds, null, 2), "utf-8");

  console.log(`\n✅ Готово! Всего зарегистрировано карт: ${mapIds.length}`);
  console.log(`📄 Обновлен файл реестра: ${manifestPath}\n`);
}

processMaps();
