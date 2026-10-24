# -*- coding: utf-8 -*-
"""
make_steps.py — пошаговая сборка урны: шесть кадров, что добавляется на каждом шаге.

Кадр — это один вид (сбоку, спереди или сверху) в одном масштабе.
Серым показан корпус, голубым — то, что уже стоит, оранжевым — то, что добавляем.

Запуск:  python make_steps.py
"""

import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

W_SIDE, W_FRONT, DEPTH, H = 500, 450, 500, 900
SCALE = 0.42
GREY = ("#f1f5f9", "#cbd5e1")
PREV = ("#dbe6f5", "#94a3b8")
NEW = ("#fbbf24", "#b45309")


def rect(x, y, w, h, fill, stroke, width=1.6, dash=None, rx=0):
    extra = ' stroke-dasharray="%s"' % dash if dash else ""
    return ('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%s" fill="%s" stroke="%s" '
            'stroke-width="%s"%s/>' % (x, y, w, h, rx, fill, stroke, width, extra))


def frame(x0, y0, number, caption, width_mm, height_mm, shapes):
    """Рисует кадр: подпись сверху, сцена, номер."""
    out = []
    out.append('<text x="%.1f" y="%.1f" font-size="15" font-weight="700" fill="#0f172a">%s</text>'
               % (x0, y0 - 16, caption))
    out.append('<circle cx="%.1f" cy="%.1f" r="15" fill="#0f172a"/>' % (x0 - 30, y0 - 21))
    out.append('<text x="%.1f" y="%.1f" text-anchor="middle" font-size="13" font-weight="700" '
               'fill="#ffffff">%d</text>' % (x0 - 30, y0 - 16, number))

    out.append(shapes)
    return "".join(out)


def side_scene(x0, y0, extra=""):
    """Боковой вид: ширина 500, высота 900."""
    w, h = W_SIDE * SCALE, H * SCALE
    body = rect(x0, y0, w, h, *GREY, rx=6)
    return body + extra, w, h


def front_scene(x0, y0, extra=""):
    w, h = W_FRONT * SCALE, H * SCALE
    body = rect(x0, y0, w, h, *GREY, rx=6)
    return body + extra, w, h


def main():
    sheet_w, sheet_h = 1560, 1330
    out = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" font-family="Inter, Arial">'
        % (sheet_w, sheet_h),
        '<rect width="100%%" height="100%%" fill="#ffffff"/>',
        '<text x="70" y="56" font-size="25" font-weight="800" fill="#0f172a">'
        'Сборка урны по шагам</text>',
        '<text x="70" y="82" font-size="13" fill="#64748b">'
        'Серый — корпус, голубой — уже собрано, оранжевый — добавляем на этом шаге. Масштаб одинаковый.</text>',
        '<line x1="70" y1="100" x2="%d" y2="100" stroke="#e2e8f0"/>' % (sheet_w - 70),
    ]

    # ---------- 1. дно и боковины ----------
    x0, y0 = 120, 210
    body, w, h = side_scene(x0, y0)
    bottom = rect(x0, y0 + h - 20 * SCALE, w, 20 * SCALE, *NEW)
    sides = rect(x0, y0, w, h, "none", NEW[1], 2.4, dash=None)
    out.append(frame(x0, y0, 1, "Дно и две боковины", W_SIDE, H,
                     body + bottom + sides))

    # ---------- 2. передняя панель ----------
    x0, y0 = 600, 210
    body, w, h = front_scene(x0, y0)
    panel = rect(x0, y0, w, h, PREV[0], NEW[1], 2.4, rx=6)
    win = rect(x0 + 85 * SCALE, y0 + (900 - 855) * SCALE, 280 * SCALE, 110 * SCALE, "#ffffff", NEW[1], 1.8, rx=4)
    door = rect(x0 + 25 * SCALE, y0 + (900 - 590) * SCALE, 400 * SCALE, 390 * SCALE, "#ffffff", NEW[1], 1.8, dash="6 4", rx=4)
    out.append(frame(x0, y0, 2, "Передняя панель с окном", W_FRONT, H, panel + win + door))

    # ---------- 3. полка и вёдра ----------
    x0, y0 = 1080, 210
    body, w, h = side_scene(x0, y0)
    shelf = rect(x0, y0 + (900 - 205) * SCALE, w, 5 * SCALE, *NEW)
    buckets = ""
    for bx in (5, 255):
        buckets += rect(x0 + bx * SCALE, y0 + (900 - 600) * SCALE, 240 * SCALE, 400 * SCALE,
                        "#ffffff", NEW[1], 1.6, dash="5 4", rx=3)
    out.append(frame(x0, y0, 3, "Полка на 200 и вёдра", W_SIDE, H, body + buckets + shelf))

    # ---------- 4. перегородки (вид сверху) ----------
    x0, y0 = 120, 740
    pw, ph = W_FRONT * SCALE, DEPTH * SCALE
    body = rect(x0, y0, pw, ph, *GREY, rx=6)
    cells = ""
    for i in (0, 1):
        for j in (0, 1):
            cells += rect(x0 + (5 + i * 220) * SCALE, y0 + (5 + j * 245) * SCALE,
                          200 * SCALE, 225 * SCALE, "#ffffff", "#94a3b8", 1.2, dash="4 4")
    cross = (rect(x0 + 220 * SCALE, y0 + 5 * SCALE, 5 * SCALE, 490 * SCALE, *NEW) +
             rect(x0 + 5 * SCALE, y0 + 245 * SCALE, 440 * SCALE, 5 * SCALE, *NEW))
    out.append(frame(x0, y0, 4, "Перегородки: вид сверху", W_FRONT, DEPTH, body + cells + cross))

    # ---------- 5. палуба, кронштейн, ось ----------
    x0, y0 = 600, 740
    body, w, h = side_scene(x0, y0)
    deck = rect(x0, y0 + (900 - 605) * SCALE, w, 5 * SCALE, *NEW)
    bracket = rect(x0 + 190 * SCALE, y0 + (900 - 605) * SCALE, 70 * SCALE, 15 * SCALE, *NEW)
    axle = rect(x0 + 222 * SCALE, y0 + (900 - 660) * SCALE, 6 * SCALE, 55 * SCALE, *NEW)
    out.append(frame(x0, y0, 5, "Палуба, кронштейн, ось", W_SIDE, H, body + deck + bracket + axle))

    # ---------- 6. жёлоб и заслонка ----------
    x0, y0 = 1080, 740
    body, w, h = side_scene(x0, y0)
    chute_x, chute_y = x0 + 225 * SCALE, y0 + (900 - 650) * SCALE
    chute = ('<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="%s" stroke="%s" stroke-width="1.8"/>'
             % (chute_x, chute_y, chute_x + 150 * SCALE, chute_y + 45 * SCALE,
                chute_x + 150 * SCALE, chute_y + 57 * SCALE, chute_x, chute_y + 12 * SCALE,
                NEW[0], NEW[1]))
    flap = rect(x0 + 160 * SCALE, y0 + (900 - 665) * SCALE, 130 * SCALE, 5 * SCALE, *PREV)
    door_line = ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2.4" stroke-dasharray="7 5"/>'
                 % (x0 - 10, y0 + (900 - 590) * SCALE, x0 - 10, y0 + (900 - 200) * SCALE, "#94a3b8"))
    out.append(frame(x0, y0, 6, "Жёлоб и заслонка", W_SIDE, H, body + chute + flap + door_line))

    # ---------- пояснения ----------
    notes = [
        "Дно ставим внутрь на 20 мм, боковины притягиваем уголками.",
        "Окно 280 × 110, проём 400 × 390. Панель закрывает торцы боковин.",
        "Полка на 200 мм, на неё четыре ведра 200 × 225 × 400.",
        "Перегородки A и B делят низ на четыре отсека 200 × 225.",
        "Палуба на 600 мм, в центре кронштейн с подшипником и ось Ø12.",
        "Жёлоб садится на ось, заслонка подвешивается над ним.",
    ]

    slots = [(120, 660), (600, 660), (1080, 660), (120, 1190), (600, 1190), (1080, 1190)]
    for (nx, ny), text in zip(slots, notes):
        out.append('<text x="%d" y="%d" font-size="11.5" fill="#475569">%s</text>' % (nx, ny, text))

    out.append("</svg>")

    path = os.path.join(OUT_DIR, "steps.svg")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(out))
    print("готово: steps.svg")


if __name__ == "__main__":
    main()
