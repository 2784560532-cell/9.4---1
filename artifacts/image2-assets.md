# Image2 Assets Inventory

## 分类结论

只有复杂插画/物体类视觉进入位图资产：粉色 3D IP 角色、星星/光线装饰、粉色硬币、灰色硬币。文字、状态栏、箭头、开关、按钮和进度节点不进入 image2。

## 资产清单

| id | UI 位置/用途 | 类型 | 946 视图槽位 | 390 CSS 槽位 | 375 CSS 槽位 | 建议导出 | 比例 | 透明 | 后处理 | 目标路径 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ip-character` | 余额区右侧的粉色 3D 怪兽角色 | `foreground-cutout` | 主体约 `(482,273)-(821,530)` | 约 `140×106 px` | 约 `134×102 px` | 560×424 PNG（4x CSS） | 1.32:1 | 是 | remove-background, transparent-png, trim with safe padding | `public/assets/ip-character.png` |
| `hero-sparkles` | IP 周围两颗星星、粉白飞线/闪光，保持精确相对位置 | `foreground-cutout` | 约 `(454,223)-(903,450)` | 约 `185×94 px` | 约 `178×90 px` | 740×376 PNG | 1.97:1 | 是 | transparent-png, 保留外围安全边 | `public/assets/hero-sparkles.png` |
| `star-yellow` | 可替换的单颗黄色 3D 星星；可在无组合装饰图时复用 | `object-cutout` | 左星约 `56×55 px`，右星约 `51×52 px` | 约 `23×23 px` / `21×21 px` | 约 `22×22 px` / `20×21 px` | 192×192 PNG | 1:1 | 是 | transparent-png | `public/assets/star-yellow.png` |
| `coin-pink` | 已完成/浅粉奖励格与任务奖励块 | `object-thumbnail` | 可见硬币约 `55×56 px` | 约 `23×23 px` | 约 `22×22 px` | 192×192 PNG | 1:1 | 是 | transparent-png, center with safe padding | `public/assets/coin-pink.png` |
| `coin-gray` | 第 5 天未完成奖励格 | `object-thumbnail` | 可见硬币约 `55×56 px` | 约 `23×23 px` | 约 `22×22 px` | 192×192 PNG | 1:1 | 是 | transparent-png, center with safe padding | `public/assets/coin-gray.png` |

## 构图与裁切规则

### `ip-character.png`

- 主体是正面略向上的粉色 3D 软胶怪兽：大张口、深红口腔、上方两颗白色小獠牙、三道深粉额头弧线、短手短脚。
- 光源柔和，上部高光偏冷白，下部略淡且有柔光；整体是高级 App 活动页的光滑 3D 玩具质感。
- 导出图中不要包含卡片、文字、开关、星星或状态栏；四周留 6–8% 透明安全边。
- CSS 使用 `object-fit: contain`，参考定位约 `right: 51px; top: 112px; width: 140px; height: 106px` 对应 390 基准，底部被签到卡遮住约 5–6 px。

### `hero-sparkles.png` / `star-yellow.png`

- 组合装饰图是更高还原的方案：左星位于 x≈187–215 CSS px、y≈107–154 px，右星位于 x≈349–372 px、y≈131–158 px；白/粉飞线分布在角色右上和右下。
- 若仅使用 `star-yellow.png` 复用，需用不同旋转和尺寸，但无法完全还原左星后的黄橙长尾；精确比对时优先组合装饰图。

### `coin-pink.png` / `coin-gray.png`

- 正面略有透视的双层圆形硬币，中央五角星浅浮雕，外圈有小刻痕；粉色版为高饱和粉渐变，灰色版是同模型去饱和银灰。
- 两张图必须具有完全一致的透视、边缘留白和主体占比，否则切换到第 5 天时会视觉跳动。
- CSS 槽位使用正方形 23×23 px，`object-fit: contain`；不把 `+1/+2/...` 文字做进图里。

## 统一 image2 风格 Tokens

- 色板：主粉 `#FF4C86`、亮粉 `#FF8DB5`、深红 `#8D0003`、奶白高光 `#FFF8F7`、星星黄 `#FFD84E`。
- 材质：光滑、柔软、略半透明的糖果/确胶 3D；边缘不是超硬矢量轮廓。
- 光照：左上柔箱光，正面光柔，少量环境反射；透明背景，无实体投影底板。
- 视角：正面、略俯视，对象居中，不要广角畸变。

## 必须加入每个 image2 Prompt 的负面约束

```text
no icons, no UI symbols, no readable text, no logo, no watermark,
no status bar, no battery/Wi-Fi/signal glyphs, no arrows, no gear,
no menu dots, no plus/minus, no power symbol, no playback controls,
no tab icons, no toggles, no status dots, no buttons, no cards,
no opaque background plate, no clipped edges, no emoji, no flat CSS illustration
```

## 当前资产状态

- 本 visual-analyst 只做资产拆分和槽位定义，没有调用 image2，也没有创建占位 PNG。
- 上述目标路径是对 asset-engineer 的交付约定，不表示文件已存在。
- 若后续使用占位资产，必须在预览/交付中明确标注 placeholder，不得宣称为 image2 生成结果。

## Agent Handoff

- Role: visual-analyst
- Status: complete
- Scope: 识别 image2 资产、槽位尺寸、风格与负面约束；未生成或修改图片。
- Files created: `artifacts/image2-assets.md`
- Files changed: none outside `artifacts/`
- Decisions: IP 角色与装饰层分离；推荐额外组合 `hero-sparkles.png` 保证相对位置；粉/灰硬币使用同模型两个 PNG。
- Open questions: 是否生成 `hero-sparkles.png` 组合层，还是严格只预留用户列举的 4 个文件名；建议前者以提高精度。
- Validation run: 已人工核对每个位图候选在 946/390/375 三套尺度下的槽位。
- Next agent: asset-engineer
