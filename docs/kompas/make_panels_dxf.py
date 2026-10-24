# -*- coding: utf-8 -*-
"""
make_panels_dxf.py — генерирует DXF (R12) для лазерной резки панелей урны
и SVG-превью из тех же чисел, чтобы глазами проверить геометрию.

Контуры и отверстия:
  front_panel.dxf — 450 × 900, окно 280 × 110, проём двери 400 × 390
  side_panel.dxf  — 500 × 900, 6 отверстий Ø6.5, 4 паза 70 × 6,
                    два отверстия под полку, отверстие под кабель Ø40

Запуск:  python make_panels_dxf.py
"""

import math
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BULGE_90 = math.tan(math.radians(90) / 4)      # 0.41421356...


# ---------------------------------------------------------------- геометрия
def rounded_rect(x0, y0, x1, y1, r):
    """Прямоугольник со скруглениями: список (x, y, bulge) по часовой от левого-нижнего."""
    if r <= 0:
        return [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)]

    b = BULGE_90
    return [
        (x0 + r, y0, 0),
        (x1 - r, y0, b),
        (x1, y0 + r, 0),
        (x1, y1 - r, b),
        (x1 - r, y1, 0),
        (x0 + r, y1, b),
        (x0, y1 - r, 0),
        (x0, y0 + r, b),
    ]


def rect(x0, y0, x1, y1):
    return rounded_rect(x0, y0, x1, y1, 0)


# ---------------------------------------------------------------- запись DXF
def n(value):
    if isinstance(value, float):
        text = "%.4f" % value
        return text.rstrip("0").rstrip(".")
    return str(value)


class Dxf:
    def __init__(self):
        self.entities = []

    def circle(self, cx, cy, r):
        self.entities.append(
            "0\nCIRCLE\n8\n0\n10\n%s\n20\n%s\n30\n0\n40\n%s\n" % (n(cx), n(cy), n(r))
        )

    def polyline(self, points, closed=True):
        if len(points) < 2:
            return

        out = ["0\nPOLYLINE\n8\n0\n66\n1\n70\n%d\n" % (1 if closed else 0)]
        for (x, y, bulge) in points:
            out.append("0\nVERTEX\n8\n0\n10\n%s\n20\n%s\n30\n0\n" % (n(x), n(y)))
            if bulge:
                out.append("42\n%s\n" % n(bulge))
        out.append("0\nSEQEND\n8\n0\n")
        self.entities.append("".join(out))

    def save(self, path):
        header = (
            "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n"
            "9\n$INSBASE\n10\n0\n20\n0\n30\n0\n"
            "9\n$EXTMIN\n10\n0\n20\n0\n30\n0\n"
            "9\n$EXTMAX\n10\n1000\n20\n1000\n30\n0\n"
            "0\nENDSEC\n"
        )
        tables = (
            "0\nSECTION\n2\nTABLES\n"
            "0\nTABLE\n2\nLAYER\n70\n1\n"
            "0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n"
            "0\nENDTAB\n0\nENDSEC\n"
        )
        body = "0\nSECTION\n2\nENTITIES\n" + "".join(self.entities) + "0\nENDSEC\n0\nEOF\n"

        with open(path, "w", encoding="ascii", newline="\r\n") as handle:
            handle.write(header + tables + body)


# ---------------------------------------------------------------- превью SVG
def svg_panel(path, width, height, shapes, title, subtitle=''):
    pad = 70
    scale = min(360.0 / width, 720.0 / height)
    w = width * scale
    h = height * scale

    def px(x):
        return pad + x * scale

    def py(y):
        return pad + (height - y) * scale

    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="Inter, Arial">' %
        (int(w + pad * 2), int(h + pad * 2 + 56)),
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<text x="%d" y="24" font-size="14" font-weight="700" fill="#0f172a">%s</text>' % (pad, title),
        '<text x="%d" y="42" font-size="11" fill="#64748b">%s</text>' % (pad, subtitle),
        '<rect x="%s" y="%s" width="%s" height="%s" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>' %
        (n(px(0)), n(py(height)), n(w), n(h)),
    ]

    for shape in shapes:
        if shape[0] == "hole":
            _, cx, cy, r = shape
            parts.append(
                '<circle cx="%s" cy="%s" r="%s" fill="#ffffff" stroke="#2563eb" stroke-width="1.4"/>' %
                (n(px(cx)), n(py(cy)), n(max(r * scale, 1.5)))
            )
        elif shape[0] == "rect":
            _, x0, y0, x1, y1, r = shape
            parts.append(
                '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="#ffffff" stroke="#2563eb" stroke-width="1.6"/>' %
                (n(px(x0)), n(py(y1)), n((x1 - x0) * scale), n((y1 - y0) * scale), n(r * scale))
            )

    parts.append("</svg>")

    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(parts))


# ---------------------------------------------------------------- сборка
def build_front():
    dxf = Dxf()
    dxf.polyline(rounded_rect(0, 0, 450, 900, 10))                 # контур
    dxf.polyline(rounded_rect(85, 745, 365, 855, 10))              # окно загрузки
    dxf.polyline(rounded_rect(25, 200, 425, 590, 8))               # проём двери
    dxf.save(os.path.join(OUT_DIR, "front_panel.dxf"))

    svg_panel(
        os.path.join(OUT_DIR, "front_panel_preview.svg"), 450, 900,
        [("rect", 85, 745, 365, 855, 10), ("rect", 25, 200, 425, 590, 8)],
        "front_panel.dxf",
        "450 × 900 · окно 280 × 110 · дверь 400 × 390",
    )


def build_side():
    dxf = Dxf()
    dxf.polyline(rounded_rect(0, 0, 500, 900, 10))

    for (x, y) in [(25, 40), (25, 450), (25, 860), (475, 40), (475, 450), (475, 860)]:
        dxf.circle(x, y, 3.25)

    for (x, y) in [(170, 200), (330, 200)]:
        dxf.circle(x, y, 3.25)

    for x in (44, 158, 272, 386):
        dxf.polyline(rect(x, 794, x + 70, 800))

    dxf.circle(440, 60, 20)
    dxf.save(os.path.join(OUT_DIR, "side_panel.dxf"))

    shapes = [("hole", x, y, 3.25) for (x, y) in
              [(25, 40), (25, 450), (25, 860), (475, 40), (475, 450), (475, 860), (170, 200), (330, 200)]]
    shapes += [("rect", x, 794, x + 70, 800, 0) for x in (44, 158, 272, 386)]
    shapes.append(("hole", 440, 60, 20))

    svg_panel(
        os.path.join(OUT_DIR, "side_panel_preview.svg"), 500, 900, shapes,
        "side_panel.dxf",
        "500 × 900 · Ø6.5 ×8 · пазы 70 × 6 ×4 · кабель Ø40",
    )


def check(path, expected):
    with open(path, "r", encoding="ascii") as handle:
        data = handle.read()
    ok = data.startswith("0\nSECTION") and data.rstrip().endswith("EOF")
    ents = data.count("\nCIRCLE\n") + data.count("\nPOLYLINE\n")
    return ok, ents, expected


if __name__ == "__main__":
    build_front()
    build_side()

    for name, expected in (("front_panel.dxf", 3), ("side_panel.dxf", 15)):
        path = os.path.join(OUT_DIR, name)
        ok, ents, exp = check(path, expected)
        size = os.path.getsize(path)
        print("%-18s сущностей: %-3d (ожидалось %d), %d байт, структура %s" %
              (name, ents, exp, size, "ок" if ok else "БИТАЯ"))
