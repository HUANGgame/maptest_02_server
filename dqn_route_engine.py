from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple
from collections import deque

import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as nn
except ImportError as exc:
    torch = None
    nn = None
    _TORCH_IMPORT_ERROR = exc
else:
    _TORCH_IMPORT_ERROR = None

GridPos = Tuple[int, int]


class DQNModelError(RuntimeError):
    pass


class RouteNotFoundError(RuntimeError):
    pass


if nn is not None:
    class DQN(nn.Module):
        """Architecture compatible with the supplied train2_dqn.py model."""

        def __init__(self, input_size: int = 6, output_size: int = 4):
            super().__init__()
            self.fc1 = nn.Linear(input_size, 128)
            self.fc2 = nn.Linear(128, 128)
            self.fc3 = nn.Linear(128, output_size)

        def forward(self, x):
            x = torch.relu(self.fc1(x))
            x = torch.relu(self.fc2(x))
            return self.fc3(x)
else:
    class DQN:
        pass


@dataclass
class RouteResult:
    status: str
    algorithm: str
    start: GridPos
    target: GridPos
    start_safe: GridPos
    target_safe: GridPos
    raw_path: List[Dict[str, int]]
    path: List[Dict[str, int]]
    raw_steps: int
    turn_points: int
    expanded_nodes: int
    estimated_distance_m: Optional[float]

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "algorithm": self.algorithm,
            "start": {"y": self.start[0], "x": self.start[1]},
            "target": {"y": self.target[0], "x": self.target[1]},
            "start_safe": {"y": self.start_safe[0], "x": self.start_safe[1]},
            "target_safe": {"y": self.target_safe[0], "x": self.target_safe[1]},
            "raw_path": self.raw_path,
            "path": self.path,
            "raw_steps": self.raw_steps,
            "turn_points": self.turn_points,
            "expanded_nodes": self.expanded_nodes,
            "estimated_distance_m": self.estimated_distance_m,
        }


class DQNRouteEngine:
    """
    DQN-guided graph search for the K-area grid.

    Important wording:
    - DQN ranks the four actions at each cell.
    - Collision checking + visited-set + backtracking guarantee safe graph search.
    - Therefore this is intentionally called "dqn_guided_search", not "pure DQN".
    """

    ACTIONS: Sequence[GridPos] = ((-1, 0), (1, 0), (0, -1), (0, 1))

    def __init__(
        self,
        grid_path: str | Path,
        model_path: str | Path,
        *,
        grid_cell_meters: Optional[float] = 0.6,
        ray_limit: int = 20,
        max_expanded_nodes: Optional[int] = None,
        device: Optional[str] = None,
    ):
        self.grid_path = Path(grid_path).resolve()
        self.model_path = Path(model_path).resolve()
        self.grid_cell_meters = grid_cell_meters
        self.ray_limit = int(ray_limit)

        if _TORCH_IMPORT_ERROR is not None:
            raise DQNModelError(
                "PyTorch 尚未安裝，無法載入 DQN。請先在要執行 DQN 的 Python 環境安裝 torch。"
            ) from _TORCH_IMPORT_ERROR

        if not self.grid_path.exists():
            raise FileNotFoundError(f"找不到真實網格地圖：{self.grid_path}")
        if not self.model_path.exists():
            raise DQNModelError(
                f"找不到 DQN 模型：{self.model_path}。不會使用隨機初始化模型代替。"
            )

        grid = pd.read_csv(self.grid_path, header=None).values
        if grid.ndim != 2 or grid.size == 0:
            raise ValueError("網格地圖格式錯誤")
        self.grid = grid.astype(int)
        self.max_y, self.max_x = self.grid.shape

        self.max_expanded_nodes = (
            int(max_expanded_nodes)
            if max_expanded_nodes is not None
            else max(2000, self.max_y * self.max_x * 2)
        )

        if device is None:
            if torch.cuda.is_available():
                device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                device = "mps"
            else:
                device = "cpu"
        self.device = torch.device(device)

        self.model = DQN(input_size=6, output_size=4).to(self.device)
        try:
            try:
                state_dict = torch.load(
                    self.model_path, map_location=self.device, weights_only=True
                )
            except TypeError:
                state_dict = torch.load(self.model_path, map_location=self.device)
            self.model.load_state_dict(state_dict)
        except Exception as exc:
            raise DQNModelError(f"DQN 模型載入失敗：{exc}") from exc

        self.model.eval()

    def _in_bounds(self, pos: GridPos) -> bool:
        y, x = pos
        return 0 <= y < self.max_y and 0 <= x < self.max_x

    def _walkable(self, pos: GridPos) -> bool:
        return self._in_bounds(pos) and self.grid[pos[0], pos[1]] == 0

    def find_nearest_walkway(self, pos: GridPos) -> GridPos:
        """Snap to nearest walkable cell using 4-neighbour BFS (no diagonal teleport)."""
        y, x = pos
        y = min(max(int(y), 0), self.max_y - 1)
        x = min(max(int(x), 0), self.max_x - 1)
        start = (y, x)
        if self._walkable(start):
            return start

        q = deque([start])
        visited = {start}
        while q:
            cy, cx = q.popleft()
            for dy, dx in self.ACTIONS:
                nxt = (cy + dy, cx + dx)
                if not self._in_bounds(nxt) or nxt in visited:
                    continue
                if self._walkable(nxt):
                    return nxt
                visited.add(nxt)
                q.append(nxt)
        raise RouteNotFoundError("地圖中找不到可行走格")

    def _ray_distance(self, current: GridPos, action: GridPos) -> int:
        y, x = current
        dy, dx = action
        count = 0
        for i in range(1, self.ray_limit):
            ny, nx = y + dy * i, x + dx * i
            if not self._in_bounds((ny, nx)) or self.grid[ny, nx] == 1:
                break
            count += 1
        return count

    def state_vector(self, current: GridPos, target: GridPos) -> List[float]:

        dy = (target[0] - current[0]) / self.max_y
        dx = (target[1] - current[1]) / self.max_x
        ray_u = self._ray_distance(current, (-1, 0))
        ray_d = self._ray_distance(current, (1, 0))
        ray_l = self._ray_distance(current, (0, -1))
        ray_r = self._ray_distance(current, (0, 1))
        return [
            float(dy),
            float(dx),
            ray_u / float(self.ray_limit),
            ray_d / float(self.ray_limit),
            ray_l / float(self.ray_limit),
            ray_r / float(self.ray_limit),
        ]

    def ranked_action_indices(self, current: GridPos, target: GridPos) -> List[int]:
        state = torch.tensor(
            self.state_vector(current, target),
            dtype=torch.float32,
            device=self.device,
        ).unsqueeze(0)
        with torch.no_grad():
            q_values = self.model(state)[0]
        return torch.argsort(q_values, descending=True).tolist()

    def _ordered_neighbors(self, current: GridPos, target: GridPos) -> List[GridPos]:
        result: List[GridPos] = []
        for idx in self.ranked_action_indices(current, target):
            dy, dx = self.ACTIONS[idx]
            nxt = (current[0] + dy, current[1] + dx)
            if self._walkable(nxt):
                result.append(nxt)
        return result

    def find_path(self, start: GridPos, target: GridPos) -> RouteResult:
        start = (int(start[0]), int(start[1]))
        target = (int(target[0]), int(target[1]))
        start_safe = self.find_nearest_walkway(start)
        target_safe = self.find_nearest_walkway(target)

        if start_safe == target_safe:
            raw = [{"y": start_safe[0], "x": start_safe[1]}]
            return RouteResult(
                status="success",
                algorithm="dqn_guided_search",
                start=start,
                target=target,
                start_safe=start_safe,
                target_safe=target_safe,
                raw_path=raw,
                path=raw,
                raw_steps=0,
                turn_points=1,
                expanded_nodes=0,
                estimated_distance_m=0.0,
            )



        visited = {start_safe}
        parent: Dict[GridPos, Optional[GridPos]] = {start_safe: None}
        stack: List[Tuple[GridPos, Optional[List[GridPos]], int]] = [
            (start_safe, None, 0)
        ]
        expanded = 0
        found = False

        while stack and expanded < self.max_expanded_nodes:
            current, neighbors, idx = stack[-1]

            if current == target_safe:
                found = True
                break

            if neighbors is None:
                neighbors = self._ordered_neighbors(current, target_safe)
                stack[-1] = (current, neighbors, 0)
                expanded += 1
                idx = 0

            if idx >= len(neighbors):
                stack.pop()
                continue

            nxt = neighbors[idx]
            stack[-1] = (current, neighbors, idx + 1)
            if nxt in visited:
                continue

            visited.add(nxt)
            parent[nxt] = current
            stack.append((nxt, None, 0))

        if not found:
            reason = (
                f"DQN-guided search 未找到路徑；expanded={expanded}, "
                f"limit={self.max_expanded_nodes}"
            )
            raise RouteNotFoundError(reason)

        cells: List[GridPos] = []
        cur: Optional[GridPos] = target_safe
        while cur is not None:
            cells.append(cur)
            cur = parent[cur]
        cells.reverse()

        raw_path = [{"y": y, "x": x} for y, x in cells]
        smoothed = self.smooth_path(raw_path)
        raw_steps = max(0, len(raw_path) - 1)
        distance = (
            round(raw_steps * self.grid_cell_meters, 3)
            if self.grid_cell_meters is not None
            else None
        )

        return RouteResult(
            status="success",
            algorithm="dqn_guided_search",
            start=start,
            target=target,
            start_safe=start_safe,
            target_safe=target_safe,
            raw_path=raw_path,
            path=smoothed,
            raw_steps=raw_steps,
            turn_points=len(smoothed),
            expanded_nodes=expanded,
            estimated_distance_m=distance,
        )

    def _straight_clear(self, a: GridPos, b: GridPos) -> bool:
        y1, x1 = a
        y2, x2 = b
        if y1 != y2 and x1 != x2:
            return False
        if y1 == y2:
            step = 1 if x2 >= x1 else -1
            for x in range(x1, x2 + step, step):
                if not self._walkable((y1, x)):
                    return False
        else:
            step = 1 if y2 >= y1 else -1
            for y in range(y1, y2 + step, step):
                if not self._walkable((y, x1)):
                    return False
        return True

    def _l_connection(self, a: GridPos, b: GridPos) -> Optional[List[GridPos]]:
        y1, x1 = a
        y2, x2 = b
        if y1 == y2 or x1 == x2:
            return [b] if self._straight_clear(a, b) else None

        c1 = (y1, x2)
        if self._walkable(c1) and self._straight_clear(a, c1) and self._straight_clear(c1, b):
            return [c1, b]

        c2 = (y2, x1)
        if self._walkable(c2) and self._straight_clear(a, c2) and self._straight_clear(c2, b):
            return [c2, b]
        return None

    def smooth_path(self, raw_path: List[Dict[str, int]]) -> List[Dict[str, int]]:
        if len(raw_path) <= 2:
            return list(raw_path)

        cells = [(int(p["y"]), int(p["x"])) for p in raw_path]
        result: List[GridPos] = [cells[0]]
        cur_idx = 0

        while cur_idx < len(cells) - 1:
            chosen_idx = cur_idx + 1
            chosen_conn: List[GridPos] = [cells[chosen_idx]]

            for target_idx in range(len(cells) - 1, cur_idx, -1):
                conn = self._l_connection(cells[cur_idx], cells[target_idx])
                if conn is not None:
                    chosen_idx = target_idx
                    chosen_conn = conn
                    break

            for pt in chosen_conn:
                if pt != result[-1]:
                    result.append(pt)
            cur_idx = chosen_idx

        return [{"y": y, "x": x} for y, x in result]
