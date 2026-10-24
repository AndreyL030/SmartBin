# -*- coding: utf-8 -*-
"""
explore_kompas_3d.py — выясняет, какими свойствами и методами
в вашей версии КОМПАСа строятся эскизы и тела.

Ничего не сохраняет и не удаляет: только читает свойства документа
и печатает, что нашлось. Запуск:  python C:\\work\\explore_kompas_3d.py
"""

import sys
import traceback

PROGID = "KOMPAS.Application.5"

DOC_NAMES = [
    "Sketch", "Sketches", "NewSketch", "CreateSketch", "SketchList",
    "Part", "Parts", "Solid", "Bodies", "Body", "TopPart",
    "RootObject", "GetRootObject", "ViewsAndLayersManager",
    "DefaultObject", "Parameters", "Properties", "Model",
    "Objects", "Geometry", "Update", "Rebuild", "Name", "Type",
]

SECOND_NAMES = [
    "Contours", "Contour", "Points", "Lines", "Curves", "Segments",
    "Object", "Parent", "Create", "Update", "Add", "AddContour",
]


def describe(value):
    try:
        text = str(value)
    except Exception:                                  # noqa: BLE001
        text = "<не печатается>"
    return "%s = %s" % (type(value).__name__, text[:80])


def probe(obj, names, title):
    print("\n=== %s ===" % title)
    found = {}
    for name in names:
        try:
            value = getattr(obj, name)
        except Exception as exc:                       # noqa: BLE001
            print("  %-22s нет (%s)" % (name, str(exc)[:60]))
            continue
        if value is None:
            print("  %-22s None" % name)
            continue
        print("  %-22s %s" % (name, describe(value)))
        found[name] = value
    return found


def main():
    print("Python:", sys.version.split()[0])

    import win32com.client

    app = win32com.client.Dispatch(PROGID)
    try:
        app.Visible = True
    except Exception:
        pass

    doc = app.Document3D
    doc.Create()
    print("Документ-деталь создан")

    found = probe(doc, DOC_NAMES, "Свойства документа-детали")

    for key in ("Sketch", "Part", "RootObject", "TopPart", "Model"):
        if key in found:
            probe(found[key], SECOND_NAMES, "Внутри %s" % key)

    print("\nГотово. Пришлите вывод целиком — по нему напишу макрос с геометрией.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:                          # noqa: BLE001
        print("ОШИБКА:", exc)
        traceback.print_exc()
    input("\nНажмите Enter, чтобы закрыть окно...")
