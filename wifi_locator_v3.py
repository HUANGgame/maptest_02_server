from pathlib import Path
from typing import Iterable, Any
import joblib
import numpy as np
import pandas as pd


class WifiLocatorV3:
    """Two-stage Wi-Fi locator:
    1) KNN classifier predicts floor
    2) floor-specific KNN regressor predicts Y/X
    """

    FLOOR_TO_ID = {
        0: "k-area-airport-1f",
        1: "k-area-airport-mrt",
    }

    def __init__(
        self,
        base_dir: str | Path | None = None,
        floor_model_file: str = "wifi_floor_knn_v3_final.pkl",
        xy_models_file: str = "wifi_xy_knn_by_floor_v3_final.pkl",
        feature_file: str = "train_bssid_list_v3_final.pkl",
    ):
        self.base_dir = Path(base_dir) if base_dir else Path(__file__).resolve().parent

        self.floor_model = joblib.load(self.base_dir / floor_model_file)
        self.xy_models = joblib.load(self.base_dir / xy_models_file)
        self.features = joblib.load(self.base_dir / feature_file)

        self.feature_lookup = {str(x).lower().strip(): x for x in self.features}

    def _signal_pair(self, item: Any) -> tuple[str, float]:
        if isinstance(item, dict):
            bssid = item.get("bssid")
            level = item.get("level")
        else:
            bssid = getattr(item, "bssid", None)
            level = getattr(item, "level", None)

        if bssid is None or level is None:
            raise ValueError("每筆 Wi-Fi 訊號都必須包含 bssid 與 level")

        return str(bssid).lower().strip(), float(level)

    def build_feature_row(self, signals: Iterable[Any]) -> tuple[pd.DataFrame, dict]:

        buckets: dict[str, list[float]] = {}
        total_signal_count = 0

        for item in signals:
            bssid, level = self._signal_pair(item)
            total_signal_count += 1
            buckets.setdefault(bssid, []).append(level)

        if total_signal_count == 0:
            raise ValueError("signals 不可為空")

        incoming = {bssid: float(np.mean(levels)) for bssid, levels in buckets.items()}

        row = {feature: -100.0 for feature in self.features}
        matched = []

        for clean_bssid, level in incoming.items():
            original_feature = self.feature_lookup.get(clean_bssid)
            if original_feature is not None:
                row[original_feature] = level
                matched.append(clean_bssid)

        X = pd.DataFrame([row], columns=self.features)

        diagnostics = {
            "receivedSignalCount": total_signal_count,
            "uniqueSignalCount": len(incoming),
            "matchedFeatureCount": len(matched),
            "modelFeatureCount": len(self.features),
            "matchedRatio": len(matched) / max(1, len(incoming)),
        }
        return X, diagnostics

    def predict(self, signals: Iterable[Any]) -> dict:
        X, diagnostics = self.build_feature_row(signals)

        floor = int(self.floor_model.predict(X)[0])
        if floor not in self.xy_models:
            raise ValueError(f"找不到樓層 {floor} 的 XY 模型")

        pred_y, pred_x = self.xy_models[floor].predict(X)[0]
        pred_y = float(pred_y)
        pred_x = float(pred_x)

        confidence = None
        if hasattr(self.floor_model, "predict_proba"):
            probs = self.floor_model.predict_proba(X)[0]
            classes = list(self.floor_model.classes_)
            if floor in classes:
                confidence = float(probs[classes.index(floor)])


        pixel_x = pred_x * 45 + 100
        pixel_y = pred_y * 80 + 100

        warnings = []
        if diagnostics["matchedFeatureCount"] < 5:
            warnings.append("有效匹配 AP 少於 5 個，定位可信度很低")
        elif diagnostics["matchedFeatureCount"] < 20:
            warnings.append("有效匹配 AP 偏少，建議取得更完整的 Wi-Fi 掃描")

        return {
            "mode": "real",
            "floor": floor,
            "floorId": self.FLOOR_TO_ID[floor],
            "gridX": pred_x,
            "gridY": pred_y,
            "x": float(pixel_x),
            "y": float(pixel_y),
            "floorConfidence": confidence,
            **diagnostics,
            "warnings": warnings,
        }
