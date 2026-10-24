# -*- coding: utf-8 -*-
"""
make_exploded.py — сборочный чертёж урны: разнесённый вид всех деталей.

Строит изометрическую проекцию панелей и печатных узлов с разнесением,
нумерует детали и печатает легенду.

Запуск:  python make_exploded.py
"""

import math
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
COS30 = 0.8660254


def iso(x, y, z):
    return ((x - y) * COS30, (x + y) * 0.5 - z)


def quad(x0, y0, x1, y1, z, plane):
    """Четырёхугольник панели в одной из плоскостей: xy, xz или yz."""
    if plane == "xy":
        pts = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
    elif plane == "xz":
        pts = [(x0, y0, z), (x1, y0, z), (x1, y0, y1), (x0, y0, y1)]
    else:  # yz
        pts = [(x0, y0, z), (x0, y1, z), (x0, y1, y1), (x0, y0, y1)]
    return pts


PARTS = [
    # имя, точки, смещение при разнесении, цвет
    ("Дно", quad(5, 5, 445, 495, 20, "xy"), (0, 0, -280), "#dbe6f5"),
    ("Передняя панель", quad(0, 0, 450, 900, 0, "xz"), (0, -680, 0), "#e8eef8"),
    ("Задняя панель", quad(0, 500, 450, 900, 0, "xz"), (0, 680, 0), "#e8eef8"),
    ("Левая боковина", quad(0, 0, 500, 900, 0, "yz"), (-680, 0, 0), "#e8eef8"),
    ("Правая боковина", quad(450, 0, 500, 900, 0, "yz"), (680, 0, 0), "#e8eef8"),
    ("Полка отсеков", quad(5, 5, 445, 495, 200, "xy"), (0, 0, 120), "#dbe6f5"),
    ("Перегородка A", quad(5, 250, 445, 600, 200, "xz"), (0, 0, 230), "#e3ecf7"),
    ("Перегородка B", quad(225, 5, 495, 600, 200, "yz"), (0, 0, 320), "#e3ecf7"),
    ("Палуба", quad(5, 5, 445, 495, 600, "xy"), (0, 0, 470), "#dbe6f5"),
    ("Дверь", quad(15, -14, 435, 590, 200, "xz"), (0, -1080, 0), "#ffffff"),
    ("Жёлоб", quad(140, 190, 310, 300, 610, "xy"), (0, 0, 640), "#fde68a"),
    ("Кронштейн оси", quad(190, 220, 260, 280, 620, "xy"), (0, 0, 740), "#fcd34d"),
    ("Заслонка", quad(160, 175, 290, 325, 660, "xy"), (0, 0, 830), "#fde68a"),
]


LABEL_SHIFT = {
    "Перегородка A": (-175, -8),
    "Перегородка B": (132, 52),
    "Палуба": (0, -28),
    "Полка отсеков": (0, 26),
    "Жёлоб": (-78, 0),
    "Кронштейн оси": (78, 12),
    "Дверь": (0, 0),
}


def main():
    width, height = 1600, 1180

    rings = []
    for name, pts, offset, color in PARTS:
        moved = [(p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]) for p in pts]

        flat = [iso(*p) for p in moved]
        cx = sum(p[0] for p in moved) / 4.0
        cy = sum(p[1] for p in moved) / 4.0
        cz = sum(p[2] for p in moved) / 4.0

        rings.append({
            "name": name,
            "flat": flat,
            "color": color,
            "depth": cx + cy + cz * 0.6,
            "center": (cx, cy, cz),
            "origin": (sum(p[0] for p in pts) / 4.0,
                       sum(p[1] for p in pts) / 4.0,
                       sum(p[2] for p in pts) / 4.0),
        })

    # масштаб
    xs = [p[0] for r in rings for p in r["flat"]]
    ys = [p[1] for r in rings for p in r["flat"]]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    pad_x, top, bottom = 90, 130, 250
    scale = min((width - pad_x * 2) / (max_x - min_x), (height - top - bottom) / (max_y - min_y))

    def proj(point):
        return (pad_x + (point[0] - min_x) * scale,
                top + (point[1] - min_y) * scale)

    rings.sort(key=lambda r: r["depth"])

    out = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="Inter, Arial">'
        % (width, height),
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text x="70" y="52" font-size="24" font-weight="800" fill="#0f172a">'
        'Сборка урны — разнесённый вид</text>',
        '<text x="70" y="78" font-size="13" fill="#64748b">'
        'Панели 5 мм по DXF, жёлтым — печатные детали. Порядок сборки — внизу, слева направо.</text>',
        '<line x1="70" y1="94" x2="%d" y2="94" stroke="#e2e8f0"/>' % (width - 70),
    ]

    for index, ring in enumerate(rings, start=1):
        points = " ".join("%.1f,%.1f" % proj(p) for p in ring["flat"])
        out.append('<polygon points="%s" fill="%s" stroke="#94a3b8" stroke-width="1.6"/>'
                   % (points, ring["color"]))

        # линия разнесения
        a = proj(iso(*ring["origin"]))
        b = proj(iso(*ring["center"]))
        out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#cbd5e1" '
                   'stroke-width="1" stroke-dasharray="4 4"/>' % (a[0], a[1], b[0], b[1]))

        dx, dy = LABEL_SHIFT.get(ring["name"], (0, 0))
        bx, by = b[0] + dx, b[1] + dy

        out.append('<circle cx="%.1f" cy="%.1f" r="13" fill="#2563eb"/>' % (bx, by))
        out.append('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="12" '
                   'font-weight="700" fill="#ffffff">%d</text>' % (bx, by + 4, index))

    # легенда
    out.append('<line x1="70" y1="%d" x2="%d" y2="%d" stroke="#e2e8f0"/>'
               % (height - 210, width - 70, height - 210))
    out.append('<text x="70" y="%d" font-size="15" font-weight="700" fill="#0f172a">'
               'Состав</text>' % (height - 178))

    for i, ring in enumerate(rings):
        column = i // 7
        row = i % 7
        x = 70 + column * 420
        y = height - 150 + row * 22
        out.append('<text x="%d" y="%d" font-size="12" fill="#475569">%d — %s</text>'
                   % (x, y, i + 1, ring["name"]))

    out.append('<text x="%d" y="%d" font-size="12" fill="#92400e">'
               'Жёлтые детали печатаются на A1, панели режутся по DXF из листа 5 мм.</text>'
               % (940, height - 150))
    out.append('<text x="%d" y="%d" font-size="12" fill="#92400e">'
               'Порядок: дно → боковины → задняя → полка → перегородки</text>' % (940, height - 128))
    out.append('<text x="%d" y="%d" font-size="12" fill="#92400e">'
               '→ палуба → кронштейн с осью → жёлоб → заслонка → дверь</text>' % (940, height - 106))

    out.append("</svg>")

    path = os.path.join(OUT_DIR, "exploded.svg")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(out))

    print("деталей: %d" % len(rings))
    print("масштаб: %.3f px/мм" % scale)


if __name__ == "__main__":
    main()
