#!/usr/bin/env python3
"""
Скрипт автоматического сканирования и регистрации карт:
1. Проверяет папку maps/ на наличие новых карт.
2. Для каждой карты определяет зумы, формат тайлов (png/jpg) и рассчитывает точные географические границы (bounds).
3. Создает папку .map и info.json (если их нет) или обновляет технические параметры в существующем info.json.
4. Обновляет список зарегистрированных карт в maps/maps.json.
"""

import os
import math
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MAPS_DIR = os.path.join(BASE_DIR, "maps")

def tile2lon(x, z):
    return x / (1 << z) * 360.0 - 180.0

def tile2lat(y, z):
    n = math.pi - 2.0 * math.pi * y / (1 << z)
    return math.degrees(math.atan(math.sinh(n)))

def process_maps():
    if not os.path.exists(MAPS_DIR):
        print(f"❌ Ошибка: Папка {MAPS_DIR} не найдена!")
        return

    print("🔍 Сканирование папки maps/ на наличие карт...")
    map_ids = []

    for entry in sorted(os.listdir(MAPS_DIR)):
        map_path = os.path.join(MAPS_DIR, entry)
        if not os.path.isdir(map_path) or entry.startswith("."):
            continue

        # Проверяем наличие тайловых папок (числовые имена)
        zoom_dirs = [int(z) for z in os.listdir(map_path) if z.isdigit()]
        if not zoom_dirs:
            continue

        min_zoom = min(zoom_dirs)
        max_zoom = max(zoom_dirs)

        # Анализируем самый глубокий зум для точного расчета границ
        zp = os.path.join(map_path, str(max_zoom))
        xs = [int(x) for x in os.listdir(zp) if x.isdigit()]
        if not xs:
            continue

        min_x, max_x = min(xs), max(xs)
        ys = []
        ext = "png"

        for x in xs:
            x_dir = os.path.join(zp, str(x))
            for f in os.listdir(x_dir):
                parts = f.split(".")
                if len(parts) == 2 and parts[0].isdigit():
                    ys.append(int(parts[0]))
                    ext = parts[1].lower()

        if not ys:
            continue

        min_y, max_y = min(ys), max(ys)

        west = tile2lon(min_x, max_zoom)
        east = tile2lon(max_x + 1, max_zoom)
        north = tile2lat(min_y, max_zoom)
        south = tile2lat(max_y + 1, max_zoom)

        bounds = [
            [round(south, 5), round(west, 5)],
            [round(north, 5), round(east, 5)]
        ]

        # Создаем папку .map
        dot_map_dir = os.path.join(map_path, ".map")
        os.makedirs(dot_map_dir, exist_ok=True)

        # Проверяем наличие оригинала в .map/
        original_file = ""
        for f in os.listdir(dot_map_dir):
            if f.lower().startswith("original."):
                original_file = f
                break

        info_path = os.path.join(dot_map_dir, "info.json")
        info = {}

        if os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    info = json.load(f)
            except Exception as e:
                print(f"  ⚠️  Не удалось прочитать {info_path}: {e}")

        is_new = not os.path.exists(info_path)

        # Заполняем / обновляем поля
        info["id"] = entry
        if "title" not in info or not info["title"]:
            info["title"] = f"Исторический план ({entry})"
        if "year" not in info:
            info["year"] = ""
        if "description" not in info:
            info["description"] = "Описание исторического плана."
        if "source" not in info:
            info["source"] = "Городской архив"
        if "original" not in info or not info["original"]:
            info["original"] = original_file

        info["tileFormat"] = ext
        info["minZoom"] = min_zoom
        info["maxNativeZoom"] = max_zoom
        info["maxZoom"] = 22
        if "defaultVisible" not in info:
            info["defaultVisible"] = False
        if "defaultOpacity" not in info:
            info["defaultOpacity"] = 0.85

        info["bounds"] = bounds

        with open(info_path, "w", encoding="utf-8") as f:
            json.dump(info, f, ensure_ascii=False, indent=2)

        status = "✨ [НОВАЯ КАРТА]" if is_new else "🔄 [ОБНОВЛЕНО]"
        print(f"  {status} {entry} (зумы: {min_zoom}–{max_zoom}, формат: {ext}, охват: {bounds})")

        map_ids.append(entry)

    # Обновляем maps/maps.json
    manifest_path = os.path.join(MAPS_DIR, "maps.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(map_ids, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Готово! Всего зарегистрировано карт: {len(map_ids)}")
    print(f"📄 Обновлен файл реестра: {manifest_path}\n")

if __name__ == "__main__":
    process_maps()
