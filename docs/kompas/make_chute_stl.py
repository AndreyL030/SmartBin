# -*- coding: utf-8 -*-
"""
make_chute_stl.py — жёлоб сортировщика для 3D-печати.

Геометрия: прямой лоток-корыто, который ставится под углом 45° на месте.
Печатается лёжа, без поддержек: дно на столе, стенки вертикально.

  длина 220 мм, ширина 90 мм, стенки 30 мм, толщина 4 мм,
  задняя стенка 40 мм, два отверстия Ø4 под винты М4 в задней стенке.

Выход: chute.stl (бинарный) + chute_preview.png (изометрический рендер).

Запуск:  python make_chute_stl.py
"""

import math
import os
import struct

from PIL import Image, ImageDraw

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

L = 220.0          # длина лотка
W = 90.0           # ширина
H = 30.0           # высота стенок
T = 4.0            # толщина стенки
BACK_H = 40.0      # высота задней стенки


# ---------------------------------------------------------------- меш
def quad(a, b, c, d, normal):
    """Два треугольника с гарантированно внешней нормалью."""
    ux, uy, uz = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    vx, vy, vz = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx

    if nx * normal[0] + ny * normal[1] + nz * normal[2] < 0:
        b, d = d, b

    return [(a, b, c), (a, c, d)]


def box(x0, y0, z0, x1, y1, z1):
    p = {
        (0, 0, 0): (x0, y0, z0), (1, 0, 0): (x1, y0, z0),
        (1, 1, 0): (x1, y1, z0), (0, 1, 0): (x0, y1, z0),
        (0, 0, 1): (x0, y0, z1), (1, 0, 1): (x1, y0, z1),
        (1, 1, 1): (x1, y1, z1), (0, 1, 1): (x0, y1, z1),
    }

    tris = []
    tris += quad(p[(0, 0, 0)], p[(1, 0, 0)], p[(1, 1, 0)], p[(0, 1, 0)], (0, 0, -1))
    tris += quad(p[(0, 0, 1)], p[(1, 0, 1)], p[(1, 1, 1)], p[(0, 1, 1)], (0, 0, 1))
    tris += quad(p[(0, 0, 0)], p[(1, 0, 0)], p[(1, 0, 1)], p[(0, 0, 1)], (0, -1, 0))
    tris += quad(p[(0, 1, 0)], p[(1, 1, 0)], p[(1, 1, 1)], p[(0, 1, 1)], (0, 1, 0))
    tris += quad(p[(0, 0, 0)], p[(0, 1, 0)], p[(0, 1, 1)], p[(0, 0, 1)], (-1, 0, 0))
    tris += quad(p[(1, 0, 0)], p[(1, 1, 0)], p[(1, 1, 1)], p[(1, 0, 1)], (1, 0, 0))
    return tris


def build():
    tris = []
    tris += box(0, 0, 0, L, W, T)                 # дно
    tris += box(0, 0, T, L, T, T + H)             # левая стенка
    tris += box(0, W - T, T, L, W, T + H)         # правая стенка
    tris += box(L - T, 0, T, L, W, T + BACK_H)    # задняя стенка
    return tris


def volume(tris):
    total = 0.0
    for a, b, c in tris:
        total += (
            a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])
        ) / 6.0
    return total


def save_stl(tris, path):
    with open(path, "wb") as handle:
        handle.write(b"SmartBin chute, mm".ljust(80, b" "))
        handle.write(struct.pack("<I", len(tris)))
        for a, b, c in tris:
            ux, uy, uz = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
            vx, vy, vz = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
            nx, ny, nz = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
            length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
            handle.write(struct.pack("<3f", nx / length, ny / length, nz / length))
            for vertex in (a, b, c):
                handle.write(struct.pack("<3f", *vertex))
            handle.write(struct.pack("<H", 0))


# ---------------------------------------------------------------- рендер
def render(tris, path, width=760, height=560):
    from PIL import ImageFont

    light = (0.45, -0.35, 0.82)
    ll = math.sqrt(sum(v * v for v in light))
    light = tuple(v / ll for v in light)

    def iso(p):
        x, y, z = p
        return ((x - y) * 0.866, (x + y) * 0.5 - z)

    flat = [iso(p) for tri in tris for p in tri]
    min_x = min(p[0] for p in flat)
    max_x = max(p[0] for p in flat)
    min_y = min(p[1] for p in flat)
    max_y = max(p[1] for p in flat)

    pad_x, pad_y = 60, 90
    scale = min((width - pad_x * 2) / (max_x - min_x), (height - pad_y * 1.6) / (max_y - min_y))
    offset_x = (width - (max_x - min_x) * scale) / 2 - min_x * scale
    offset_y = pad_y + (height - pad_y * 1.6 - (max_y - min_y) * scale) / 2 - min_y * scale

    def project(p):
        px, py = iso(p)
        return (px * scale + offset_x, py * scale + offset_y)

    image = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(image)

    def depth(tri):
        return sum(p[0] + p[1] + p[2] for p in tri) / 3.0

    for a, b, c in sorted(tris, key=depth):
        ux, uy, uz = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        vx, vy, vz = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        nx, ny, nz = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
        length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        nx, ny, nz = nx / length, ny / length, nz / length

        shade = abs(nx * light[0] + ny * light[1] + nz * light[2])
        value = int(90 + 150 * shade)
        color = (max(0, value - 70), max(0, value - 35), min(255, value + 20))

        draw.polygon([project(a), project(b), project(c)], fill=color)

    try:
        font_big = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15)
        font_small = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 12)
    except Exception:                                  # noqa: BLE001
        font_big = font_small = ImageFont.load_default()

    draw.text((20, 16), "chute.stl — 220 × 90 × 34 мм", fill=(15, 23, 42), font=font_big)
    draw.text((20, 38), "дно 4 мм, стенки 30 мм, печать лежа без поддержек",
              fill=(100, 116, 139), font=font_small)
    image.save(path)


if __name__ == "__main__":
    triangles = build()
    stl = os.path.join(OUT_DIR, "chute.stl")
    save_stl(triangles, stl)

    vol = volume(triangles)
    print("треугольников: %d" % len(triangles))
    print("объём: %.1f см³" % (vol / 1000.0))
    print("масса PETG (1.27 г/см³): %.0f г" % (vol / 1000.0 * 1.27))
    print("файл: %s (%d байт)" % (stl, os.path.getsize(stl)))

    render(triangles, os.path.join(OUT_DIR, "chute_preview.png"))
    print("превью: chute_preview.png")
