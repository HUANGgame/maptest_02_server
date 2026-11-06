from __future__ import annotations
from pathlib import Path
import csv

BASE_DIR = Path(__file__).resolve().parent
CSV_FILE = BASE_DIR / "places_to_dqn_v2.csv"

def load_place_dqn_map(csv_file: str | Path = CSV_FILE):
    result = {}
    with open(csv_file, "r", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            result[row["place_id"]] = {
                "name": row["name"],
                "category": row["category"],
                "floorId": row["floor_id"],
                "dqnX": int(row["dqn_x"]),
                "dqnY": int(row["dqn_y"]),
                "visualX": float(row["visual_x"]),
                "visualY": float(row["visual_y"]),
                "isStore": str(row["is_store"]).lower() == "true",
            }
    return result

PLACE_DQN_MAP = load_place_dqn_map()

def place_to_dqn(place_id: str):
    if place_id not in PLACE_DQN_MAP:
        raise KeyError(f"Unknown place: {place_id}")
    item = PLACE_DQN_MAP[place_id]
    return item["dqnX"], item["dqnY"]
