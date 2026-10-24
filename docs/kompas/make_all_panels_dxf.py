# -*- coding: utf-8 -*-
"""
make_all_panels_dxf.py — полный комплект листовых панелей урны в одном DXF.

Раскладка: все панели в одном файле с зазорами 100 мм, каждая подписана.
Резчику удобно: один файл — один заказ. КОМПАС открывает как чертёж/фрагмент.

Запуск:  python make_all_panels_dxf.py
"""

import math
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
BULGE_90 = math.tan(math.radians(90) / 4)


def n(value):
    if isinstance(value, float):
        return ("%.3f" % value).rstrip("0").rstrip(".")
    return str(value)


def rounded_rect(x0, y0, x1, y1, r):
    if r <= 0:
        return [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)]
    b = BULGE_90
    return [
        (x0 + r, y0, 0), (x1 - r, y0, b), (x1, y0 + r, 0), (x1, y1 - r, b),
        (x1 - r, y1, 0), (x0 + r, y1, b), (x0, y1 - r, 0), (x0, y0 + r, b),
    ]


class Dxf:
    def __init__(self):
        self.entities = []

    def circle(self, cx, cy, r):
        self.entities.append("0\nCIRCLE\n8\n0\n10\n%s\n20\n%s\n30\n0\n40\n%s\n" %
                             (n(cx), n(cy), n(r)))

    def polyline(self, points):
        out = ["0\nPOLYLINE\n8\n0\n66\n1\n70\n1\n"]
        for (x, y, bulge) in points:
            out.append("0\nVERTEX\n8\n0\n10\n%s\n20\n%s\n30\n0\n" % (n(x), n(y)))
            if bulge:
                out.append("42\n%s\n" % n(bulge))
        out.append("0\nSEQEND\n8\n0\n")
        self.entities.append("".join(out))

    def text(self, x, y, height, value):
        self.entities.append("0\nTEXT\n8\n0\n10\n%s\n20\n%s\n30\n0\n40\n%s\n1\n%s\n" %
                             (n(x), n(y), n(height), value))

    def save(self, path):
        head = (
            "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n"
            "9\n$INSBASE\n10\n0\n20\n0\n30\n0\n0\nENDSEC\n"
        )
        tables = (
            "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n"
            "0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n"
        )
        body = "0\nSECTION\n2\nENTITIES\n" + "".join(self.entities) + "0\nENDSEC\n0\nEOF\n"
        with open(path, "w", encoding="ascii", newline="\r\n") as handle:
            handle.write(head + tables + body)


# ------------------------------------------------------------------ панели
# holes: (cx, cy, r); cuts: (x, y, w, h, r)
PANELS = [
    dict(name="FRONT 450x900", w=450, h=900, r=10, x=0, y=0,
         holes=[],
         cuts=[(85, 745, 280, 110, 10), (25, 200, 400, 390, 8)]),

    dict(name="BACK 450x900", w=450, h=900, r=10, x=550, y=0,
         holes=[(405, 60, 20)],
         cuts=[(60, 800, 100, 6, 0), (175, 800, 100, 6, 0), (290, 800, 100, 6, 0)]),

    dict(name="SIDE 490x900", w=490, h=900, r=10, x=1100, y=0,
         holes=[(25, 40, 3.25), (25, 450, 3.25), (25, 860, 3.25),
                (465, 40, 3.25), (465, 450, 3.25), (465, 860, 3.25)],
         cuts=[(42, 794, 70, 6, 0), (154, 794, 70, 6, 0),
               (266, 794, 70, 6, 0), (378, 794, 70, 6, 0)]),

    dict(name="SIDE 490x900", w=490, h=900, r=10, x=1690, y=0,
         holes=[(25, 40, 3.25), (25, 450, 3.25), (25, 860, 3.25),
                (465, 40, 3.25), (465, 450, 3.25), (465, 860, 3.25)],
         cuts=[(42, 794, 70, 6, 0), (154, 794, 70, 6, 0),
               (266, 794, 70, 6, 0), (378, 794, 70, 6, 0)]),

    dict(name="BOTTOM 440x490", w=440, h=490, r=8, x=0, y=1000,
         holes=[(25, 25, 3.25), (415, 25, 3.25), (25, 465, 3.25), (415, 465, 3.25),
                (400, 80, 15)],
         cuts=[]),

    dict(name="DECK 440x490", w=440, h=490, r=8, x=540, y=1000,
         holes=[(120, 133, 55), (320, 133, 55), (120, 357, 55), (320, 357, 55),
                (20, 20, 3.25), (420, 20, 3.25), (20, 470, 3.25), (420, 470, 3.25)],
         cuts=[]),

    dict(name="SHELF 440x490", w=440, h=490, r=8, x=1080, y=1000,
         holes=[(25, 25, 3.25), (415, 25, 3.25), (25, 465, 3.25), (415, 465, 3.25)],
         cuts=[]),

    dict(name="DOOR 420x410", w=420, h=410, r=8, x=1620, y=1000,
         holes=[(15, 50, 2.5), (15, 205, 2.5), (15, 360, 2.5), (405, 205, 10)],
         cuts=[]),

    dict(name="DIVIDER A 440x400", w=440, h=400, r=6, x=0, y=1600, holes=[], cuts=[]),
    dict(name="DIVIDER B 490x400", w=490, h=400, r=6, x=540, y=1600, holes=[], cuts=[]),
]


def build_dxf(path):
    dxf = Dxf()
    for p in PANELS:
        ox, oy = p["x"], p["y"]

        dxf.polyline([(x + ox, y + oy, b) for (x, y, b) in
                      rounded_rect(0, 0, p["w"], p["h"], p["r"])])

        for (cx, cy, r) in p["holes"]:
            dxf.circle(cx + ox, cy + oy, r)

        for (x, y, w, h, r) in p["cuts"]:
            dxf.polyline([(px + ox, py + oy, b) for (px, py, b) in
                          rounded_rect(x, y, x + w, y + h, r)])

        dxf.text(ox, oy - 60, 34, p["name"])

    dxf.save(path)


# ------------------------------------------------------------------ превью
def build_svg(path, scale=0.42, pad=60):
    width = 2200 * scale + pad * 2
    height = 2060 * scale + pad * 2 + 40

    def X(v):
        return pad + v * scale

    def Y(v):
        return pad + 40 + (2060 - v) * scale

    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="Inter, Arial">'
        % (width, height),
        '<rect width="100%%" height="100%%" fill="#ffffff"/>',
        '<text x="%d" y="30" font-size="16" font-weight="700" fill="#0f172a">'
        'bin_panels_all.dxf — 10 панелей, мм</text>' % pad,
    ]

    for p in PANELS:
        x0, y0 = X(p["x"]), Y(p["y"] + p["h"])
        w, h = p["w"] * scale, p["h"] * scale

        parts.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" '
                     'fill="#f8fafc" stroke="#94a3b8" stroke-width="1.4"/>'
                     % (x0, y0, w, h, p["r"] * scale))

        for (cx, cy, r) in p["holes"]:
            parts.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#ffffff" '
                         'stroke="#2563eb" stroke-width="1.2"/>'
                         % (X(p["x"] + cx), Y(p["y"] + cy), max(r * scale, 1.4)))

        for (cx, cy, cw, ch, cr) in p["cuts"]:
            parts.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%.1f" '
                         'fill="#ffffff" stroke="#2563eb" stroke-width="1.2"/>'
                         % (X(p["x"] + cx), Y(p["y"] + cy + ch), cw * scale, ch * scale, cr * scale))

        parts.append('<text x="%.1f" y="%.1f" font-size="10" fill="#64748b">%s</text>'
                     % (x0, y0 + h + 14, p["name"]))

    parts.append("</svg>")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(parts))


if __name__ == "__main__":
    dxf_path = os.path.join(OUT_DIR, "bin_panels_all.dxf")
    build_dxf(dxf_path)
    build_svg(os.path.join(OUT_DIR, "bin_panels_all.svg"))

    with open(dxf_path, "r", encoding="ascii") as handle:
        data = handle.read()

    print("панелей: %d" % len(PANELS))
    print("сущностей: %d (полилиний %d, окружностей %d, подписей %d)" % (
        data.count("\n0\n") - 1,
        data.count("\nPOLYLINE\n"),
        data.count("\nCIRCLE\n"),
        data.count("\nTEXT\n"),
    ))
    print("файл: %s (%d байт)" % (dxf_path, os.path.getsize(dxf_path)))
