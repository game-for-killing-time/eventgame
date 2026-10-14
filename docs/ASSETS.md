# 圖片素材

十個角色來源為使用者提供並已存放的 `public/art/characters.png`。經使用者明確同意，使用本機圖片處理製作 `public/art/characters/0.png` 至 `9.png`，每張 256×320、透明背景，移除底色及編號，保留造型。原圖保留。編號依 `src/characters.js` 對應。

重建工具為 `scripts/extract-characters.py`，需要 Python、Pillow、numpy、scipy、onnxruntime，以及本機 `~/.u2net/u2net.onnx` 模型；工具會檢查模型雜湊。模型不隨網站發布，瀏覽器只載入 PNG，不需任何圖片處理依賴。

獨立背景 `public/art/island-walk.png` 使用內建 imagegen 生成。提示詞：

> A clean background asset for a cozy mobile party game, landscape 16:9. Plush miniature seaside village, sunny turquoise sea, lush tropical trees and palm leaves framing sides, pastel cottages and flowers in background, a broad empty sandy walking path across the lower third. Handcrafted soft 3D toy diorama style, cheerful warm daylight, gentle depth of field. NO characters, NO animals, NO people, NO lettering, NO signs, NO logos, NO interface. Empty foreground path for separately overlaid game sprites.

原有木牌與主視覺沿用專案素材。介面文字與按鈕不嵌在圖片內。驗收截圖位於 `docs/screenshots/mobile-affinity-*.png`。
