# -*- coding: utf-8 -*-
"""
test_m3d.py — проверка связки Python ↔ КОМПАС-3D (версия 2).

Исправлено: Document3D в KOMPAS API — это свойство, а не метод.
Поэтому обращение идёт без скобок:  doc = app.Document3D

Что делает:
  1. подключается к запущенному КОМПАСу (или запускает его);
  2. создаёт документ-деталь;
  3. сохраняет его как C:\\work\\test.m3d.

Запуск:  python C:\\work\\test_m3d.py
"""

import os
import sys
import time
import traceback

OUT_DIR = r"C:\work"
OUT_FILE = os.path.join(OUT_DIR, "test.m3d")
PROGID = "KOMPAS.Application.5"


def connect():
    import win32com.client

    errors = []
    for progid in (PROGID, "KOMPAS.Application"):
        try:
            return win32com.client.Dispatch(progid), progid
        except Exception as exc:                      # noqa: BLE001
            errors.append("%s -> %s" % (progid, exc))

    raise RuntimeError("не удалось подключиться к КОМПАСу:\n  " + "\n  ".join(errors))


def new_document(app):
    """Document3D — свойство. На всякий случай пробуем и вызов методом."""
    try:
        doc = app.Document3D
        if doc is not None:
            doc.Create()
            return doc, "свойство app.Document3D"
    except Exception as exc:                          # noqa: BLE001
        print("  свойство не сработало: %s" % exc)

    doc = app.Document3D()
    doc.Create()
    return doc, "метод app.Document3D()"


def main():
    print("Python: %s | 64bit: %s" % (sys.version.split()[0], sys.maxsize > 2**32))
    print()

    os.makedirs(OUT_DIR, exist_ok=True)

    print("Подключаюсь к КОМПАС-3D...")
    app, progid = connect()
    print("  подключено через %s" % progid)

    try:
        app.Visible = True
    except Exception:
        print("  (Visible выставить не удалось — не критично)")

    print("Создаю документ-деталь...")
    doc, how = new_document(app)
    print("  способ: %s" % how)
    print("  объект: %s" % doc)

    time.sleep(1.0)

    if os.path.exists(OUT_FILE):
        os.remove(OUT_FILE)

    print("Сохраняю: %s" % OUT_FILE)
    doc.SaveAs(OUT_FILE)
    time.sleep(0.5)

    if os.path.exists(OUT_FILE):
        print()
        print("ГОТОВО. Файл создан: %s (%d байт)" % (OUT_FILE, os.path.getsize(OUT_FILE)))
        print("Откройте его в КОМПАСе и скажите, что видно в дереве построения.")
    else:
        print()
        print("Файл не появился. Пришлите этот вывод целиком.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:                          # noqa: BLE001
        print()
        print("ОШИБКА: %s" % exc)
        print()
        print("Подробности для отправки:")
        traceback.print_exc()
        input("\nНажмите Enter, чтобы закрыть окно...")
        sys.exit(1)
