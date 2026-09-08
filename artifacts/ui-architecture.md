# 每日签到页：UI Architecture Handoff

## 1. 交付边界与视觉基准

- 唯一视觉基准：`C:/Users/Administrator/AppData/Local/Temp/codex-clipboard-fbcc4c23-9e44-4e79-b341-1e8ad965d710.png`。
- 原图尺寸为 `1159 × 2510`，其比例几乎等于一张 `390 × 844` 的 3x iPhone 截图；实现与视觉 QA 均优先在 `390 × 844` 下进行。
- 同一套布局还需在 `320 / 375 / 390 / 430px` 宽度下无重叠、溢出或图片拉伸。
- 这是单屏、纵向滚动、纯前端原型；不引入路由、状态管理库或后端请求。
- 视觉复刻优先级：几何位置 → 卡片与间距 → 字体 → 颜色/圆角/渐变 → 交互。
- 不重新设计，不补充截图中不存在的导航、说明、阴影或装饰。

## 2. Product Design / mobile runtime 合同

若项目由 Product Design `mobile-app` 模板初始化，应用代码只放在：

- `src/Prototype.tsx`
- `src/prototype.css`
- `public/assets/` 下的本页资源

以下是模板保护范围，不应修改：`src/App.tsx`、`src/main.tsx`、`src/styles.css`、`src/mobile/`、设备素材目录、`vite.config.ts`、worker 与构建脚本。页面挂载关系保持：

```text
PhoneFrame
└─ KeyboardProvider
   ├─ StatusBar                 # 模板提供；不在业务页面伪造 9:41/信号/电池
   ├─ Prototype
   │  └─ MobileScroll
   │     └─ CheckinScreen
   ├─ HomeIndicator
   └─ KeyboardDock
```

本页没有文本输入，不需要 keyboard-aware input；没有多屏流程，不需要 `FlowStack`。页面规则/邀请弹层优先用模板 `BottomSheet`，它能正确处理手机 viewport、遮罩与层级。若父实现未采用 mobile 模板，再用 app 根节点内的 accessible dialog portal 作为后备。

验证交接必须包含：`npm run check:runtime`（模板项目）、构建、在浏览器以同 viewport 截图、与原图同屏对比、测试核心交互。不能用“开发服务器能启动”代替视觉验证。

## 3. 390px 基准几何

以下数字是从原图按约 2.972 倍缩放换算的 CSS 尺寸；允许最终 QA 时做 1–3px 微调。

| 区域 | 基准尺寸 / 位置 |
|---|---|
| 页面 | `390px` 宽，暖白背景，纵向滚动 |
| iOS 状态栏 | 由 runtime 管理，约 `47px` 高 |
| 顶部导航 | 状态栏下 `52–56px`；返回 x≈`21`，标题绝对居中，规则右距≈`18` |
| Hero 渐变段 | 从顶部延伸至签到卡片中下部；业务内容约 `0–370px` |
| 余额文案 | x≈`33px`，顶部≈`119px`；字号 `15px` |
| 余额数字 | x≈`33px`，顶部≈`147px`；字号约 `40px`，行高 1 |
| IP 角色 | 宽约 `165–174px`；右≈`24px`，顶部≈`87px`；下部压到卡片顶边 |
| 签到卡片 | x=`16px`，y≈`211px`，宽=`358px`，高≈`249px`，圆角 `20–22px` |
| 签到标题 | x≈`32px`，y≈`236px`；字号 `23–24px`，粗体 |
| 提醒区 | 卡片右上约 `122 × 43px`；左侧斜切；开关约 `33 × 22px` |
| 奖励网格 | x≈`33px`，y≈`274px`，可用宽≈`324px`；6 列 |
| 奖励格 | 约 `46 × 51px`；相邻水平间隔约 `9px`；圆角 `8–10px` |
| 进度线 | 奖励格下约 `10px`；节点与 6 个奖励格中心严格同列 |
| 日期标签 | 进度线下 `10px`；6 列，字号约 `13px` |
| 签到按钮 | x≈`33px`，y≈`386px`，宽≈`324px`，高≈`52px`，完全胶囊 |
| 每日任务卡 | x=`16px`，y≈`476px`，宽=`358px`，圆角 `20px`；向下随列表扩展 |
| 任务标题行 | 左右内边距≈`17px`，顶部≈`20px`；标题约 `21–22px` |
| 单任务行 | 三列：`46px / 1fr / auto`；最小高约 `70px`；无分割线 |
| 任务奖励格 | `46 × 51px`，圆角约 `7px` |
| 任务操作按钮 | 约 `63 × 32px`，胶囊；已领取与动作态同宽附近 |

## 4. 页面层级与组件边界

```text
Prototype
└─ CheckinScreen
   ├─ HeroBackground
   │  ├─ TopNavigation
   │  │  ├─ BackButton
   │  │  ├─ ScreenTitle
   │  │  └─ RulesButton
   │  ├─ BalanceSection
   │  └─ HeroArtwork
   │     ├─ CharacterImage
   │     └─ StarDecorations
   ├─ CheckinCard
   │  ├─ CheckinHeader
   │  │  ├─ StreakCopy
   │  │  └─ ReminderSwitch
   │  ├─ RewardDays
   │  │  └─ RewardDay × 6
   │  ├─ ProgressLine
   │  ├─ DayLabels
   │  └─ CheckinButton
   ├─ DailyTasksCard
   │  ├─ DailyTasksHeader
   │  └─ TaskList
   │     └─ TaskItem × 4
   ├─ AppModal / BottomSheet
   └─ Toast
```

### `Prototype` / `CheckinScreen`

- 是唯一状态宿主，保存余额、签到状态、提醒开关、任务状态、当前弹层与 toast。
- 只向子组件传展示数据和语义事件；子组件不直接修改全局状态。
- `MobileScroll` 中只放可滚动业务内容。toast 与弹层放在滚动层之外，避免随页面滚动。

### `TopNavigation`

- 三列视觉上不能用平均 grid 导致标题偏移；标题用容器中心绝对定位，左右操作各自贴边。
- 返回箭头和右侧 chevron 采用同一图标库中最接近 iOS 的线性图标，不使用文本字符或手写 SVG。
- 可点击区域至少 `44 × 44px`，但可见图标仍按截图约 `9–10px` 宽呈现。

### `HeroArtwork`

- 角色和星星是独立 PNG，`position: absolute; object-fit: contain; pointer-events: none`。
- 角色 z-index 高于 hero 背景、低于签到卡片内容；角色下缘可被卡片主体遮挡。
- 推荐层级：background `0`、角色 `1`、签到卡片 `2`、卡片内容 `3`、toast `30`、modal/sheet `40`。

### `CheckinCard`

- 卡片本身作为单一定位上下文，不要拆成两个不对齐的白色矩形。
- 右上提醒区通过卡片内的绝对定位块 + `clip-path: polygon(18% 0,100% 0,100% 100%,0 100%)` 做斜切；这是 UI 容器几何，不是替代插画。
- 主体仍保持白色；右上块用非常淡的粉色。卡片和右上块都需裁切在大圆角内部。
- 奖励、进度节点、日期标签共用同一个 6 列 grid，保证中心严格对齐，不分别手写 left 值。

### `RewardDay`

建议 props：

```ts
type RewardVisualState = "completed" | "upcoming-pink" | "upcoming-muted";

type RewardDayProps = {
  label: string;
  amount: number;
  state: RewardVisualState;
  iconSrc: string;
};
```

- `completed`：白/极浅粉底、亮粉描边；粉币。
- `upcoming-pink`：浅粉底、无明显描边；粉币。
- `upcoming-muted`：浅灰底、无描边；灰币，数字灰。
- 第 6 个视觉是浅粉状态；日期文案按截图是“第七天”，不要自行改成“第六天”。

### `ProgressLine`

- 最稳妥结构是 6 列 grid，每格中心一个 node，再用一条绝对定位的底线贯穿首尾中心。
- 完成线宽度为 `completedIndex / 5` 的百分比；初始前三节点完成，完成线到第三节点。
- 线高约 `2px`，节点约 `6px`；完成粉色，未完成 `#ededed`。

### `TaskItem`

建议 props：

```ts
type TaskStatus = "claimed" | "actionable" | "enabled";

type TaskItemProps = {
  reward: number;
  title: string;
  description: string;
  status: TaskStatus;
  actionLabel?: "去开启" | "去邀请";
  outlinedReward?: boolean;
  onAction?: () => void;
};
```

- grid：`reward / copy / action`，中间列 `min-width: 0`，避免 320px 时把按钮挤出卡片。
- 只有前两个奖励块有亮粉描边；后两个为浅粉无描边。
- 已领取按钮必须 `disabled`；可操作按钮为浅粉底、粉色字。
- 不使用明显分割线。任务间距由 row 的 `padding-block` 控制。

## 5. CSS tokens

下面是第一版应使用的颜色与尺寸基线；颜色来自截图采样和视觉校准，而非 Tailwind 默认色。

```css
:root {
  --pink-primary: #ff3f78;
  --pink-strong: #ff2f70;
  --pink-light: #ffe5ee;
  --pink-surface: #ffebf1;
  --pink-border: #ff3d78;
  --coral-bottom: #ff8172;

  --text-primary: #0b0809;
  --text-deep: #580020;
  --text-reminder: #a64f50;
  --text-secondary: #929292;
  --text-muted: #c6c6c6;

  --bg-page: #faf9f7;
  --bg-hero-start: #fdf2d2;
  --bg-hero-mid: #fee4d9;
  --bg-hero-end: #ffdad6;
  --card-bg: #ffffff;
  --progress-off: #eeeeee;
  --button-disabled-bg: #f8f8f8;
  --button-disabled-text: #cccccc;

  --page-pad: clamp(12px, 4.1vw, 16px);
  --card-radius: 21px;
  --small-radius: 9px;
  --card-pad-x: clamp(14px, 4.35vw, 17px);
  --reward-gap: clamp(5px, 2.3vw, 9px);
  --cta-height: 52px;

  --font-ui: -apple-system, BlinkMacSystemFont, "PingFang SC",
    "Microsoft YaHei", sans-serif;
}
```

关键渐变：

```css
.checkin-screen {
  background:
    linear-gradient(118deg,
      var(--bg-hero-start) 0%,
      var(--bg-hero-mid) 44%,
      var(--bg-hero-end) 100%) top / 100% 370px no-repeat,
    var(--bg-page);
}

.balance-value {
  background: linear-gradient(90deg, #851137 0%, #3b0017 56%, #080609 100%);
  color: transparent;
  background-clip: text;
}

.checkin-cta {
  background: linear-gradient(180deg, #ff2f73 0%, #ff5575 56%, #ff8372 100%);
}
```

卡片几乎没有可见投影。若纯白边界在实际渲染里消失，仅加极轻的 `0 1px 0 rgb(255 255 255 / 70%)`，不要套通用大阴影。

## 6. 响应式策略

- 外层：`width: 100%; max-width: 430px; margin-inline: auto; min-height: 100%; overflow-x: clip;`。桌面只显示居中的手机宽内容，不扩大为桌面布局。
- 在 Product Design mobile runtime 内，不再另设 430px device frame；让 runtime 提供 phone viewport，screen 使用 `width: 100%`。
- 奖励区使用 `repeat(6, minmax(0, 1fr))`，不写 6 个固定宽度。奖励格使用 `aspect-ratio: 46 / 51`，内部图标和字体用 `clamp` 缩放。
- 任务行中间列始终 `min-width: 0`；描述 `white-space: normal`。320px 可将字号降到 `13px`，但不要把操作按钮压扁。
- 320–374px：页面 padding 可降到 12px；奖励 gap 5px；任务列 gap 9px；标题保持单行。
- 375–390px：使用基准数值。
- 391–430px：内容只做轻微扩展，关键控件最大尺寸不超过截图约 1.05 倍；通过增加左右留白避免奖励格显得过大。
- 大屏浏览器：`body` 用暖灰背景，手机页面保持 `max-width: 430px`；不在页面周围绘制额外设备外壳，除非使用 mobile runtime。

## 7. 素材合同

目标目录与消费位置：

| 路径 | 用途 | CSS 槽位（390px） |
|---|---|---|
| `/assets/ip-character.png` | Hero 粉色 IP | `165–174 × 115–130px` 可见区域；完整 PNG 可更高 |
| `/assets/coin-pink.png` | 奖励格/任务格 | 签到约 `23px`；任务约 `24px` |
| `/assets/coin-gray.png` | 未完成奖励格 | 同粉币尺寸 |
| `/assets/star-yellow.png` | Hero 星星装饰 | 左约 `25 × 34px`，右约 `23 × 27px` |

- 全部使用透明 PNG 与 `object-fit: contain`，明确 width/height，不通过非等比尺寸拉伸。
- 角色插图需保留截图中的大嘴、粉色软 3D 材质和下缘遮挡感；星星与角色色调一致。
- 资源未生成前只能短暂使用同尺寸占位路径，交接前必须替换成实际 PNG；不要用 emoji、CSS 图形、文本字符或手写 SVG 代替。
- 白/粉速度线若未包含在角色 PNG 中，应追加透明 PNG（例如 `/assets/spark-pink.png`），不要用伪元素画插画装饰。

## 8. 实现顺序与 QA gate

1. 建立 screen / hero / 两张卡片的大框架，以 390px 对齐纵向坐标。
2. 放真实 PNG，先校准角色与签到卡片的遮挡关系。
3. 用共用 6 列 grid 完成奖励、进度、日期三层对齐。
4. 完成任务三列 grid 与四条数据。
5. 校准字体、颜色、渐变、圆角；禁止提前加入通用阴影。
6. 接入状态机文档中的交互。
7. 分别在 320/375/390/430px 检查横向溢出；390×844 截图与原图对比。
8. 修完所有明显的 P0/P1/P2 视觉问题后才能交接。

验收重点：标题绝对居中、角色没有被卡片错误盖住、右上斜切区域存在、6 列三层同中心、CTA 比例不变、任务按钮不溢出、PNG 不变形、页面可滚动、disabled 真正不可点击。

