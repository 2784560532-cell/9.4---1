# 通知权限、签到提醒与任务奖励统一状态机

## Agent Handoff

- Role: state-machine analyst
- Status: complete
- Scope: notification permission, reminder toggle, one-time task reward, persistence, mock controls, focus reconciliation
- Files created: `artifacts/notification-state.md`
- Files changed: none outside this handoff document
- Source inspected: `src/App.tsx`
- Key finding: `NotificationState` / `notificationReducer` 已有雏形，但当前页面仍实际读取独立的 `reminder`、`tasks` state；因此顶部开关、任务按钮和余额尚未接入同一状态源
- Key decision: 默认无 query、无存储时保持当前截图态 `granted / true / claimed / credited`，且 `balanceBonus=0`，表示截图中的 434 已包含历史通知奖励；只有从未记账的未授权测试态首次授权时才新增 `+2`
- Open questions: none; 第一次授权结果由前端 mock 参数控制，不调用真实浏览器或 iOS 通知 API
- Validation performed: static source review and transition/invariant audit; no runtime interaction performed by this role
- Next agent: implementation agent should wire the reducer into `App`, remove `reminder` as a second source of truth, derive the single notification task from notification state, then pass the QA matrix below to browser validation

## 1. 当前代码需要收敛的边界

`src/App.tsx` 当前同时存在两套通知状态：

1. `NotificationState`、`notificationReducer`、持久化 seed/normalize helpers 已定义，但未在 `App()` 中通过 `useReducer` 使用。
2. 页面实际使用 `const [reminder, setReminder] = useState(true)`；任务实际使用 `const [tasks, setTasks] = useState(initialTasks)`。`handleTask()` 直接把任意非邀请任务改为已领取，并没有权限、奖励到账或幂等守卫。

实现时必须删除 `reminder` 这一独立业务 state，并禁止在 `tasks` state 中另存通知任务的 claimed/action。通知任务只在任务数据源中保留一次；其按钮文案、禁用状态与 `claimed` 必须从统一 `notificationState` 派生。不要用 `filter(title)`、CSS、条件隐藏第二条同名任务等方式掩盖重复项。

页面余额应由签到余额与通知流程增量组合：

```ts
const displayBalance = checkinState.balance + notificationState.balanceBonus
```

签到 reducer 继续只负责签到本身的 434→440；通知首次奖励只负责 `balanceBonus` 的 0→2。这样两个异步流程不会互相覆盖绝对余额。

## 2. 权威状态模型

```ts
type NotificationPermission = 'default' | 'granted' | 'denied'

type NotificationState = {
  hydrated: boolean
  notificationPermission: NotificationPermission
  reminderEnabled: boolean
  notificationTaskClaimed: boolean
  rewardCredited: boolean
  balanceBonus: 0 | 2
}
```

字段职责：

- `notificationPermission`：前端原型记录的模拟系统权限状态，不宣称真实读取 iOS 权限。
- `reminderEnabled`：产品内“每天 20:00 签到提醒”开关；只有权限为 `granted` 才可能为 true。
- `notificationTaskClaimed`：任务 UI 的永久领取标记。用户以后关提醒、拒绝或撤销权限时也不能回退。
- `rewardCredited`：一次性奖励记账幂等标记。是否加币只能看它，不能根据 `reminderEnabled`、`notificationPermission` 或 `balanceBonus` 猜测。
- `balanceBonus`：本地通知状态机相对签到余额新增的显示增量，只能为 0 或 2。历史截图迁移可出现 `rewardCredited=true, balanceBonus=0`，表示 434 已经包含历史 +2；新未授权态首次领取后为 2。
- `hydrated`：只用于阻止持久化读取完成前闪现错误开关/任务态，不写入 localStorage。

## 3. 必须始终成立的不变量

1. `reminderEnabled === true` 必然推出 `notificationPermission === 'granted'`。
2. `notificationPermission !== 'granted'` 时必须强制 `reminderEnabled=false`；UI 不得显示假开启。
3. `notificationTaskClaimed` 和 `rewardCredited` 是单向终态：一旦为 true，任何关闭、拒绝、撤销、刷新事件都不得改回 false。
4. 任一持久化记录只要 `notificationTaskClaimed || rewardCredited` 为 true，规范化后两者都设为 true。采用“已记账优先”可以避免坏数据或旧版本造成第二次奖励。
5. `balanceBonus===2` 必然推出 `rewardCredited===true` 且 `notificationTaskClaimed===true`。
6. `rewardCredited===false` 时 `balanceBonus` 必须为 0。
7. 首次授权是否加 2，只用授权事件进入 reducer 前捕获的 `!state.rewardCredited` 决定；不得用 `balanceBonus===0` 判断，因为默认截图态是 `credited=true / bonus=0`。
8. 顶部开关、开关旁时间、通知任务按钮、任务奖励描边及点击入口都读取同一个 `notificationState`。
9. 通知任务数据源中只允许一个稳定 id（建议 `id: 'notification-permission'`）；渲染时不得追加第二个通知任务。
10. localStorage 的整条 JSON 记录在一次 `setItem` 中原子写入；不要分多个 key 分步写 claimed、credited 与 bonus。

开发环境可增加断言：

```ts
function assertNotificationState(state: NotificationState) {
  if (state.reminderEnabled && state.notificationPermission !== 'granted') throw new Error('invalid reminder state')
  if (!state.rewardCredited && state.balanceBonus !== 0) throw new Error('uncredited bonus')
  if (state.balanceBonus === 2 && (!state.rewardCredited || !state.notificationTaskClaimed)) throw new Error('orphan bonus')
}
```

## 4. 默认态与测试 seed

### 正常页面默认截图态

无通知存储且没有 `notificationSeed` query 时：

```ts
{
  notificationPermission: 'granted',
  reminderEnabled: true,
  notificationTaskClaimed: true,
  rewardCredited: true,
  balanceBonus: 0,
}
```

页面结果：开关开启，旁边显示“每天 20:00”；唯一通知任务显示“已领取”；余额仍为 434。`balanceBonus=0` 不代表未到账，而是代表默认截图基准余额已经含历史奖励，不能加载时再加 2。

### 未授权测试态

`?scenario=notification-default&notificationSeed=default`

```ts
{
  notificationPermission: 'default',
  reminderEnabled: false,
  notificationTaskClaimed: false,
  rewardCredited: false,
  balanceBonus: 0,
}
```

首次授权成功后余额 434→436；刷新仍为 436，不得再加 2。

### 其他 seed

- `notificationSeed=denied`：`denied / false / false / false / 0`。
- `notificationSeed=granted-off`：`granted / false / true / true / 0`，用于验证已授权但主动关闭提醒。
- 未识别值：回退到正常页面默认截图态。

seed 只在对应 storage key 没有有效记录时使用。刷新时 localStorage 优先，不能让 query seed 每次重置状态。测试间隔离状态应使用不同 `scenario`，或显式清理对应 key。

## 5. UI 派生规则

```ts
const switchChecked =
  state.notificationPermission === 'granted' && state.reminderEnabled

const notificationTask = {
  id: 'notification-permission',
  title: '开启通知权限',
  description: '开启系统通知权限',
  claimed: state.notificationTaskClaimed,
  action: state.notificationTaskClaimed
    ? '已领取'
    : state.notificationPermission === 'denied'
      ? '去设置'
      : '去开启',
}
```

| 权限 / 提醒 / 已领 | 顶部 | 唯一通知任务 | 点击入口 |
|---|---|---|---|
| `default / false / false` | 开关关闭，不显示时间 | “去开启” | 任务按钮或开关均打开同一说明弹窗 |
| `granted / true / true` | 开关开启，显示“每天 20:00” | “已领取”，禁用 | 开关点击可关闭提醒 |
| `granted / false / true` | 开关关闭，不显示时间 | “已领取”，禁用 | 开关点击直接重新开启，不再领奖励 |
| `denied / false / false` | 开关关闭 | “去设置” | 两个入口均打开模拟系统设置说明 |
| `denied / false / true` | 开关关闭 | “已领取”，禁用 | 顶部开关打开模拟系统设置说明；任务保持已领取 |

无论哪种状态，页面都只渲染一个通知任务。任务为已领取时永远禁用，即使权限后来被撤销。

## 6. 事件与 reducer 转换

建议 action：

```ts
type NotificationAction =
  | { type: 'HYDRATE'; state: PersistedNotificationState }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'REMINDER_ENABLED' }
  | { type: 'REMINDER_DISABLED' }
  | { type: 'SYSTEM_PERMISSION_SYNCED'; permission: NotificationPermission }
```

### HYDRATE

- 先校验/规范化存储或 seed。
- `reminderEnabled` 必须重算为 `permission==='granted' && saved.reminderEnabled`。
- claimed 与 credited 采用 OR 后同时归一为 true，防止重复奖励。
- hydrate 本身绝不补发 +2，也不显示 toast。

### 第一次授权成功

从 `default` 经说明弹窗的“继续开启”进入模拟请求。请求成功时一次 action 原子完成：

```ts
case 'PERMISSION_GRANTED': {
  const firstCredit = !state.rewardCredited
  return {
    hydrated: true,
    notificationPermission: 'granted',
    reminderEnabled: true,
    notificationTaskClaimed: true,
    rewardCredited: true,
    balanceBonus: firstCredit ? 2 : state.balanceBonus,
  }
}
```

随后同步持久化完整 next state，并提示：`签到提醒已开启，每天 20:00 提醒你`。只有 `firstCredit` 为 true 时，余额旁/提示可附带一次 `+2` 视觉反馈；权限再次开启不得重复加币。

### 用户拒绝

`PERMISSION_DENIED`：

- `notificationPermission='denied'`
- `reminderEnabled=false`
- claimed、credited、bonus 原值不动
- 提示：`通知权限未开启，请前往系统设置授权`

### 用户主动关闭提醒

仅在当前权限为 granted 时接受 `REMINDER_DISABLED`：

- 只设 `reminderEnabled=false`
- claimed、credited、bonus 均不变
- 提示：`签到提醒已关闭`

### 已授权时重新打开

仅在 `notificationPermission==='granted'` 时接受 `REMINDER_ENABLED`：

- 只设 `reminderEnabled=true`
- 不调用权限请求，不修改 claimed、credited、bonus
- 提示：`签到提醒已开启，每天 20:00 提醒你`

### 权限撤销 / 页面重新同步

在 mount 后 hydration 完成，以及 `window.focus` / `visibilitychange` 回到 visible 时调用模拟权限读取。`SYSTEM_PERMISSION_SYNCED` 规则：

- 外部值等于当前值：no-op，不重复 toast、不重复写 storage。
- 当前为 granted，外部变为 denied/default：写入外部权限值并强制 reminder false；claimed、credited、bonus 保留；仅在这次真实转变时提示 `通知权限已关闭`。
- 当前为非 granted，外部变为 granted：视作用户已在模拟设置中授权，执行与 `PERMISSION_GRANTED` 相同的幂等领取逻辑。若奖励历史已领，只恢复提醒，不再加币。
- 没有 `systemPermission` query 时返回 null，表示原型没有可用的外部观测值；不得擅自覆盖本地状态。

监听器必须在 effect cleanup 中移除。focus 与 visibilitychange 可能连续触发，reducer 的相等值 no-op 与 `rewardCredited` 守卫必须共同防重。

## 7. 入口流程

### notificationPermission = default

点击顶部开关或通知任务“去开启”，必须调用同一个 `beginNotificationEnable()`：

1. 打开轻量说明 modal：`开启后，我们会在每天 20:00 提醒你签到，可随时关闭。`
2. modal 两个按钮严格为 `暂不开启`、`继续开启`。
3. `暂不开启` 只关闭 modal，不改变任何业务状态。
4. `继续开启` 后显示短暂进行中状态并调用 `simulateNotificationPermission()`。
5. mock granted → `PERMISSION_GRANTED`；mock denied → `PERMISSION_DENIED`。

这是前端网站原型，界面/代码注释应明确“模拟系统权限请求”，不得调用或声称调用真实 iOS 权限。即使使用浏览器 `Notification` API，也不能把它当作本轮业务真相；本轮以 mock 状态为准。

### notificationPermission = denied

点击顶部开关或未领取任务的“去设置”，打开模拟设置说明，不把开关先设为 true，也不先领奖励。说明可写：`请在系统设置中允许通知，返回页面后我们会同步权限状态。` 关闭说明不改变状态。测试时通过 `systemPermission=granted` 后重新进入/聚焦页面模拟在设置中授权。

### notificationPermission = granted

- reminder true：点击开关直接 dispatch `REMINDER_DISABLED`。
- reminder false：点击开关直接 dispatch `REMINDER_ENABLED`。
- 两者都不改任务领取和奖励记账状态。

## 8. localStorage 合同与迁移

沿用当前场景隔离方式，避免与签到 storage 混用：

```ts
const key = `bula-notification-v1:${scenario}`

type PersistedNotificationState = {
  version: 1
  notificationPermission: NotificationPermission
  reminderEnabled: boolean
  notificationTaskClaimed: boolean
  rewardCredited: boolean
  balanceBonus: 0 | 2
  updatedAt: string
}
```

示例（未授权后首次授权成功）：

```json
{
  "version": 1,
  "notificationPermission": "granted",
  "reminderEnabled": true,
  "notificationTaskClaimed": true,
  "rewardCredited": true,
  "balanceBonus": 2,
  "updatedAt": "2026-09-04T12:00:00.000Z"
}
```

读取与规范化：

1. 非对象、非法 permission、非法 version：忽略并使用 seed。
2. `claimed = Boolean(saved.notificationTaskClaimed || saved.rewardCredited)`。
3. `rewardCredited = claimed`；这是保守迁移，缺失一侧时视作已经发过，禁止补发。
4. `reminderEnabled = permission==='granted' && Boolean(saved.reminderEnabled)`。
5. `balanceBonus = saved.balanceBonus===2 && rewardCredited ? 2 : 0`。
6. 旧记录若 claimed=true、缺少 rewardCredited/balanceBonus：规范化为 `claimed=true / credited=true / bonus=0`，不能补发奖励。
7. JSON 损坏或 localStorage 不可用时页面仍可运行；可 `console.warn`，不要崩溃或自动反复加币。

写入时机：授权成功、拒绝、关闭提醒、重开提醒、系统权限变化后都写入完整记录。若 state 没有变化则不写。`hydrated` 不持久化。

## 9. Mock query 合同

为实际验收保留以下 URL 参数，不在正式 UI 增加调试控件：

- `scenario=<id>`：隔离 localStorage key；每个测试用唯一值。
- `notificationSeed=default|denied|granted-off`：仅在该 scenario 没有有效存储时决定初始态。
- `permissionResult=granted|denied`：控制点击“继续开启”后的模拟权限结果，默认 granted。
- `systemPermission=default|granted|denied`：控制 mount/focus 时模拟查询到的系统权限；缺省表示“不提供外部覆盖”。

推荐测试 URL：

```text
/?scenario=notify-fresh&notificationSeed=default&permissionResult=granted
/?scenario=notify-deny&notificationSeed=default&permissionResult=denied
/?scenario=notify-off&notificationSeed=granted-off
/?scenario=notify-revoke&systemPermission=denied
```

撤销测试需先在同一个 `scenario=notify-revoke` 建立 granted/claimed 存储，再加 `systemPermission=denied` 重载或聚焦；否则只是“初始 denied”，不能验证已领取奖励的保留。

## 10. 防重复奖励合同

授权处理必须计算并提交一个完整 next state，不能先 `setClaimed` 再在另一个 effect 中 `+2`：

```ts
function grantNotification(state: NotificationState): NotificationState {
  const firstCredit = !state.rewardCredited
  return {
    ...state,
    notificationPermission: 'granted',
    reminderEnabled: true,
    notificationTaskClaimed: true,
    rewardCredited: true,
    balanceBonus: firstCredit ? 2 : state.balanceBonus,
  }
}
```

还需增加同步请求守卫，避免“继续开启”双击在 React 重渲染前发出两个 mock：

```ts
if (permissionRequestInFlightRef.current) return
permissionRequestInFlightRef.current = true
try {
  const result = await simulateNotificationPermission(...)
  // dispatch exactly once
} finally {
  permissionRequestInFlightRef.current = false
}
```

防重层级：

1. modal 主按钮请求中 disabled；
2. 同步 `permissionRequestInFlightRef` 封住同一事件循环双击；
3. reducer 只以 `rewardCredited` 判断首次记账；
4. 整条持久化记录含 claimed、credited、bonus；
5. hydration/focus 规范化后，任一历史 claimed/credited 都视为奖励已发；
6. 关提醒、拒绝、撤销、再授权永不把 credited 清零。

## 11. 事件矩阵

| 当前状态 | 事件 | 下一状态（permission / reminder / claimed / credited / bonus） | 提示 / UI |
|---|---|---|---|
| default / off / no / no / 0 | 暂不开启 | 不变 | 关闭说明 |
| default / off / no / no / 0 | 继续开启→granted | granted / on / yes / yes / 2 | 开启 toast；余额 +2 |
| default / off / no / no / 0 | 继续开启→denied | denied / off / no / no / 0 | 未授权、去设置 |
| denied / off / no / no / 0 | 点击开关/去设置 | 不变 | 模拟设置说明，绝不假开启 |
| granted / on / yes / yes / 0或2 | 关闭提醒 | granted / off / yes / yes / 原值 | `签到提醒已关闭` |
| granted / off / yes / yes / 0或2 | 重开提醒 | granted / on / yes / yes / 原值 | 开启 toast，不加币 |
| granted / on / yes / yes / 0或2 | 系统撤销 | denied或default / off / yes / yes / 原值 | `通知权限已关闭`；任务仍已领取 |
| denied/default / off / yes / yes / 0或2 | 设置后同步 granted | granted / on / yes / yes / 原值 | 开启 toast，不加币 |
| 任意合法态 | 刷新 HYDRATE | 规范化后的同一业务态 | 不显示奖励 toast，不重复加币 |

## 12. QA 验收矩阵

| 编号 | 场景 | 操作 | 必须结果 |
|---|---|---|---|
| N01 | 正常默认截图态 | 清默认 scenario 存储后加载 | 开关开、显示 20:00、唯一任务已领取、余额 434 |
| N02 | 尚未授权 | default seed 加载 | 开关关、唯一任务“去开启”、余额 434 |
| N03 | 两个入口一致 | 分别点开关和“去开启” | 均显示同一说明、同两个按钮 |
| N04 | 取消授权 | 点“暂不开启” | 状态与余额完全不变 |
| N05 | 首次授权 | permissionResult=granted 后继续 | 开关开、20:00、任务已领取、余额只到 436、准确 toast |
| N06 | 授权双击 | 快速双击“继续开启” | 只调用一次 mock，余额只 +2 |
| N07 | 刷新持久化 | N05 后刷新多次 | 仍为 436；任务仍唯一且已领取；无第二次 +2 |
| N08 | 用户拒绝 | permissionResult=denied | 开关关、任务“去设置”、余额不变、准确拒绝提示 |
| N09 | denied 入口 | 点“去设置”或顶部开关 | 展示模拟设置说明；开关不先亮、任务不先领取 |
| N10 | 已授权主动关闭 | 从 granted/on 点击开关 | granted/off；任务仍已领取；不扣币；关闭 toast |
| N11 | 已授权重开 | 从 granted/off 点击开关 | granted/on；任务仍已领取；不加币；显示 20:00 |
| N12 | 权限撤销 | granted/claimed 后聚焦并同步 denied | 开关自动关闭；提示权限已关闭；任务仍已领取；余额不变 |
| N13 | 撤销后刷新 | N12 后刷新 | denied/off/claimed 保持；不重置奖励、不重复 toast |
| N14 | 设置后重新授权 | revoked 后同步 granted | 开关恢复；任务仍已领取；不再次 +2 |
| N15 | focus 重复事件 | 连续 focus/visible | 状态相同时 no-op，无重复 toast、无重复奖励 |
| N16 | 坏/旧存储 | claimed=true 但 credited/bonus 缺失 | 归一为已领/已记账/bonus0，禁止补发 |
| N17 | DOM/数据检查 | 检查任务数组与渲染结果 | 数据源和 DOM 都只有一条“开启通知权限”，不是 CSS/filter 隐藏 |
| N18 | 状态一致性 | 遍历所有场景 | reminder true 时 permission 必为 granted；任务和顶部永远同源 |

## 13. 非目标

- 不接真实 iOS、浏览器 Notification API 或远端服务。
- 不重做页面布局、配色、圆角、字体和素材。
- 不改变签到状态机或七天奖励业务。
- 不因权限关闭/撤销扣回余额。
- 不在权限重新开启时重置任务或重复发放 +2。

