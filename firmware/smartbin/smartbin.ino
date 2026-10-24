/*
 * SmartBin — прошивка контроллера сортировки.
 * Плата: ESP32-S3 DevKit (Arduino IDE 2.x, board «ESP32S3 Dev Module»).
 *
 * Логика повторяет проверенный симулятор firmware/smartbin_sim.py:
 *   вброс → ожидание на лотке → измерение → классификация →
 *   поворот жёлоба → сброс → проверка → возврат в ноль.
 *
 * Библиотеки (Менеджер библиотек):
 *   Adafruit VL53L1X, HX711 (bogde), AccelStepper, ESP32Servo
 *
 * ВАЖНО: код не проверялся на живой плате. Первый запуск — с отключёнными
 * приводами (POWER_DRIVES 0), по Serial смотреть, что приходит с датчиков.
 */

#include <Wire.h>
#include <Adafruit_VL53L1X.h>
#include <HX711.h>
#include <AccelStepper.h>
#include <ESP32Servo.h>

// ---------------- пины ----------------
const uint8_t PIN_SDA = 8, PIN_SCL = 9;
const uint8_t PIN_HX_DT = 4, PIN_HX_SCK = 5;
const uint8_t PIN_INDUCTIVE = 6;
const uint8_t PIN_IR = 7;
const uint8_t PIN_HALL = 10;
const uint8_t PIN_MIC = 1;
const uint8_t PIN_STEP = 12, PIN_DIR = 13, PIN_EN = 14;
const uint8_t PIN_SERVO_FLAP = 15, PIN_SERVO_TAP = 16;
const uint8_t PIN_VIBRO = 17;
const uint8_t PIN_LED = 2;

// ---------------- константы ----------------
const uint16_t TCA_ADDR = 0x70;          // мультиплексор PCA9548A
const uint8_t CH_FILL[4] = {0, 1, 2, 3}; // ToF заполнения по отсекам
const uint8_t CH_CHAMBER = 4;            // ToF в камере

const long STEPS_PER_90 = 800;           // 200 шагов × 16 микрошагов / 4
const int SERVO_CLOSED = 10;
const int SERVO_OPEN = 75;
const int SERVO_TAP_DOWN = 60;
const int SERVO_TAP_UP = 10;

const float ITEM_MIN_WEIGHT_G = 5.0;
const float DROP_EMPTY_G = 2.0;
const unsigned long TIMEOUT_ITEM = 3000;
const unsigned long TIMEOUT_ROTATE = 1500;
const unsigned long TIMEOUT_DROP = 2500;

const uint8_t POS_PLASTIC = 0, POS_GLASS = 1, POS_PAPER = 2, POS_ORGANIC = 3;
const char *POS_NAME[4] = {"пластик", "стекло/металл", "бумага", "органика"};

// 1 — разрешить движение. На первом запуске поставьте 0.
#define POWER_DRIVES 0

// ---------------- объекты ----------------
Adafruit_VL53L1X tof;
HX711 scale;
AccelStepper stepper(AccelStepper::DRIVER, PIN_STEP, PIN_DIR);
Servo servoFlap, servoTap;

enum State { IDLE, ON_FLAP, MEASURE, DECIDE, ROTATE, DROP, RETURN_HOME, FAULT };
State state = IDLE;

struct Sample {
    float weight;
    float height;
    float density;
    bool metal;
    float acoustic;
    uint8_t fill[4];
};

uint8_t position = 0;                 // текущий отсек под жёлобом
unsigned long stateSince = 0;

// ---------------- утилиты ----------------
void tcaSelect(uint8_t channel) {
    Wire.beginTransmission(TCA_ADDR);
    Wire.write(1 << channel);
    Wire.endTransmission();
}

float readDistanceMm(uint8_t channel) {
    tcaSelect(channel);
    if (!tof.begin(0x29, &Wire)) return -1;
    tof.startRanging();
    unsigned long t0 = millis();
    while (!tof.dataReady() && millis() - t0 < 200) delay(1);
    float mm = tof.dataReady() ? tof.distance() : -1;
    tof.stopRanging();
    return mm;
}

float readWeightG() {
    if (!scale.is_ready()) return 0;
    return scale.get_units(3);
}

void moveTo(uint8_t index, bool wait) {
    long target = (long)index * STEPS_PER_90;
    stepper.moveTo(target);
    unsigned long t0 = millis();
    while (stepper.distanceToGo() != 0) {
        stepper.run();
        if (millis() - t0 > TIMEOUT_ROTATE) {
            Serial.println("ОШИБКА: жёлоб не дошёл");
            state = FAULT;
            return;
        }
        delayMicroseconds(200);
    }
    position = index;
}

void setup() {
    Serial.begin(115200);
    delay(300);
    pinMode(PIN_INDUCTIVE, INPUT);
    pinMode(PIN_IR, INPUT_PULLUP);
    pinMode(PIN_HALL, INPUT_PULLUP);
    pinMode(PIN_VIBRO, OUTPUT);
    pinMode(PIN_LED, OUTPUT);
    digitalWrite(PIN_VIBRO, LOW);

    Wire.begin(PIN_SDA, PIN_SCL);

    scale.begin(PIN_HX_DT, PIN_HX_SCK);
    scale.set_scale(2280.f);          // калибруется под свой тензодатчик
    scale.tare();

    stepper.setMaxSpeed(1600);
    stepper.setAcceleration(3200);
    stepper.setPinsInverted(false, false, true);
    pinMode(PIN_EN, OUTPUT);
    digitalWrite(PIN_EN, POWER_DRIVES ? LOW : HIGH);

    servoFlap.attach(PIN_SERVO_FLAP);
    servoTap.attach(PIN_SERVO_TAP);
    servoFlap.write(SERVO_CLOSED);
    servoTap.write(SERVO_TAP_UP);

    Serial.println("SmartBin: контроллер запущен");
    Serial.println(POWER_DRIVES ? "приводы включены" : "приводы отключены (POWER_DRIVES=0)");
}

void loop() {
    // Ручной тест без железа: команда в Serial «t plastic» / «t metal» / «t glass» / «t paper» / «t organic»
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd.startsWith("t")) {
            Serial.println("тестовый прогон: " + cmd);
        }
    }

    unsigned long now = millis();

    switch (state) {
        case IDLE: {
            digitalWrite(PIN_LED, LOW);
            bool itemInWindow = digitalRead(PIN_IR) == LOW;
            if (itemInWindow) {
                Serial.println("вброс обнаружен");
                state = ON_FLAP;
                stateSince = now;
            }
            break;
        }

        case ON_FLAP: {
            float w = readWeightG();
            if (w >= ITEM_MIN_WEIGHT_G) {
                Serial.printf("предмет на лотке: %.1f г\n", w);
                state = MEASURE;
            } else if (now - stateSince > TIMEOUT_ITEM) {
                Serial.println("предмет не задержался — пропуск");
                state = IDLE;
            }
            break;
        }

        case MEASURE: {
            Sample s;
            s.weight = readWeightG();
            float mm = readDistanceMm(CH_CHAMBER);
            s.height = (mm < 0) ? 0 : max(1.0f, 150.0f - mm);
            float volume = max(1.0f, s.height * 90.0f * 60.0f / 1000.0f);
            s.density = s.weight / volume;
            s.metal = digitalRead(PIN_INDUCTIVE) == HIGH;

            servoTap.write(SERVO_TAP_DOWN);
            delay(120);
            s.acoustic = analogRead(PIN_MIC) / 4095.0f;
            servoTap.write(SERVO_TAP_UP);

            for (int i = 0; i < 4; i++) {
                float d = readDistanceMm(CH_FILL[i]);
                s.fill[i] = (d < 0) ? 0 : constrain(map((int)d, 400, 20, 0, 100), 0, 100);
            }

            Serial.printf("измерение: %.1f г, %.0f мм, плотность %.2f, металл %d, звук %.2f\n",
                          s.weight, s.height, s.density, s.metal, s.acoustic);

            uint8_t target;
            if (s.metal)                            target = POS_GLASS;
            else if (s.acoustic > 0.65f && s.density > 0.35f) target = POS_GLASS;
            else if (s.density < 0.45f && s.acoustic < 0.3f)  target = POS_PAPER;
            else                                    target = POS_PLASTIC;

            Serial.printf("класс: %s\n", POS_NAME[target]);

            if (!POWER_DRIVES) {
                Serial.println("приводы отключены — цикл завершён без движения");
                state = IDLE;
                break;
            }

            moveTo(target, true);
            if (state == FAULT) break;
            state = DROP;
            stateSince = millis();
            break;
        }

        case DROP: {
            servoFlap.write(SERVO_OPEN);
            delay(200);
            float w = readWeightG();
            if (w < DROP_EMPTY_G) {
                Serial.println("предмет ушёл в отсек");
                servoFlap.write(SERVO_CLOSED);
                state = RETURN_HOME;
            } else if (now - stateSince > TIMEOUT_DROP) {
                Serial.println("застревание: включаю вибрацию");
                digitalWrite(PIN_VIBRO, HIGH);
                delay(500);
                digitalWrite(PIN_VIBRO, LOW);
                servoFlap.write(SERVO_CLOSED);
                state = FAULT;
            }
            break;
        }

        case RETURN_HOME: {
            moveTo(0, true);
            if (state != FAULT) state = IDLE;
            break;
        }

        case FAULT: {
            digitalWrite(PIN_LED, HIGH);
            Serial.println("АВАРИЯ: окно заблокировано, нужно вмешательство");
            if (digitalRead(PIN_HALL) == LOW) {     // вручную вернули в ноль
                Serial.println("ось в нуле — сброс аварии");
                state = IDLE;
            }
            break;
        }
    }
}
