# 每日签到页：Backend / Data Contract

## 1. 本次实现结论

本页不需要后端。用户要求的是可运行、可交互的截图复刻；所有数据均为本地 mock，页面刷新后恢复截图初始状态。不要为此创建 API server、数据库、鉴权、localStorage schema、React Query 或请求 loading/error UI。

## 2. 前端静态数据合同

```ts
export type RewardDay = {
  day: number;
  label: string;
  amount: number;
};

export type DailyTask = {
  id: "browse" | "ad" | "notify" | "invite";
  title: string;
  description: string;
  reward: number;
  initialStatus: "claimed" | "actionable";
  actionLabel?: "去开启" | "去邀请";
  outlinedReward: boolean;
};
```

必须使用的 mock 数据：

```ts
export const INITIAL_BALANCE = 434;
export const INITIAL_STREAK = 3;

export const REWARDS: RewardDay[] = [
  { day: 1, label: "今天", amount: 1 },
  { day: 2, label: "第二天", amount: 1 },
  { day: 3, label: "第三天", amount: 5 },
  { day: 4, label: "第四天", amount: 6 },
  { day: 5, label: "第五天", amount: 7 },
  { day: 6, label: "第七天", amount: 8 }
];

export const TASKS: DailyTask[] = [
  {
    id: "browse",
    title: "页面浏览",
    description: "浏览首页15s领取随机次数",
    reward: 2,
    initialStatus: "claimed",
    outlinedReward: true
  },
  {
    id: "ad",
    title: "看视频广告",
    description: "看完广告领取随机次数",
    reward: 2,
    initialStatus: "claimed",
    outlinedReward: true
  },
  {
    id: "notify",
    title: "开启通知权限",
    description: "开启系统通知权限",
    reward: 2,
    initialStatus: "actionable",
    actionLabel: "去开启",
    outlinedReward: false
  },
  {
    id: "invite",
    title: "邀请好友",
    description: "邀请一位朋友",
    reward: 2,
    initialStatus: "actionable",
    actionLabel: "去邀请",
    outlinedReward: false
  }
];
```

## 3. 资源 URL 合同

Vite `public` 目录中的资源用根相对 URL 引用，不能在业务代码中硬编码本机绝对路径：

```ts
export const ASSETS = {
  character: "/assets/ip-character.png",
  pinkCoin: "/assets/coin-pink.png",
  grayCoin: "/assets/coin-gray.png",
  yellowStar: "/assets/star-yellow.png",
  pinkSpark: "/assets/spark-pink.png" // 仅当速度线未合并在角色图中
} as const;
```

每个资源必须返回有效图片并以透明背景适配卡片/渐变背景；消费端统一 `object-fit: contain`。构建与预览时检查 Network/console，不能以 broken image 或 emoji 交接。

## 4. 前端动作合同

本地演示动作及结果：

| 动作 | 输入 | 结果 |
|---|---|---|
| 签到 | 无 | 本地余额 +1、连签 +1、进度推进、toast |
| 切换提醒 | boolean toggle | 仅更新本地 switch 状态 |
| 开启通知 | task id=`notify` | task 状态变 `enabled`，按钮“已开启” |
| 邀请好友 | task id=`invite` | 打开邀请 modal；确认时 console.log |
| 全部任务 | 无 | `console.log("all tasks")` |
| 返回 | 无 | `history.back()` 或 console.log fallback |

这些动作都应同步完成，不展示 loading spinner，不伪造网络延迟。

## 5. 可选的未来真实 API（本次不要实现）

只有后续用户明确要求接后端时，才建议以下最小接口：

```ts
type CheckinOverviewResponse = {
  balance: number;
  streak: number;
  completedThrough: number;
  checkedInToday: boolean;
  reminderEnabled: boolean;
  tasks: Array<{
    id: DailyTask["id"];
    status: "claimed" | "actionable" | "enabled";
  }>;
};

type CheckinResponse = {
  awardedCoins: number;
  balance: number;
  streak: number;
  completedThrough: number;
  checkedInToday: true;
};
```

可能的端点仅作未来约定：

- `GET /api/checkin/overview`
- `POST /api/checkin`
- `PATCH /api/checkin/reminder` body `{ enabled: boolean }`
- `POST /api/tasks/notify/complete`

真实签到接口必须由服务端保证幂等，不能信任客户端的余额或 streak；但这些要求不属于当前纯前端交付范围。

## 6. 错误、隐私与持久化边界

- 当前无请求，因此无 error/loading/empty 状态。
- 不申请真实浏览器通知权限；“去开启”只更新 mock UI。
- 不调用系统分享、不读取联系人；邀请仅展示弹层。
- 不收集个人数据，不写 cookie/localStorage/sessionStorage。
- 刷新恢复 `434 / 连签3天 / 前三节点完成 / CTA可签到` 的截图初态。

## 7. 交接验收

- 源码中没有 `fetch`/Axios/后端依赖。
- 没有硬编码 `C:/...` 资源路径。
- 数据文案与截图一致，尤其是第 6 列显示“第七天”。
- 交互状态只通过本地 state 改变，刷新可复位。
- 资源 URL 在 Vite dev/build 两种模式下均可加载。

