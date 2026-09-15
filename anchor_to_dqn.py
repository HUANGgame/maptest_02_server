from __future__ import annotations
from pathlib import Path
from collections import deque
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_GRID_FILE = BASE_DIR / "K_Area_Grid_Real.csv"

ANCHORS = [
    ("START_2",0,32.0,5.0),("10",0,20.0,5.0),("13",0,10.0,5.0),
    ("TURN_16",0,3.0,5.0),("TURN_MRT",0,12.0,3.0),("23",0,24.0,1.0),
    ("TURN_1",0,31.0,1.0),("28",0,28.0,4.0),("15",0,17.0,4.0),
    ("HOBBY_OFF",0,9.0,4.0),("TURN_35",0,5.0,4.0),
    ("ESCALATOR_START",0,2.0,3.0),
    ("ESCALATOR_END",1,2.0,3.0),("MRT_P25",1,4.5,3.0),
    ("MRT_P50",1,7.0,3.0),("MRT_P75",1,9.5,3.0),("END_MRT",1,12.0,3.0),
]

X_PIXEL_MAP = {
    2:15,3:35,5:53,7:88,8:95,10:115,12:144,13:148,14:157,15:165,
    18:180,19:195,20:215,21:216,22:228,23:245,24:250,25:261,26:270,
    27:280,28:295,29:305,30:317,31:340,32:343,33:355,34:370
}

IMAGE_LEFT=-4.63
IMAGE_TOP=-16.36
IMAGE_WIDTH=379.06
IMAGE_HEIGHT=122.73
DQN_COLS=75
DQN_ROWS=25

def logical_x_to_pixel(x: float) -> float:
    if x in X_PIXEL_MAP:
        return float(X_PIXEL_MAP[x])
    keys=sorted(X_PIXEL_MAP)
    for a,b in zip(keys[:-1],keys[1:]):
        if a < x < b:
            p=(x-a)/(b-a)
            return X_PIXEL_MAP[a] + p*(X_PIXEL_MAP[b]-X_PIXEL_MAP[a])
    return x*10.0

def logical_y_to_pixel(y: float):
    if y==2: return 42.0,False
    if y==3: return 52.0,False
    if y==4: return 62.0,False
    return y*10.0,True

def pixel_to_raw_dqn(px: float, py: float):
    gx=int(np.floor((px-IMAGE_LEFT)/(IMAGE_WIDTH/DQN_COLS)))
    gy=int(np.floor((py-IMAGE_TOP)/(IMAGE_HEIGHT/DQN_ROWS)))
    return max(0,min(DQN_COLS-1,gx)), max(0,min(DQN_ROWS-1,gy))

def nearest_walkable(grid, gx: int, gy: int):
    rows,cols=grid.shape
    gx=max(0,min(cols-1,int(gx))); gy=max(0,min(rows-1,int(gy)))
    if int(grid[gy,gx])==0:
        return gx,gy,0
    q=deque([(gx,gy,0)])
    seen={(gx,gy)}
    for_search=[(0,-1),(0,1),(-1,0),(1,0)]
    while q:
        x,y,d=q.popleft()
        for dx,dy in for_search:
            nx,ny=x+dx,y+dy
            if not (0<=nx<cols and 0<=ny<rows) or (nx,ny) in seen:
                continue
            if int(grid[ny,nx])==0:
                return nx,ny,d+1
            seen.add((nx,ny))
            q.append((nx,ny,d+1))
    raise RuntimeError("找不到可行走格")





MANUAL_DQN_ANCHOR_OVERRIDE = {
    "HOBBY_OFF": {"x": 19, "y": 16},
}

def build_anchor_map(grid_path=DEFAULT_GRID_FILE):
    grid=pd.read_csv(grid_path,header=None).values.astype(int)
    if grid.shape!=(DQN_ROWS,DQN_COLS):
        raise ValueError(f"Expected 25x75 DQN grid, got {grid.shape}")
    result={}
    for anchor_id,floor,wifi_x,wifi_y in ANCHORS:
        if floor!=0:
            result[anchor_id]={
                "floor":floor,"wifiGridX":wifi_x,"wifiGridY":wifi_y,"dqn":None,
                "reason":"2F/MRT anchor：目前沒有已驗證的 2F DQN grid，不可硬塞進 1F 75x25 grid。",
                "needsVisualReview":False
            }
            continue
        px=logical_x_to_pixel(wifi_x)
        py,y_review=logical_y_to_pixel(wifi_y)
        raw_x,raw_y=pixel_to_raw_dqn(px,py)
        safe_x,safe_y,snap_distance=nearest_walkable(grid,raw_x,raw_y)
        result[anchor_id]={
            "floor":floor,"wifiGridX":wifi_x,"wifiGridY":wifi_y,
            "sourcePixelX":round(px,3),"sourcePixelY":round(py,3),
            "rawDqnX":raw_x,"rawDqnY":raw_y,
            "dqn":{"x":safe_x,"y":safe_y},
            "snapDistanceCells":snap_distance,
            "needsVisualReview":bool(y_review or snap_distance>=2)
        }
    for anchor_id, dqn in MANUAL_DQN_ANCHOR_OVERRIDE.items():
        if anchor_id in result:
            result[anchor_id]["dqn"] = dict(dqn)
            result[anchor_id]["manualOverride"] = True
            result[anchor_id]["needsVisualReview"] = False

    return result

def anchor_to_dqn(anchor_id: str, grid_path=DEFAULT_GRID_FILE):
    mapping=build_anchor_map(grid_path)
    key=str(anchor_id).upper()
    if key not in mapping:
        raise KeyError(f"Unknown anchor: {anchor_id}")
    return mapping[key]["dqn"]

if __name__=="__main__":
    for name,info in build_anchor_map().items():
        print(name, "->", info["dqn"], "review=", info["needsVisualReview"])
