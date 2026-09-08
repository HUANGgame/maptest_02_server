from PIL import Image
import numpy as np
import pandas as pd

def create_real_grid(img_path, out_csv, cols=75, rows=25):
    print(f"正在讀取地圖：{img_path}...")
    img = Image.open(img_path).convert("RGB")
    
    # 將地圖精準縮放為 75x25 的微型網格
    small_img = img.resize((cols, rows), Image.Resampling.NEAREST)
    grid = np.zeros((rows, cols), dtype=int)

    for y in range(rows):
        for x in range(cols):
            r, g, b = small_img.getpixel((x, y))
            # 判斷亮度：走道是淺色(白/灰)，商店與文字是深色/綠色
            brightness = (r + g + b) / 3
            
            # 亮度 > 215 判定為走道(0)，否則判定為實體牆壁(1)
            if brightness > 215:
                grid[y, x] = 0
            else:
                grid[y, x] = 1

    # 輸出給 DQN 的完美陣列
    pd.DataFrame(grid).to_csv(out_csv, index=False, header=False)
    print(f"✅ 成功生成 1:1 真實比例陣列：{out_csv}")
    print("現在 AI 已經完全看懂這張圖的實體障礙物了！")

if __name__ == "__main__":
    # 需要先安裝套件: pip install Pillow numpy pandas
    create_real_grid("/Users/hehouxuan/專題2/maptest_02_server/public/maps/k_zone_map.png", "/Users/hehouxuan/專題2/maptest_02_server/public/maps/K_Area_Grid_Real.csv", 75, 25)