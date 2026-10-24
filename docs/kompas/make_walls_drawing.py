# -*- coding: utf-8 -*-
"""
make_walls_drawing.py — чертежи всех стенок урны с размерами.

Лист A: передняя, задняя и две боковины.
Лист B: дно, палуба, полка, дверь и две перегородки.

Координаты отверстий и вырезов даны от левого нижнего угла детали.

Запуск:  python make_walls_drawing.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from make_all_panels_dxf import PANELS      # noqa: E402

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

STROKE = "#334155"
FILL = "#f8fafc"
ACCENT = "#2563eb"
MUTED = "#64748b"


def panel_by_name(name):
    for p in PANELS:
        if p["name"].startswith(name):
            return p
    raise KeyError(name)


def draw_panel(parts, panel, ox, oy, scale, notes):
    w, h = panel["w"], panel["h"]
    sw, sh = w * scale, h * scale

    def sx(x):
        return ox + x * scale

    def sy(y):
        return oy + (h - y) * scale

    # контур
    parts.append(
        '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="%s" stroke="%s" stroke-width="1.8"/>'
        % (ox, oy, sw, sh, panel["r"] * scale, FILL, STROKE))

    # отверстия
    for (cx, cy, r) in panel["holes"]:
        parts.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#ffffff" stroke="%s" stroke-width="1.3"/>'
                     % (sx(cx), sy(cy), max(r * scale, 1.6), ACCENT))

    # вырезы
    for (x, y, cw, ch, r) in panel["cuts"]:
        parts.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" fill="#ffffff" stroke="%s" stroke-width="1.3"/>'
                     % (sx(x), sy(y + ch), cw * scale, ch * scale, r * scale, ACCENT))

    # габаритные размеры
    dim_y = oy + sh + 30
    parts.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1" marker-start="url(#t)" marker-end="url(#t)"/>'
                 % (ox, dim_y, ox + sw, dim_y, MUTED))
    parts.append('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="12" fill="%s">%g</text>'
                 % (ox + sw / 2, dim_y + 16, "#334155", w))

    dim_x = ox - 24
    parts.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1" marker-start="url(#t)" marker-end="url(#t)"/>'
                 % (dim_x, oy, dim_x, oy + sh, MUTED))
    parts.append('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="12" fill="%s" transform="rotate(-90 %.1f %.1f)">%g</text>'
                 % (dim_x - 6, oy + sh / 2, "#334155", dim_x - 6, oy + sh / 2, h))

    # подписи
    parts.append('<text x="%.1f" y="%.1f" font-size="13" font-weight="700" fill="#0f172a">%s</text>'
                 % (ox, oy - 48, panel["name"]))

    for i, line in enumerate(notes):
        parts.append('<text x="%.1f" y="%.1f" font-size="10.5" fill="%s">%s</text>'
                     % (ox, oy - 32 + i * 13, MUTED, line))


def sheet(path, panels, title, subtitle, width, height):
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="Inter, Arial">' % (width, height),
        '<defs><marker id="t" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">'
        '<path d="M0 0 L8 4 L0 8 z" fill="%s"/></marker></defs>' % MUTED,
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text x="60" y="46" font-size="20" font-weight="800" fill="#0f172a">%s</text>' % title,
        '<text x="60" y="70" font-size="12" fill="%s">%s</text>' % (MUTED, subtitle),
        '<line x1="60" y1="86" x2="%d" y2="86" stroke="#e2e8f0"/>' % (width - 60),
    ]

    for (panel, ox, oy, scale, notes) in panels:
        draw_panel(parts, panel, ox, oy, scale, notes)

    parts.append('<text x="60" y="%d" font-size="10.5" fill="%s">Все размеры в миллиметрах. Координаты вырезов — от левого нижнего угла детали. Толщина листа 5 мм.</text>'
                 % (height - 24, MUTED))
    parts.append("</svg>")

    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(parts))


if __name__ == "__main__":
    front = panel_by_name("FRONT")
    back = panel_by_name("BACK")
    side = panel_by_name("SIDE")

    sheet(
        os.path.join(OUT_DIR, "walls_A.svg"),
        [
            (front, 120, 220, 0.55, [
                "окно 280 × 110, угол (85; 745)",
                "проём двери 400 × 390, угол (25; 200)",
                "радиусы скруглений R10 / R8",
            ]),
            (back, 540, 220, 0.55, [
                "Ø40 под кабель, центр (405; 60)",
                "3 паза 100 × 6, низ на 800",
                "R10 по углам",
            ]),
            (side, 960, 220, 0.55, [
                "6 × Ø6,5, по 25 от кромок",
                "4 паза 70 × 6, низ на 794",
                "R10 по углам, 2 шт зеркально",
            ]),
        ],
        "Стенки корпуса — чертёж",
        "Передняя, задняя и боковины. Лист A.",
        1700, 900,
    )

    bottom = panel_by_name("BOTTOM")
    deck = panel_by_name("DECK")
    shelf = panel_by_name("SHELF")
    door = panel_by_name("DOOR")
    div_a = panel_by_name("DIVIDER A")
    div_b = panel_by_name("DIVIDER B")

    sheet(
        os.path.join(OUT_DIR, "walls_B.svg"),
        [
            (bottom, 120, 210, 0.6, [
                "4 × Ø6,5, по 25 от кромок",
                "Ø30 под кабель, центр (400; 80)",
            ]),
            (deck, 500, 210, 0.6, [
                "4 × Ø110: (120; 133), (320; 133),",
                "(120; 357), (320; 357)",
                "4 × Ø6,5, по 20 от кромок",
            ]),
            (shelf, 880, 210, 0.6, [
                "4 × Ø6,5, по 25 от кромок",
            ]),
            (door, 1260, 210, 0.6, [
                "3 × Ø5 под петли: (15; 50/205/360)",
                "Ø20 под замок: (405; 205)",
            ]),
            (div_a, 120, 760, 0.6, ["без вырезов"]),
            (div_b, 500, 760, 0.6, ["без вырезов"]),
        ],
        "Дно, палуба, полка, дверь, перегородки",
        "Лист B. Палуба несёт четыре окна под отсеки.",
        1700, 1250,
    )

    print("готово: walls_A.svg, walls_B.svg")
