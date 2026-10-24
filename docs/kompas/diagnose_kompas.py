# -*- coding: utf-8 -*-
"""
diagnose_kompas.py — ищет рабочий способ создать документ в КОМПАС-3D.

Перебирает четыре варианта обращения к API и печатает результат каждого.
Ничего не сохраняет и не меняет в системе.

Запуск:  python C:\\work\\diagnose_kompas.py
"""

import sys
import traceback

PROGID = "KOMPAS.Application.5"


def show(title, func):
    print("\n--- %s ---" % title)
    try:
        result = func()
        print("  OK:", result)
        return result
    except Exception as exc:                          # noqa: BLE001
        print("  ОШИБКА: %s" % exc)
        return None


def main():
    print("Python:", sys.version.split()[0], "| 64bit:", sys.maxsize > 2**32)

    import win32com.client

    app = show("1. Dispatch(PROGID)", lambda: win32com.client.Dispatch(PROGID))
    if app is None:
        print("\nДальше проверять нечего: объект не создан.")
        return

    def list_names():
        names = [n for n in dir(app) if not n.startswith("_")]
        return "%d имён: %s" % (len(names), ", ".join(names[:40]))

    show("2. Какие имена видны у объекта", list_names)

    show("3. app.Document3D()  — вызов как метода", lambda: app.Document3D())
    show("4. app.Document3D     — чтение как свойства", lambda: app.Document3D)

    show("5. Visible = True", lambda: setattr(app, "Visible", True) or "выставлено")

    def early():
        early_app = win32com.client.gencache.EnsureDispatch(PROGID)
        doc = early_app.Document3D()
        return "раннее связывание работает, документ: %s" % (doc,)

    show("6. gencache.EnsureDispatch + Document3D()", early)

    def make_and_save():
        early_app = win32com.client.gencache.EnsureDispatch(PROGID)
        early_app.Visible = True
        doc = early_app.Document3D()
        doc.Create()
        doc.SaveAs(r"C:\work\test.m3d")
        return "файл создан: C:\\work\\test.m3d"

    show("7. Создание и сохранение через раннее связывание", make_and_save)

    print("\nГотово. Пришлите весь этот вывод целиком.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:                          # noqa: BLE001
        print("КРИТИЧЕСКАЯ ОШИБКА:", exc)
        traceback.print_exc()
    input("\nНажмите Enter, чтобы закрыть окно...")
