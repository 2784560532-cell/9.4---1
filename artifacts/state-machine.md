# 每日签到页：Interaction State Machine

## 1. 原则

这是纯前端演示状态，不做持久化、登录态、请求重试或复杂异步流程。状态集中放在 `CheckinScreen`；用一个小型 `useReducer` 可保证“余额 + 连签 + 进度 + 按钮 + toast”原子更新，也避免多个相互依赖的 `setState`。不要引入 Redux/Zustand/XState。

## 2. 初始状态

```ts
type ModalKind = null | "rules" | "invite";
type TaskState = "claimed" | "actionable" | "enabled";

type CheckinState = {
  balance: number;              // 434
  streak: number;               // 3
  completedThrough: number;     // 3，视觉完成第 1–3 个节点
  checkedInToday: boolean;      // false，CTA 初始仍可点
  reminderEnabled: boolean;     // true
  modal: ModalKind;             // null
  toast: null | { id: number; message: string };
  tasks: Record<"browse" | "ad" | "notify" | "invite", TaskState>;
};
```

初始 tasks：

```ts
{
  browse: "claimed",
  ad: "claimed",
  notify: "actionable",
  invite: "actionable"
}
```

### 截图与文案冲突的处理

截图同时展示“已连续签到 3 天”、前三个粉色节点和一个仍可点击的“立即签到”按钮。为优先保持初始视觉一致，初态设为 `streak=3 / completedThrough=3 / checkedInToday=false`。点击后推进到第 4 天，而不是把截图中的第一节点先改灰；这同时满足“签到后进度增加”的交互意图。可在第一节点做一次轻微 pulse，但核心状态变化应是第 4 节点由未完成变完成。

## 3. 事件

```ts
type Action =
  | { type: "BACK" }
  | { type: "OPEN_RULES" }
  | { type: "OPEN_INVITE" }
  | { type: "CLOSE_MODAL" }
  | { type: "TOGGLE_REMINDER" }
  | { type: "CHECK_IN"; toastId: number }
  | { type: "DISMISS_TOAST"; toastId: number }
  | { type: "OPEN_ALL_TASKS" }
  | { type: "ENABLE_NOTIFICATIONS" };
```

`BACK` 与 `OPEN_ALL_TASKS` 不必进 reducer；它们可以直接执行副作用。其余事件建议走 reducer。

## 4. 状态转换表

| 当前状态 | 事件 | 下一状态 | UI / 副作用 |
|---|---|---|---|
| 任意 | `BACK` | 不变 | 若有 history 则 `history.back()`；否则 `console.log("back")` |
| modal=`null` | `OPEN_RULES` | modal=`rules` | 打开规则弹层，标题“签到规则”，正文“连续签到可获得更多奖励。” |
| modal=`null` | `OPEN_INVITE` | modal=`invite` | 打开邀请弹层 |
| modal≠`null` | `CLOSE_MODAL` | modal=`null` | 关闭弹层，焦点回触发按钮 |
| 任意 | `TOGGLE_REMINDER` | reminder 取反 | switch 的 `aria-checked` 与粉/灰视觉同步 |
| checkedInToday=`false` | `CHECK_IN` | checkedInToday=`true`; balance +1; streak +1; completedThrough +1（上限 6） | CTA 变“今日已签到”且 disabled；toast “签到成功 +1 布拉币” |
| checkedInToday=`true` | `CHECK_IN` | 不变 | disabled 保证不会重复触发；不重复加币 |
| toast id 匹配 | `DISMISS_TOAST` | toast=`null` | 约 1800ms 后淡出 |
| toast id 不匹配 | `DISMISS_TOAST` | 不变 | 防止旧 timer 误关新 toast |
| notify=`actionable` | `ENABLE_NOTIFICATIONS` | notify=`enabled` | 按钮变 disabled，文案“已开启”；可同时展示轻 toast“通知已开启” |
| notify≠`actionable` | `ENABLE_NOTIFICATIONS` | 不变 | 不响应重复点击 |
| 任意 | `OPEN_ALL_TASKS` | 不变 | `console.log("all tasks")`；不新增路由 |

## 5. 签到状态派生

不要在 state 中重复保存每个奖励格的样式。通过 `completedThrough` 派生：

```ts
function rewardVisualState(index: number, completedThrough: number) {
  if (index <= completedThrough) return "completed";
  if (index === 5) return "upcoming-muted";
  return "upcoming-pink";
}
```

初始奖赏金额与标签必须保持原图：

```ts
const rewards = [
  { day: 1, label: "今天", amount: 1 },
  { day: 2, label: "第二天", amount: 1 },
  { day: 3, label: "第三天", amount: 5 },
  { day: 4, label: "第四天", amount: 6 },
  { day: 5, label: "第五天", amount: 7 },
  { day: 6, label: "第七天", amount: 8 }
];
```

注意：数组最后一个内部 index 可以是 6，但显示文案必须是“第七天”，因为截图如此。不能为了数据逻辑更整齐擅自改文案。

签到 reducer 核心：

```ts
case "CHECK_IN": {
  if (state.checkedInToday) return state;
  return {
    ...state,
    balance: state.balance + 1,
    streak: state.streak + 1,
    completedThrough: Math.min(6, state.completedThrough + 1),
    checkedInToday: true,
    toast: { id: action.toastId, message: "签到成功 +1 布拉币" }
  };
}
```

## 6. Modal / BottomSheet 行为

### 规则

- 标题：“签到规则”
- 内容：“连续签到可获得更多奖励。”
- 一个“知道了”关闭按钮即可。

### 邀请

- 标题：“邀请好友”
- 内容可保持最小：“分享邀请给一位朋友。”
- 主按钮：“立即邀请”；演示环境可 `console.log("invite")` 并关闭弹层。
- 不在 base page 上添加截图不存在的 invite code、社交平台图标或额外插画。

共同行为：

- 使用 `role="dialog"`、`aria-modal="true"` 和可读标题关联。
- 点击遮罩、关闭按钮或 Escape 关闭。
- 打开后锁定业务页面交互；关闭后恢复焦点。
- 使用 mobile runtime 时用 `BottomSheet`，不要自己绕过 screen portal。

## 7. Toast 行为

- 文案固定：“签到成功 +1 布拉币”。
- 位置：手机 viewport 底部安全区之上，视觉上不遮挡 CTA；建议 `bottom: max(24px, env(safe-area-inset-bottom) + 12px)`。
- 层级高于页面卡片，低于 modal/sheet。
- `aria-live="polite"`；出现约 1800ms，然后 160–220ms 淡出。
- 每次 toast 产生单调递增 id；新 toast 到来时清理旧 timer。

## 8. 控件语义与禁用状态

- Reminder Switch：`button role="switch" aria-checked={reminderEnabled}`，44px 最小点击区；关闭时轨道浅灰，开启时粉色。
- 签到 CTA：原生 `button`。签到后 `disabled`，文字改“今日已签到”；disabled 仍保持胶囊尺寸，透明度不要低到难辨。
- “已领取”按钮：初始 `disabled`，不能仅靠 CSS `pointer-events: none` 模拟。
- “去开启”“去邀请”：原生 button；点击反馈可做 100–150ms 的轻微 opacity/scale，但不能改变布局。
- 返回/规则/全部任务：原生 button，保留键盘 focus ring（可以使用 `:focus-visible` 精细化）。

## 9. 最小交互测试清单

1. 点击签到一次：434→435、3→4、第 4 节点完成、CTA 变 disabled、toast 出现。
2. 连点/重复触发签到：余额和 streak 不再增长。
3. Switch 可双向切换，`aria-checked` 正确。
4. 规则弹层可开、可通过按钮/遮罩/Escape 关。
5. 去开启后按钮为“已开启”且 disabled；再次点击无变化。
6. 去邀请打开邀请弹层；关闭后回到原页面。
7. 两个“已领取”按钮不可点击。
8. 点击全部任务只记录 console，不改变当前布局。
9. toast timer 不会关闭后创建的新 toast。

