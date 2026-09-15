from __future__ import annotations

from pathlib import Path
from collections import deque
from typing import Optional

import pandas as pd

from dqn_route_engine import DQNRouteEngine

BASE_DIR = Path(__file__).resolve().parent
GRID_FILE = BASE_DIR / "K_Area_Grid_Real.csv"
MODEL_FILE = BASE_DIR / "dqn_model.pth"

GRID = pd.read_csv(GRID_FILE, header=None).values.astype(int)
ROWS, COLS = GRID.shape

DQN_ENGINE = None
DQN_ERROR: Optional[str] = None

try:
    DQN_ENGINE = DQNRouteEngine(
        grid_path=GRID_FILE,
        model_path=MODEL_FILE,
        grid_cell_meters=0.6,
    )
except Exception as exc:


    DQN_ERROR = str(exc)


def walkable_xy(x: int, y: int) -> bool:
    return (
        0 <= x < COLS
        and 0 <= y < ROWS
        and int(GRID[y, x]) == 0
    )


def nearest_walkable_xy(x: int, y: int):
    x = max(0, min(COLS - 1, int(x)))
    y = max(0, min(ROWS - 1, int(y)))

    if walkable_xy(x, y):
        return x, y

    q = deque([(x, y)])
    seen = {(x, y)}

    while q:
        cx, cy = q.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = cx + dx, cy + dy
            if not (0 <= nx < COLS and 0 <= ny < ROWS):
                continue
            if (nx, ny) in seen:
                continue
            if walkable_xy(nx, ny):
                return nx, ny
            seen.add((nx, ny))
            q.append((nx, ny))

    raise RuntimeError("DQN grid 中找不到可行走格")


def bfs_shortest_xy(start_xy, goal_xy):
    sx, sy = nearest_walkable_xy(*start_xy)
    gx, gy = nearest_walkable_xy(*goal_xy)

    q = deque([(sx, sy)])
    prev = {(sx, sy): None}

    while q:
        x, y = q.popleft()
        if (x, y) == (gx, gy):
            break

        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in prev:
                continue
            if not walkable_xy(nx, ny):
                continue
            prev[(nx, ny)] = (x, y)
            q.append((nx, ny))

    if (gx, gy) not in prev:
        return []

    path = []
    cur = (gx, gy)
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    path.reverse()
    return path


def _dqn_path_xy(start_xy, goal_xy):
    if DQN_ENGINE is None:
        return []

    sx, sy = nearest_walkable_xy(*start_xy)
    gx, gy = nearest_walkable_xy(*goal_xy)


    result = DQN_ENGINE.find_path((sy, sx), (gy, gx))
    return [
        (int(point["x"]), int(point["y"]))
        for point in result.raw_path
    ]


def _valid_path_xy(path, start_xy, goal_xy):
    if not path:
        return False

    start_xy = nearest_walkable_xy(*start_xy)
    goal_xy = nearest_walkable_xy(*goal_xy)

    if path[0] != start_xy or path[-1] != goal_xy:
        return False

    for point in path:
        if not walkable_xy(*point):
            return False

    for left, right in zip(path, path[1:]):
        if abs(left[0] - right[0]) + abs(left[1] - right[1]) != 1:
            return False

    return True


def plan_safe_route(start_xy, goal_xy):
    """
    Return a wall-safe shortest path.

    DQN is always attempted when available.
    It is accepted as the displayed route only when:
      1. every cell is walkable,
      2. every move is 4-neighbour,
      3. endpoints are correct,
      4. step count equals the BFS shortest-path length.

    Otherwise BFS becomes the visible route as a safety fallback.
    """
    start_safe = nearest_walkable_xy(*start_xy)
    goal_safe = nearest_walkable_xy(*goal_xy)

    shortest = bfs_shortest_xy(start_safe, goal_safe)
    if not shortest:
        return {
            "status": "error",
            "message": "找不到可行走路線",
            "path": [],
        }

    dqn_path = []
    dqn_runtime_error = None
    if DQN_ENGINE is not None:
        try:
            dqn_path = _dqn_path_xy(start_safe, goal_safe)
        except Exception as exc:
            dqn_runtime_error = str(exc)

    dqn_valid = _valid_path_xy(dqn_path, start_safe, goal_safe)
    dqn_steps = len(dqn_path) - 1 if dqn_path else None
    shortest_steps = len(shortest) - 1

    if dqn_valid and dqn_steps == shortest_steps:
        chosen = dqn_path
        algorithm = "dqn_verified_shortest"
    else:
        chosen = shortest
        algorithm = (
            "shortest_safe_fallback"
            if DQN_ENGINE is not None
            else "shortest_safe_fallback_no_dqn"
        )

    distance_m = round(max(0, len(chosen) - 1) * 0.6, 2)

    return {
        "status": "success",
        "algorithm": algorithm,
        "path": [{"x": x, "y": y} for x, y in chosen],
        "total_steps": max(0, len(chosen) - 1),
        "distance_m": distance_m,
        "shortest_steps": shortest_steps,
        "dqn_candidate_steps": dqn_steps,
        "dqn_candidate_valid": bool(dqn_valid),
        "dqn_available": DQN_ENGINE is not None,
        "dqn_error": DQN_ERROR or dqn_runtime_error,
        "start_safe": {"x": start_safe[0], "y": start_safe[1]},
        "target_safe": {"x": goal_safe[0], "y": goal_safe[1]},
    }
