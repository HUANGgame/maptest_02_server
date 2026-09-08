import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
from collections import deque
import numpy as np

from train2_dqn import DQN as GridDQN, KAreaEnv

app = FastAPI(title="K區室內導航與定位 API 伺服器")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

grid_policy_net = GridDQN(input_size=6, output_size=4).to(device)
try:
    grid_policy_net.load_state_dict(torch.load("dqn_model.pth", map_location=device, weights_only=True))
    grid_policy_net.eval()
    print("✅ 成功載入 全域網格 DQN 模型")
except Exception as e:
    print(f"⚠️ 找不到 dqn_model.pth，錯誤: {e}")

try:
    knn_model = joblib.load('knn_model.pkl')
    wifi_columns = joblib.load('wifi_columns.pkl')
except Exception as e:
    knn_model = None
    wifi_columns = None

class WiFiSignal(BaseModel):
    bssid: str
    rssi: float

class LocationRequest(BaseModel):
    signals: list[WiFiSignal]

class GridPathRequest(BaseModel):
    start_y: int
    start_x: int
    target_y: int = None
    target_x: int = None
    start_floor: str = ""
    target_floor: str = ""

# 📍 自動轉換至 75x25 網格比例的店家座標
# 📍 回歸正確的 37x9 網格座標
LOCATION_COORDS = {
    "桃園機場捷運": {"x": 2, "y": 4}, "K12 樓梯": {"x": 2, "y": 4}, "東森購物": {"x": 3, "y": 4},
    "西廣場": {"x": 5, "y": 4}, "大創": {"x": 7, "y": 4}, "Hobby OFF": {"x": 8, "y": 4},
    "和氣屋": {"x": 10, "y": 4}, "寶可夢旗艦店": {"x": 12, "y": 4}, "三國幻戰": {"x": 13, "y": 4},
    "于田生活": {"x": 15, "y": 4}, "眼鏡市場": {"x": 15, "y": 4}, "服務站": {"x": 18, "y": 4},
    "全家": {"x": 20, "y": 4}, "711": {"x": 21, "y": 4}, "先喝道": {"x": 24, "y": 4},
    "pp石墨烯": {"x": 25, "y": 4}, "中央廣場": {"x": 26, "y": 4}, "老董牛肉麵": {"x": 26, "y": 4},
    "sukiya": {"x": 28, "y": 4}, "爭鮮": {"x": 29, "y": 4}, "翰林茶棧": {"x": 29, "y": 4},
    "三商炸雞": {"x": 31, "y": 4}, "東廣場": {"x": 32, "y": 4}, "這一小鍋": {"x": 33, "y": 4},
    "K1 樓梯": {"x": 34, "y": 4}, "寶雅": {"x": 7, "y": 2}, "松本清": {"x": 12, "y": 2},
    "扭蛋總動員": {"x": 14, "y": 2}, "拼圖總動員": {"x": 15, "y": 2}, "中央大樓梯": {"x": 19, "y": 2},
    "山崎麵包": {"x": 20, "y": 2}, "迷客夏": {"x": 21, "y": 2}, "K7 無障礙電梯": {"x": 22, "y": 2},
    "銷魂麵舖": {"x": 22, "y": 2}, "荖子鍋": {"x": 23, "y": 2}, "薩莉亞": {"x": 24, "y": 2},
    "喜魚": {"x": 25, "y": 2}, "魔法森林按摩椅": {"x": 25, "y": 2}, "Joyfull": {"x": 27, "y": 2},
    "丸龜製麵": {"x": 28, "y": 2}, "QB HOUSE": {"x": 29, "y": 2}, "真茶CA哩": {"x": 30, "y": 2},
    "洋城義大利麵": {"x": 31, "y": 2}, "K1 無障礙電梯": {"x": 33, "y": 2}
}


import os
from collections import deque
import pandas as pd
import numpy as np

# (保留你原本最上方的模型載入與 FastAPI 初始化程式碼)

# 🌟 新增這個 API，解決終端機瘋狂洗版 404 的問題
@app.get("/api/current-location")
def get_current_location():
    return {"status": "waiting"}

@app.post("/api/get_path")
def get_shortest_path(req: GridPathRequest):
    # 🌟 關鍵修正：換成絕對路徑，確保不論在哪個資料夾啟動伺服器都抓得到檔案
    csv_path = "/Users/hehouxuan/專題2/maptest_02_server/public/maps/K_Area_Grid_Real.csv"
    
    try:
        real_grid = pd.read_csv(csv_path, header=None).values
        rows, cols = real_grid.shape
    except Exception as e:
        return {"status": "error", "message": f"找不到 75x25 網格檔案，請確認路徑: {e}", "path": []}

    start = (req.start_y, req.start_x)
    target = (req.target_y, req.target_x)

    # 防呆機制：確保前端傳來的座標沒有超出 75x25 邊界
    start = (max(0, min(rows-1, start[0])), max(0, min(cols-1, start[1])))
    target = (max(0, min(rows-1, target[0])), max(0, min(cols-1, target[1])))

    # 座標吸附：如果起點或終點在「建築物(1)」裡面，自動找旁邊最近的「走道(0)」
    def find_nearest_walkway(y, x):
        if real_grid[y, x] == 0:
            return (y, x)
        q = deque([(y, x)])
        visited = set([(y, x)])
        while q:
            cy, cx = q.popleft()
            # 包含對角線搜尋最近的走道
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]:
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < rows and 0 <= nx < cols and (ny, nx) not in visited:
                    if real_grid[ny, nx] == 0:
                        return (ny, nx)
                    visited.add((ny, nx))
                    q.append((ny, nx))
        return (y, x)

    start_safe = find_nearest_walkway(start[0], start[1])
    target_safe = find_nearest_walkway(target[0], target[1])

    # 嚴格最短路徑計算 (只允許走數值為 0 的格子)
    queue = deque([[start_safe]])
    visited = set([start_safe])
    final_path = []

    while queue:
        path = queue.popleft()
        curr = path[-1]

        if curr == target_safe:
            final_path = [{"y": p[0], "x": p[1]} for p in path]
            break

        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = curr[0] + dy, curr[1] + dx
            if 0 <= ny < rows and 0 <= nx < cols:
                # 🛑 絕對防穿牆：只有 0 才能走！碰到 1 (建築物) 絕對不加入路徑
                if real_grid[ny, nx] == 0 and (ny, nx) not in visited:
                    visited.add((ny, nx))
                    queue.append(path + [(ny, nx)])

    if not final_path:
        return {"status": "error", "message": "無法找到避開建築物的路線", "path": []}

    return {
        "status": "success",
        "message": "✅ 路線規劃完畢",
        "path": final_path,
        "total_steps": len(final_path)
    }