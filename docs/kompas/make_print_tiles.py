# -*- coding: utf-8 -*-
"""
make_print_tiles.py — раскладывает панели урны на плитки под стол Bambu Lab A1.

Каждая панель режется на плитки не больше 245 × 245 мм. Отверстия и проёмы
переносятся в свои плитки; круглые отверстия аппроксимируются квадратами
того же габарита (сверлить потом или оставить квадратными).

Выход: папка print_tiles/ с STL, архив print_tiles.zip и MANIFEST.md.

Запуск:  python make_print_tiles.py
"""

import math
import os
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from make_all_panels_dxf import PANELS          # noqa: E402
from make_mechanism_stl import box, volume, save_stl   # noqa: E402

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
TILE_DIR = os.path.join(OUT_DIR, "print_tiles")
THICKNESS = 3.0
MAX_TILE = 245.0


def tile_grid(size, max_tile):
    count = max(1, int(math.ceil(size / max_tile)))
    return count, size / count


def clip(rect, bounds):
    x0, y0, x1, y1 = rect
    bx0, by0, bx1, by1 = bounds
    nx0, ny0 = max(x0, bx0), max(y0, by0)
    nx1, ny1 = min(x1, bx1), min(y1, by1)
    if nx1 - nx0 < 0.5 or ny1 - ny0 < 0.5:
        return None
    return (nx0, ny0, nx1, ny1)


def cells(total, holes):
    """Разбивает прямоугольник на прямоугольники, вырезая отверстия."""
    xs = {0.0, total[0]}
    ys = {0.0, total[1]}

    for (x0, y0, x1, y1) in holes:
        xs.update([max(0.0, x0), min(total[0], x1)])
        ys.update([max(0.0, y0), min(total[1], y1)])

    xs = sorted(xs)
    ys = sorted(ys)

    result = []
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx = (xs[i] + xs[i + 1]) / 2
            cy = (ys[j] + ys[j + 1]) / 2

            if any(h[0] <= cx <= h[2] and h[1] <= cy <= h[3] for h in holes):
                continue

            result.append((xs[i], ys[j], xs[i + 1], ys[j + 1]))

    return result


def build_panel(panel, index):
    w, h = panel["w"], panel["h"]
    cols, tw = tile_grid(w, MAX_TILE)
    rows, th = tile_grid(h, MAX_TILE)

    # отверстия -> прямоугольники в координатах панели
    openings = []
    for (cx, cy, r) in panel.get("holes", []):
        if r < 5:                      # мелкий крепёж не переносим, сверлим потом
            continue
        openings.append((cx - r, cy - r, cx + r, cy + r))

    for (x, y, cw, ch, r) in panel.get("cuts", []):
        openings.append((x, y, x + cw, y + ch))

    files = []

    for c in range(cols):
        for r in range(rows):
            x0, y0 = c * tw, r * th
            x1, y1 = min(w, x0 + tw), min(h, y0 + th)
            bounds = (x0, y0, x1, y1)

            local_holes = []
            for hole in openings:
                clipped = clip(hole, bounds)
                if clipped:
                    local_holes.append((clipped[0] - x0, clipped[1] - y0,
                                        clipped[2] - x0, clipped[3] - y0))

            areas = cells((x1 - x0, y1 - y0), local_holes)
            tris = []
            for (ax, ay, bx, by) in areas:
                tris += box(ax, ay, 0, bx, by, THICKNESS)

            name = "%02d_%s_c%d_r%d" % (index + 1, panel["name"].split()[0].lower(), c + 1, r + 1)
            path = os.path.join(TILE_DIR, name + ".stl")
            save_stl(tris, path, name)

            files.append({
                "name": name,
                "size": (round(x1 - x0, 1), round(y1 - y0, 1)),
                "volume": volume(tris) / 1000.0,
                "file": path,
                "tris": tris,
            })

    return files


def build_strap():
    """Накладка на стык плиток изнутри: 60 × 30 × 1.5, клеится или на саморезы."""
    tris = box(0, 0, 0, 60, 30, 1.5)
    path = os.path.join(TILE_DIR, "seam_strap.stl")
    save_stl(tris, path, "seam_strap")
    return {"name": "seam_strap", "size": (60, 30), "volume": volume(tris) / 1000.0, "file": path}


if __name__ == "__main__":
    if os.path.isdir(TILE_DIR):
        shutil.rmtree(TILE_DIR)
    os.makedirs(TILE_DIR)

    all_files = []
    for index, panel in enumerate(PANELS):
        all_files += build_panel(panel, index)

    strap = build_strap()

    total_volume = sum(f["volume"] for f in all_files)

    lines = [
        "# Плитки для печати корпуса",
        "",
        "Толщина %.1f мм, стол A1 (245 × 245 мм на плитку)." % THICKNESS,
        "Всего плиток: **%d**, плюс накладки на стыки." % len(all_files),
        "",
        "| Файл | Размер, мм | Объём, см³ |",
        "| --- | --- | --- |",
    ]
    for f in all_files:
        lines.append("| `%s.stl` | %g × %g | %.1f |" % (f["name"], f["size"][0], f["size"][1], f["volume"]))

    lines += [
        "",
        "**Итого объём: %.1f л, при PETG это %.1f кг.**" % (total_volume / 1000.0, total_volume / 1000.0 * 1.27),
        "С заполнением 20 %% слайсер покажет примерно вдвое меньше.",
        "",
        "Накладка на стык: `%s.stl`, %.1f см³, нужно около 70 шт." % (strap["name"], strap["volume"]),
        "",
        "## Что важно знать",
        "",
        "- Круглые отверстия больше Ø10 заменены квадратами того же габарита.",
        "- Крепёж Ø6,5 не вырезан: сверлить по месту, иначе плитка не совпадёт с ответной.",
        "- Окно 280 мм шире плитки, поэтому в проёме останется вертикальный шов.",
        "- Плитки стыкуются впритык, изнутри — накладка 60 × 30 на клей или саморезы 3 × 10.",
    ]

    manifest = os.path.join(OUT_DIR, "print_tiles_MANIFEST.md")
    with open(manifest, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))

    archive = os.path.join(OUT_DIR, "print_tiles.zip")
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in all_files:
            zf.write(f["file"], "print_tiles/" + os.path.basename(f["file"]))
        zf.write(strap["file"], "print_tiles/" + os.path.basename(strap["file"]))
        zf.write(manifest, "print_tiles/MANIFEST.md")

    print("плиток: %d" % len(all_files))
    print("накладок в наборе: 1 (нужно ~70)")
    print("объём: %.1f л -> %.1f кг PETG" % (total_volume / 1000.0, total_volume / 1000.0 * 1.27))
    print("архив: %s (%d байт)" % (archive, os.path.getsize(archive)))

    # превью двух показательных плиток: с большим окном и с краем проёма
    from make_mechanism_stl import render

    for demo in all_files:
        if demo["name"].startswith("06_deck_c1_r1"):
            render(demo["tris"],
                   os.path.join(OUT_DIR, "tile_deck_preview.png"),
                   "%s.stl — плитка палубы" % demo["name"],
                   "%g × %g мм, окно 110 × 110 мм" % (demo["size"][0], demo["size"][1]))
            break
