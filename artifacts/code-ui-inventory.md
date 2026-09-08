# Code UI Inventory

## 实现边界

以下内容必须由 React/CSS/统一代码图标系统渲染，不得烘焙进位图：所有可读文案、手机状态栏 glyph、返回箭头、右向 chevron、开关、按钮、进度线与节点、Modal 和 toast。

## 区域清单

| 区域 | 代码 UI | 建议结构 | 视觉/行为要点 |
| --- | --- | --- | --- |
| 页面外壳 | 390 基准的居中容器、圆角剪裁、滚动容器 | `AppShell` | 桌面不拉伸；背景四角在参考图为黑色 |
| 顶部背景 | 多层 radial/linear gradients | `HeroBackground` 或 `AppShell::before` | 暖黄在左，珊瑚粉在中右，纵向融入暖灰 |
| 状态栏 | `9:41`、信号柱、Wi-Fi、电池 | `StatusBar` | 所有 glyph 由代码渲染；不用 PNG/字符表情 |
| 导航栏 | 返回按钮、“每日签到”、“规则” | `Header` | 标题绝对中居；左右控件不参与标题的 flex 平分 |
| 余额 | “布拉币”、chevron、`434` | `BalanceSection` | 文本保持真实；数字为水平酒红→黑渐变文字 |
| 签到卡外形 | 白色大卡、右上异形提醒区 | `CheckinCard` | 用 pseudo-element/clip-path 或伪元素圆角组合实现，不要整块顶栏矩形 |
| 签到标题 | “已连续签到 3 天” | `CheckinHeader` | `3` 是独立 span，粉红渐变/实色；其余文字酒红→黑 |
| 签到提醒 | 文字 + switch | `ReminderSwitch` | 开启轨道约 34×21 CSS px，白色 thumb 约 18 px；整体可点 |
| 奖励列 | `+1,+1,+5,+6,+7,+8` 及 6 个奖励块 | `RewardDays` / `RewardTile` | 对应状态：前 3 粉边，4 浅粉，5 灰，6 浅粉 |
| 进度 | 连线、6 节点、6 文字 | `ProgressLine` | 与奖励格共用同一个 6 列 grid，防止中心漂移 |
| 签到按钮 | “立即签到”/“今日已签到” | `CheckinButton` | 垂直粉→珊瑚渐变，胶囊，可点态有 toast |
| 每日任务表头 | “每日任务”、“全部任务”、chevron | `DailyTasksHeader` | 左标题类似签到标题的酒红→黑文字 |
| 任务行 | 标题、描述、奖励数字、右侧状态按钮 | `TaskItem` | 无分割线；行步长约 70–72 px；文本不烘焙进奖励图 |
| 反馈层 | 规则 Modal、邀请 Modal、签到 toast | `Modal`, `Toast` | 需有关闭路径、可见焦点和纵向滚动时正确定位 |

## 文案与状态数据

```ts
type RewardState = 'completed' | 'upcoming' | 'disabled';
type TaskState = 'claimed' | 'actionable' | 'completed';

const rewards = [
  { amount: 1, label: '今天', state: 'completed' },
  { amount: 1, label: '第二天', state: 'completed' },
  { amount: 5, label: '第三天', state: 'completed' },
  { amount: 6, label: '第四天', state: 'upcoming' },
  { amount: 7, label: '第五天', state: 'disabled' },
  { amount: 8, label: '第七天', state: 'upcoming' },
];

const tasks = [
  { reward: 2, title: '页面浏览', description: '浏览首页15s领取随机次数', action: '已领取', state: 'claimed' },
  { reward: 2, title: '看视频广告', description: '看完广告领取随机次数', action: '已领取', state: 'claimed' },
  { reward: 2, title: '开启通知权限', description: '开启系统通知权限', action: '去开启', state: 'actionable' },
  { reward: 2, title: '邀请好友', description: '邀请一位朋友', action: '去邀请', state: 'actionable' },
  // 参考图底部还露出第 5 行，可用重复的模拟任务保持首屏截断位置。
];
```

注：第 6 个日期在截图中确实写为“第七天”，不应自作主张改成“第六天”。

## 图标 Coverage

| glyph | 语义 | 来源 | 视觉尺寸 | 容器 | 状态 | aria-label |
| --- | --- | --- | --- | --- | --- | --- |
| back | 返回上一屏 | 统一 SVG sprite / 同一 React icon 库 | 约 10×16 px | 44×44 button | default/pressed | `返回` |
| chevron-right | 进入布拉币/全部任务 | 同上 | 8–10×14 px | 至少 44 px 高点击区 | default/pressed | 分别命名 |
| signal | 蜂窝信号 | 同一 SVG sprite/CSS geometry | 约 18×12 px | 状态栏 | static | 装饰可 `aria-hidden` |
| wifi | Wi-Fi | 同上 | 约 18×13 px | 状态栏 | static | 装饰可 `aria-hidden` |
| battery | 电量 | 同上 | 约 25×12 px | 状态栏 | static | 装饰可 `aria-hidden` |
| switch | 签到提醒 | CSS 轨道 + thumb | 34×21 px | 至少 44×44 可点区 | on/off | `开启或关闭签到提醒` |

不使用 emoji，不用 PNG 替代上述功能性 glyph，不混用多个图标库。

## 样式 Token 建议

```css
:root {
  --page-width: 390px;
  --page-gutter: 16px;
  --card-radius: 16px;
  --reward-radius: 8px;
  --pill-radius: 999px;
  --bg-page: #f9f8f6;
  --card-bg: #fff;
  --pink-primary: #ff3377;
  --pink-light: #ffecf3;
  --pink-reminder: #fff1f6;
  --pink-cta-top: #ff407f;
  --pink-cta-bottom: #ff786f;
  --text-primary: #000;
  --text-secondary: #7d7d7d;
  --text-disabled: #cbcbcb;
  --gray-tile: #f2f2f2;
  --gray-button: #f7f7f7;
}
```

## 响应式结构建议

- 主基准是 390 px；375 px 可按同样比例轻微缩放。
- 320 px 下不可保持“46 px 奖励格 + 固定 9 px 间隔”，否则 6 列宽度会超过卡片。用同一 6 列 `grid-template-columns: repeat(6,minmax(0,1fr))`，格子保持参考宽高比，gap 用 `clamp(5px, 2.3vw, 9px)`。
- 日期标签与奖励格必须处于同一列网格中，禁止用独立 `space-between` 造成中心不同步。
- 任务行推荐 `grid-template-columns: 47px minmax(0,1fr) auto`；中间文字加 `min-width:0`，右按钮禁止收缩。
- 在 320 px 下任务描述字号下限 12 px，右侧按钮可缩至约 56 px，不得换行。

## Agent Handoff

- Role: visual-analyst
- Status: complete
- Scope: 划分 code-rendered UI 与状态，未实现代码。
- Files created: `artifacts/code-ui-inventory.md`
- Files changed: none outside `artifacts/`
- Decisions: 所有文字/功能 glyph/进度/开关均属于 code UI；6 列区域共用 grid 中心；任务列表预留第 5 行以匹配截图底部。
- Open questions: 第 5 行具体文案与状态需 lead 按“像素级截图”和“只用 4 个示例”之间的优先级决定。
- Validation run: 文案、控件、状态栏、功能图标已与截图逐区核对。
- Next agent: ui-architect / ui-implementer
