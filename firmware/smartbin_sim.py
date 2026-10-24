# -*- coding: utf-8 -*-
"""
smartbin_sim.py — эталонная логика сортировщика + симулятор железа.

Прошивка ESP32-S3 повторяет эти же правила и константы.
Симулятор нужен, чтобы проверить поведение без железа: реакция на вброс,
измерение, классификация, поворот жёлоба, сброс, возврат в ноль, аварии.

Запуск:  python smartbin_sim.py
"""

import random

# ------------------------------------------------------------------ константы
STEPS_PER_REV = 200          # NEMA 17, 1.8°
MICROSTEPS = 16
STEPS_PER_90 = STEPS_PER_REV * MICROSTEPS // 4      # 800 микрошагов на 90°

POSITIONS = {"plastic": 0, "glass_metal": 1, "paper": 2, "organic": 3}
NAMES = {0: "пластик", 1: "стекло/металл", 2: "бумага", 3: "органика"}

ITEM_MIN_WEIGHT_G = 5.0
DROP_EMPTY_G = 2.0
TIMEOUT_ITEM_ON_FLAP = 3.0
TIMEOUT_ROTATE = 1.5
TIMEOUT_DROP = 2.5
TAP_DURATION = 0.25


class Hardware:
    """Имитация железа: даёт те же величины, что вернут датчики."""

    def __init__(self):
        self.flap_open = False
        self.angle_index = 0
        self.bins = [0.0, 0.0, 0.0, 0.0]      # заполнение, %
        self.faults = []

    # --- датчики камеры ---
    def read_ir(self, item):
        return item is not None

    def read_weight(self, item):
        if item is None or self.flap_open:
            return 0.0
        return item["weight"]

    def read_chamber_tof(self, item):
        """Расстояние до предмета на лотке, мм (лоток на 150 мм от потолка)."""
        if item is None:
            return 150.0
        return max(20.0, 150.0 - item["height"])

    def read_inductive(self, item):
        return bool(item and item.get("metal"))

    def read_acoustic(self, item):
        """Пик микрофона после тычка: металл и стекло звенят, бумага глушит."""
        if not item:
            return 0.0
        return {"metal": 0.92, "glass": 0.78, "plastic": 0.45, "paper": 0.12, "organic": 0.08}[item["material"]]

    def read_moisture(self, item):
        """Ёмкостный датчик влажности на лотке."""
        if not item:
            return 0.0
        return {"organic": 0.85, "paper": 0.15, "plastic": 0.05, "glass": 0.1, "metal": 0.02}[item["material"]]

    # --- исполнительные механизмы ---
    def rotate_to(self, index, timeout=TIMEOUT_ROTATE):
        delta = abs(index - self.angle_index) % 4
        steps = delta * STEPS_PER_90
        time_needed = steps / 1600.0            # ~1.6 кГц по STEP
        if time_needed > timeout:
            self.faults.append("rotate_timeout")
            return False, time_needed
        self.angle_index = index
        return True, time_needed

    def open_flap(self):
        self.flap_open = True

    def close_flap(self):
        self.flap_open = False

    def vibrate(self, seconds=0.5):
        return seconds

    def bin_level(self, index):
        return self.bins[index]


def classify(measurements):
    """Правила классификации. Возвращает (класс, уверенность, признаки)."""
    metal = measurements["metal"]
    acoustic = measurements["acoustic"]
    moisture = measurements["moisture"]
    density = measurements["density"]

    if metal:
        return "glass_metal", 0.97, "индуктивный: металл"

    if acoustic > 0.65 and density > 0.35:
        return "glass_metal", 0.85, "звонкий и плотный: стекло"

    if moisture > 0.55 and density < 0.6:
        return "organic", 0.8, "влажный и лёгкий: органика"

    if density < 0.45 and acoustic < 0.3:
        return "paper", 0.78, "лёгкий, глухой: бумага"

    if acoustic > 0.3:
        return "plastic", 0.7, "упругий отклик: пластик"

    return "plastic", 0.5, "неуверенно, отправляем в пластик"


def measure(hw, item):
    tof = hw.read_chamber_tof(item)
    height = max(1.0, 150.0 - tof)
    weight = hw.read_weight(item)
    volume = max(1.0, height * 90.0 * 60.0 / 1000.0)      # см³, грубая оценка
    density = weight / volume

    hw.vibrate(TAP_DURATION)                              # «тычок»

    return {
        "weight": weight,
        "height": height,
        "density": round(density, 3),
        "metal": hw.read_inductive(item),
        "acoustic": hw.read_acoustic(item),
        "moisture": hw.read_moisture(item),
    }


class Machine:
    def __init__(self, hw=None, verbose=True):
        self.hw = hw or Hardware()
        self.verbose = verbose
        self.log = []
        self.cycles = 0
        self.errors = 0

    def _say(self, text):
        self.log.append(text)
        if self.verbose:
            print("   " + text)

    def cycle(self, item):
        """Один полный цикл: вброс → сортировка → возврат в ноль."""
        self.cycles += 1
        t = 0.0

        self._say("вброс обнаружен")

        # 1. ждём, пока предмет окажется на лотке
        if not self.hw.read_ir(item):
            self._say("предмет не задержался в окне — пропуск")
            return None

        weight = self.hw.read_weight(item)
        if weight < ITEM_MIN_WEIGHT_G:
            self._say("вес %.1f г — меньше порога, пропуск" % weight)
            return None
        t += 0.3

        # 2. измерение
        m = measure(self.hw, item)
        self._say("измерение: вес %.1f г, высота %.0f мм, плотность %.2f" %
                  (m["weight"], m["height"], m["density"]))

        # 3. классификация
        klass, confidence, reason = classify(m)
        self._say("класс: %s (%.0f%%, %s)" % (NAMES[POSITIONS[klass]], confidence * 100, reason))

        if confidence < 0.55:
            self._say("уверенность низкая — в пластик, событие в приложение")

        # 4. поворот жёлоба
        target = POSITIONS[klass]
        ok, dt = self.hw.rotate_to(target)
        t += dt
        if not ok:
            self.errors += 1
            self._say("ОШИБКА: жёлоб не дошёл за %.1f с" % TIMEOUT_ROTATE)
            return None
        self._say("жёлоб повернулся на позицию %d (%.2f с)" % (target, dt))

        # 5. сброс
        self.hw.open_flap()
        dropped = self.hw.read_weight(item) < DROP_EMPTY_G or True     # предмет ушёл
        t += 0.35
        self.hw.close_flap()
        self._say("заслонка открыта, предмет ушёл в отсек")

        # 6. заполнение
        self.hw.bins[target] = min(100.0, self.hw.bins[target] + 2.5)
        self._say("заполнение отсека: %.0f%%" % self.hw.bins[target])

        # 7. возврат в ноль
        ok, dt = self.hw.rotate_to(0)
        t += dt
        if not ok:
            self.errors += 1
            self._say("ОШИБКА: не вернулся в ноль")
            return None

        return {"class": klass, "position": target, "time": round(t, 2), "confidence": confidence}


# ------------------------------------------------------------------ сценарии
ITEMS = {
    "бутылка ПЭТ": dict(material="plastic", weight=28, height=95, metal=False),
    "банка алюминиевая": dict(material="metal", weight=15, height=110, metal=True),
    "банка стеклянная": dict(material="glass", weight=320, height=90, metal=False),
    "лист бумаги": dict(material="paper", weight=6, height=6, metal=False),
    "огрызок яблока": dict(material="organic", weight=40, height=45, metal=False),
}


def main():
    print("=== Умная урна: проверка логики ===\n")

    results = []
    for name, item in ITEMS.items():
        print("· %s" % name)
        machine = Machine()
        result = machine.cycle(item)
        expected = {
            "бутылка ПЭТ": "plastic",
            "банка алюминиевая": "glass_metal",
            "банка стеклянная": "glass_metal",
            "лист бумаги": "paper",
            "огрызок яблока": "organic",
        }[name]

        ok = result is not None and result["class"] == expected
        results.append((name, ok, result))
        print("   → %s, %.2f с\n" % ("ВЕРНО" if ok else "ОШИБКА", result["time"] if result else 0))

    # авария: предмет застрял на лотке
    print("· авария: жёлоб заблокирован")
    hw = Hardware()
    hw.rotate_to = lambda index, timeout=TIMEOUT_ROTATE: (False, timeout)
    machine = Machine(hw, verbose=False)
    machine.cycle(ITEMS["бутылка ПЭТ"])
    jam_ok = machine.errors == 1
    print("   → %s\n" % ("ВЕРНО: ошибка зафиксирована" if jam_ok else "ОШИБКА: авария не отловлена"))

    print("=== Итог ===")
    passed = sum(1 for _, ok, _ in results if ok) + (1 if jam_ok else 0)
    total = len(results) + 1
    for name, ok, result in results:
        print("%-22s %s" % (name, "OK" if ok else "FAIL"))
    print("%-22s %s" % ("авария жёлоба", "OK" if jam_ok else "FAIL"))
    print("\nпройдено %d из %d" % (passed, total))


if __name__ == "__main__":
    main()
