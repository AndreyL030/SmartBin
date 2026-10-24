# -*- coding: utf-8 -*-
"""
make_mechanism_stl.py — печатные детали механизма урны под Bambu Lab A1 (256×256×256).

Что генерируется:
  flap.stl          — заслонка измерительной камеры 180 × 120 × 3
  axle_bracket.stl  — кронштейн оси жёлоба с посадочным местом под подшипник 6001 (Ø28)
  tof_holder.stl    — держатель ToF-датчика (VL53L1X) под винт М3

Печатать PETG, сопло 0.4, слой 0.2, 3 периметра, 20% заполнение.
Все детали печатаются без поддержек.

Запуск:  python make_mechanism_stl.py
"""

import math
import os
import struct

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- меш
def quad(a, b, c, d, normal):
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


def ring(cx, cy, z0, z1, r_out, r_in, segments=72):
    """Кольцо (посадочное место подшипника) — отверстие настоящее."""
    tris = []
    step = 2 * math.pi / segments

    for i in range(segments):
        a0 = i * step
        a1 = (i + 1) * step

        o0 = (cx + r_out * math.cos(a0), cy + r_out * math.sin(a0))
        o1 = (cx + r_out * math.cos(a1), cy + r_out * math.sin(a1))
        i0 = (cx + r_in * math.cos(a0), cy + r_in * math.sin(a0))
        i1 = (cx + r_in * math.cos(a1), cy + r_in * math.sin(a1))

        mx, my = math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2)

        # внешняя стенка
        tris += quad((o0[0], o0[1], z0), (o1[0], o1[1], z0),
                     (o1[0], o1[1], z1), (o0[0], o0[1], z1), (mx, my, 0))
        # внутренняя стенка
        tris += quad((i0[0], i0[1], z0), (i1[0], i1[1], z0),
                     (i1[0], i1[1], z1), (i0[0], i0[1], z1), (-mx, -my, 0))
        # верхнее и нижнее кольцо
        tris += quad((i0[0], i0[1], z1), (i1[0], i1[1], z1),
                     (o1[0], o1[1], z1), (o0[0], o0[1], z1), (0, 0, 1))
        tris += quad((i0[0], i0[1], z0), (i1[0], i1[1], z0),
                     (o1[0], o1[1], z0), (o0[0], o0[1], z0), (0, 0, -1))
    return tris


def prism(p0, p1, p2, direction, thickness):
    """Призма из треугольника p0-p1-p2, выдавленная по direction на thickness."""
    dx, dy, dz = direction
    length = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
    offset = (dx / length * thickness, dy / length * thickness, dz / length * thickness)

    a, b, c = p0, p1, p2
    d = (a[0] + offset[0], a[1] + offset[1], a[2] + offset[2])
    e = (b[0] + offset[0], b[1] + offset[1], b[2] + offset[2])
    f = (c[0] + offset[0], c[1] + offset[1], c[2] + offset[2])

    vertices = (a, b, c, d, e, f)
    center = tuple(sum(v[i] for v in vertices) / 6.0 for i in range(3))

    def outward(points):
        cx = sum(p[0] for p in points) / len(points)
        cy = sum(p[1] for p in points) / len(points)
        cz = sum(p[2] for p in points) / len(points)
        return (cx - center[0], cy - center[1], cz - center[2])

    tris = []
    tris += quad(a, b, c, c, outward([a, b, c]))
    tris += quad(d, e, f, f, outward([d, e, f]))
    tris += quad(a, b, e, d, outward([a, b, e, d]))
    tris += quad(b, c, f, e, outward([b, c, f, e]))
    tris += quad(c, a, d, f, outward([c, a, d, f]))
    return tris


# ---------------------------------------------------------------- детали
def build_flap():
    """Заслонка-лоток 130 × 150 × 2.5 — дно измерительной камеры, две проушины под ось."""
    tris = []
    tris += box(0, 0, 0, 130, 150, 2.5)
    tris += box(0, 10, 2.5, 12, 46, 10)      # проушина
    tris += box(0, 104, 2.5, 12, 140, 10)    # проушина
    return tris


def build_axle_bracket():
    """Кронштейн: плита 70 × 60 × 5, кольцо под подшипник 6001 и два радиальных упора."""
    tris = []
    tris += box(0, 0, 0, 70, 60, 5)
    tris += ring(35, 30, 5, 15, 17.0, 14.0)          # 6001: наружный Ø28, внутренний Ø22
    # упоры от кольца к краям плиты, толщина 5 мм по Y
    tris += prism((18, 25, 5), (0, 25, 5), (18, 25, 33), (0, 1, 0), 5)
    tris += prism((52, 25, 33), (70, 25, 5), (52, 25, 5), (0, 1, 0), 5)
    return tris


def build_tof_holder():
    """Держатель ToF: площадка 28 × 34 × 3 и стойка 28 × 3 × 18."""
    tris = []
    tris += box(0, 0, 0, 28, 34, 3)
    tris += box(0, 0, 3, 28, 3, 21)
    return tris


# ---------------------------------------------------------------- вывод
def volume(tris):
    total = 0.0
    for a, b, c in tris:
        total += (
            a[0] * (b[1] * c[2] - b[2] * c[1])
            - a[1] * (b[0] * c[2] - b[2] * c[0])
            + a[2] * (b[0] * c[1] - b[1] * c[0])
        ) / 6.0
    return total


def save_stl(tris, path, header):
    with open(path, "wb") as handle:
        handle.write(header.encode("ascii", "replace")[:79].ljust(80, b" "))
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


def render(tris, path, title, subtitle, width=720, height=520):
    light = (0.45, -0.35, 0.82)
    ll = math.sqrt(sum(v * v for v in light))
    light = tuple(v / ll for v in light)

    def iso(p):
        return ((p[0] - p[1]) * 0.866, (p[0] + p[1]) * 0.5 - p[2])

    flat = [iso(p) for tri in tris for p in tri]
    min_x, max_x = min(p[0] for p in flat), max(p[0] for p in flat)
    min_y, max_y = min(p[1] for p in flat), max(p[1] for p in flat)

    pad_x, pad_y = 60, 90
    scale = min((width - pad_x * 2) / (max_x - min_x), (height - pad_y * 1.8) / (max_y - min_y))
    off_x = (width - (max_x - min_x) * scale) / 2 - min_x * scale
    off_y = pad_y + (height - pad_y * 1.8 - (max_y - min_y) * scale) / 2 - min_y * scale

    def project(p):
        px, py = iso(p)
        return (px * scale + off_x, py * scale + off_y)

    image = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(image)

    for a, b, c in sorted(tris, key=lambda t: sum(p[0] + p[1] + p[2] for p in t) / 3.0):
        ux, uy, uz = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        vx, vy, vz = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        nx, ny, nz = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
        length = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
        nx, ny, nz = nx / length, ny / length, nz / length

        shade = abs(nx * light[0] + ny * light[1] + nz * light[2])
        value = int(90 + 150 * shade)
        draw.polygon([project(a), project(b), project(c)],
                     fill=(max(0, value - 70), max(0, value - 35), min(255, value + 20)))

    try:
        font_big = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15)
        font_small = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 12)
    except Exception:                                  # noqa: BLE001
        font_big = font_small = ImageFont.load_default()

    draw.text((20, 16), title, fill=(15, 23, 42), font=font_big)
    draw.text((20, 38), subtitle, fill=(100, 116, 139), font=font_small)
    image.save(path)


PARTS = [
    ("flap", build_flap, "заслонка 130 × 150 × 2.5", "flap.stl — заслонка камеры"),
    ("axle_bracket", build_axle_bracket, "кронштейн оси, подшипник 6001",
     "axle_bracket.stl — кронштейн жёлоба"),
    ("tof_holder", build_tof_holder, "держатель ToF 28 × 34",
     "tof_holder.stl — держатель датчика"),
]

if __name__ == "__main__":
    for name, builder, subtitle, title in PARTS:
        tris = builder()
        path = os.path.join(OUT_DIR, name + ".stl")
        save_stl(tris, path, name)

        vol = volume(tris) / 1000.0
        print("%-16s %3d треуг.  %6.1f см³  %5.0f г PETG  %d байт" %
              (name + ".stl", len(tris), vol, vol * 1.27, os.path.getsize(path)))

        render(tris, os.path.join(OUT_DIR, name + "_preview.png"), title, subtitle)
