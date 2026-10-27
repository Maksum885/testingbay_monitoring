"""
python-modbus/modbus/register_map.py

Holding register map: 40001–40012 (40010 tidak dipakai).
40011 dan 40012 adalah float32 (masing-masing 2 word).

FC3 read: address=0, count=14
  word[0]  = 40001  tekanan_masuk        (uint16)
  word[1]  = 40002  alarm_alert          (bool)
  word[2]  = 40003  mode_maintenance     (bool)
  word[3]  = 40004  roof_tertutup        (bool)
  word[4]  = 40005  roof_terbuka         (bool)
  word[5]  = 40006  roof_bergerak_buka   (bool)
  word[6]  = 40007  roof_bergerak_tutup  (bool)
  word[7]  = 40008  pintu_terkunci       (bool)
  word[8]  = 40009  testing_dimulai      (bool)
  word[9]  = 40010  (tidak dipakai — dibaca tapi diabaikan)
  word[10] = 40011  pressure_1 high word  ─┐ float32
  word[11] = 40011  pressure_1 low  word  ─┘
  word[12] = 40012  pressure_2 high word  ─┐ float32
  word[13] = 40012  pressure_2 low  word  ─┘

CATATAN float32:
  Schneider Modbus default = big-endian (ABCD = ">f").
  Jika nilai pressure terlihat sangat besar/NaN → coba "little-endian words" = CDAB.
  Set env MODBUS_FLOAT_ORDER=CDAB untuk swap word.
"""

from __future__ import annotations
import os

REGISTER_MAP: dict[int, dict] = {
    40001: {
        "key":         "tekanan_masuk",
        "desc":        "Inlet pressure before testing starts",
        "type":        "uint16",
        "change_type": "value_change",
    },
    40002: {
        "key":         "alarm_alert",
        "desc":        "Alarm Alert / Emergency",
        "type":        "bool",
        "change_type": "alarm_triggered",
    },
    40003: {
        "key":         "mode_maintenance",
        "desc":        "Panel in maintenance mode",
        "type":        "bool",
        "change_type": "maintenance_on",
    },
    40004: {
        "key":         "roof_tertutup",
        "desc":        "Roof closed",
        "type":        "bool",
        "change_type": "status_change",
    },
    40005: {
        "key":         "roof_terbuka",
        "desc":        "Roof Terbuka",
        "type":        "bool",
        "change_type": "status_change",
    },
    40006: {
        "key":         "roof_bergerak_buka",
        "desc":        "Roof moving (opening)",
        "type":        "bool",
        "change_type": "roof_moving",
    },
    40007: {
        "key":         "roof_bergerak_tutup",
        "desc":        "Roof moving (closing)",
        "type":        "bool",
        "change_type": "roof_moving",
    },
    40008: {
        "key":         "pintu_terkunci",
        "desc":        "Access door locked",
        "type":        "bool",
        "change_type": "door_locked",
    },
    40009: {
        "key":         "testing_dimulai",
        "desc":        "Testing in progress",
        "type":        "bool",
        "change_type": "testing_started",
    },
    40011: {
        "key":         "pressure_1",
        "desc":        "Pressure 1 (PSI)",
        # float32 = 2 word; word[10]+word[11] → gunakan parse_float32()
        "type":        "float32",
        "change_type": "value_change",
    },
    40012: {
        "key":         "pressure_2",
        "desc":        "Pressure 2 (PSI)",
        # float32 = 2 word; word[12]+word[13] → gunakan parse_float32()
        "type":        "float32",
        "change_type": "value_change",
    },
}

# ─── Modbus PDU parameters ────────────────────────────────────────────────────

# Starting address untuk FC3 (0-based = logical address 40001)
REGISTER_START: int = 0

# Jumlah word yang dibaca:
#   40001–40009      = 9 word (index 0-8)
#   40010            = 1 word (index 9) — tidak dipakai, tetap dibaca agar offset float benar
#   40011 (press_1)  = 2 word float32 (index 10-11)
#   40012 (press_2)  = 2 word float32 (index 12-13)
#   Total            = 14 word
#
# PENTING: kalau PLC Schneider error Illegal Data Address (code 2),
# coba kurangi: MODBUS_HOLDING_COUNT=9 (tanpa pressure float).
REGISTER_COUNT: int = int(os.getenv("MODBUS_HOLDING_COUNT", "14"))

# Float32 byte order dari PLC:
#   "ABCD" = big-endian (Schneider default)  → struct ">f"
#   "CDAB" = swapped words (banyak Schneider) → struct "<f" pada swapped words
#   "DCBA" = little-endian
FLOAT_ORDER: str = os.getenv("MODBUS_FLOAT_ORDER", "ABCD").upper()


def address_to_index(address: int) -> int:
    """Konversi Modbus logical address (40001-based) ke 0-based array index.
    40001 → 0, 40011 → 10, 40012 → 12 (karena 40012 word[12]+word[13]).
    """
    base = int(address) - 40001
    # 40012 secara fisik dimulai di word 12 (setelah 40011 yang memakai 2 word)
    if int(address) >= 40012:
        # Setiap float32 ≥40011 memerlukan offset +1 karena float32 40011 memakai 2 word.
        # 40011 → index 10, 40012 → index 12
        extra_float_words = (int(address) - 40011)  # jumlah float32 register sebelumnya
        return base + extra_float_words
    return base


def get_register_info(address: int) -> dict | None:
    return REGISTER_MAP.get(int(address))