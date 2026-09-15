from pathlib import Path

from fastapi.responses import FileResponse, HTMLResponse
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

# Fixed QR landing page
@app.get("/download/apk", response_class=HTMLResponse, include_in_schema=False)
def download_apk_page():
    return """
<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Indoor Navigation App</title>
<style>
body{
    font-family:Arial,"Microsoft JhengHei",sans-serif;
    background:#f5f7fb;
    margin:0;
    display:flex;
    min-height:100vh;
    align-items:center;
    justify-content:center;
}
.card{
    width:min(88%,420px);
    background:white;
    padding:32px 24px;
    border-radius:20px;
    text-align:center;
    box-shadow:0 8px 30px rgba(0,0,0,.10);
}
h1{font-size:24px;margin:0 0 12px;}
p{color:#555;line-height:1.7;}
.btn{
    display:block;
    margin-top:24px;
    padding:16px;
    background:#2563eb;
    color:white;
    text-decoration:none;
    border-radius:12px;
    font-size:20px;
    font-weight:bold;
}
.note{font-size:14px;color:#777;margin-top:18px;}
</style>
</head>
<body>
<div class="card">
<h1>&#21488;&#21271;&#36554;&#31449;&#23460;&#20839;&#23566;&#33322;&#31995;&#32113;</h1>
<p>&#40670;&#25802;&#19979;&#26041;&#25353;&#37397;&#19979;&#36617; Android App</p>
<a class="btn" href="/download/apk/file">&#19979;&#36617; APK</a>
<p class="note">&#22914;&#20986;&#29694;&#23433;&#20840;&#35686;&#21578;&#65292;&#35531;&#20801;&#35377;&#23433;&#35037;&#20358;&#33258;&#27492;&#20358;&#28304;&#30340;&#25033;&#29992;&#31243;&#24335;&#12290;</p>
</div>
</body>
</html>
"""

@app.get("/download/apk/file", include_in_schema=False)
def download_apk_file():
    apk_path = PUBLIC_DIR / "TaipeiStation_IndoorNavigation_FINAL.apk"
    return FileResponse(
        apk_path,
        media_type="application/vnd.android.package-archive",
        filename="TaipeiStation_IndoorNavigation_FINAL.apk"
    )
