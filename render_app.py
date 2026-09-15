from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app_v4_integrated import app


BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"


# 提供地圖圖片
app.mount(
    "/maps",
    StaticFiles(directory=str(PUBLIC_DIR / "maps")),
    name="maps",
)


# Render 正式首頁
@app.get("/", include_in_schema=False)
def render_home():
    return FileResponse(
        PUBLIC_DIR / "index_dqn_integrated_pdr_test_v19_idcompat.html"
    )


# Render 健康檢查
@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}
