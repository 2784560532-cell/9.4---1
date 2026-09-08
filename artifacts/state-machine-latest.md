# 每日签到：通知、提醒时间与签到内存状态合同（latest）

## Agent Handoff
- Role: state-machine specialist
- Status: complete
- Scope: 只读审查 `src/App.tsx`；定义通知权限、提醒开关、提醒时间、一次性通知任务奖励、签到内存态、七天奖励派生与 localStorage 边界
- Files created: `artifacts/state-machine-latest.md`
- Files changed: none outside this handoff document
- Decisions: 签到结果仅存在当前 React 内存；通知相关设置与通知奖励记账持久化；所有签到奖励文案和金额统一由 `rewards[day - 1]` 派生；时间选择器使用独立草稿值，保存时间绝不改变提醒开关
- Open questions: 邀请好友的成功条件、次数限制与到账规则待业务确认；当前代码未发现可复用的布拉币明细路由
- Validation run: static source review against the latest acceptance requirements; no source edit or runtime interaction performed by this role
- Next agent: ui-implementer should replace the split `reminder`/`tasks` state, remove check-in localStorage reads and writes, add persisted `reminderTime`, and use this artifact as the implementation/QA contract

## 1. 当前实现与最新需求的差距

在本次只读检查时，`src/App.tsx` 仍有以下冲突：

1. 签到奖励仍是 `1, 1, 5, 6, 7, 待定, 8`，且 `CHECKIN_REWARD=6`；必须改为唯一数据源 `rewards=[1,2,3,4,5,6,7]`。
2. 签到成功仍写入 `bula-daily-checkin-v2:*` localStorage，加载时会恢复“今日已签到”；最新要求相反，刷新必须恢复 `434 / 连签3天 / 第4天待签到`。
3. 通知 reducer 已定义，但 `App()` 仍实际使用独立的 `reminder` 与 `tasks` state；顶部开关、通知任务和余额尚未同源。
4. 通知状态没有 `reminderTime`，提醒区只在开启时静态显示 `20:00`，也没有独立时间入口或底部时间选择器。
5. 通知任务数据源当前只有一条，必须保持这一事实；实现时不得通过文字过滤或 CSS 隐藏的方式处理重复项。
6. 页面浏览与视频广告说明仍写“领取随机次数”，与 `+2` 布拉币标识冲突。
7. `BalanceSection` 已改为接收 `delta`，但调用处仍传 `showDelta`；实现时需要同步修正类型接口。

## 2. 数据所有权与持久化边界

建议将页面数据分为三个明确边界，禁止互相覆盖：

```ts
const rewards = [1, 2, 3, 4, 5, 6, 7] as const

type CheckinState = {
  phase: 'loading' | 'ready' | 'submitting' | 'claimed' | 'error' | 'reconciling'
  baseBalance: 434
  streak: number
  claimedToday: boolean
  errorMessage: string | null
  requestId: string | null
}

type NotificationPermission = 'default' | 'granted' | 'denied'

type NotificationState = {
  hydrated: boolean
  notificationPermission: NotificationPermission
  reminderEnabled: boolean
  reminderTime: string        // 规范化后的 24 小时制 HH:mm
  notificationTaskClaimed: boolean
  rewardCredited: boolean     // 通知任务 +2 的永久幂等标记
  balanceBonus: 0 | 2         // 本地通知任务相对基础余额产生的持久增量
}

type ReminderTimeSheetState = {
  open: boolean
  draftTime: string           // 只供选择器编辑，不直接写 notification state
}
```

所有权规则：

| 数据 | 权威来源 | 是否写 localStorage | 刷新行为 |
|---|---|---:|---|
| 本次签到 phase、连签、是否领取、第4天 +4 | `CheckinState` | 否 | 全部恢复到未签到默认态 |
| 本次签到产生的余额 +4 | 从 `claimedToday` 与 `rewards[3]` 派生，或仅存当前 reducer | 否 | 移除该 +4 |
| 通知权限 | `NotificationState` | 是 | 恢复 |
| 提醒开关 | `NotificationState` | 是 | 恢复，但 permission 非 granted 时强制 false |
| 提醒时间 | `NotificationState.reminderTime` | 是 | 恢复，非法值回退 `20:00` |
| 通知任务是否已领/是否已记账 | `notificationTaskClaimed` + `rewardCredited` | 是 | 永久保留，禁止补领 |
| 通知任务产生的余额 +2 | `balanceBonus` | 是 | 保留且不能重复增加 |
| 时间选择器草稿 | `ReminderTimeSheetState` | 否 | 关闭或刷新即丢弃 |

页面展示余额必须由边界相加，不能让签到 reducer 覆盖通知奖励：

```ts
const todayDay = INITIAL_STREAK + 1                 // 默认 4
const todayReward = rewards[todayDay - 1]           // 4
const checkinBonus = checkinState.claimedToday ? todayReward : 0
const displayBalance = 434 + notificationState.balanceBonus + checkinBonus
```

若为兼容现有截图态而迁移到 `rewardCredited=true / balanceBonus=0`，表示基础 434 已包含历史通知奖励；不得因为 `balanceBonus===0` 再发一次 +2。是否首次记账只能看 `rewardCredited`。

## 3. 必须持续成立的不变量

1. `reminderEnabled === true` 必然推出 `notificationPermission === 'granted'`。
2. `notificationPermission !== 'granted'` 时，规范化与 reducer 都必须强制 `reminderEnabled=false`。
3. `reminderTime` 始终满足 `^(?:[01]\d|2[0-3]):[0-5]\d$`；无值或坏值统一回退 `20:00`。
4. `notificationTaskClaimed` 与 `rewardCredited` 为单向终态：一旦 true，拒绝、撤销权限、关闭提醒、修改时间和刷新均不得改回 false。
5. 持久化数据中 `notificationTaskClaimed || rewardCredited` 任一为 true，读取规范化后两者都设为 true，以阻止旧数据或部分写入导致重复奖励。
6. `balanceBonus===2` 必须推出 `notificationTaskClaimed===true && rewardCredited===true`；`rewardCredited===false` 时 bonus 必须为 0。
7. 提醒时间保存不得修改 permission、reminderEnabled、claimed、credited 或 balanceBonus。
8. 开关点击不得修改 `reminderTime`；时间入口点击不得触发开关。
9. 通知任务只允许一个稳定 id；其 `claimed/action/disabled` 从 `NotificationState` 派生，不在第二份 task state 中存副本。
10. `rewards` 是签到奖励、日期卡、主按钮、余额增量、toast、次日提示的唯一金额来源，不保留 `CHECKIN_REWARD=4` 一类第二常量。
11. 签到提交只有一个同步 in-flight 守卫；成功只能从匹配当前 request 的 `submitting` 进入 `claimed`，旧 Promise 结果必须被忽略。
12. 签到相关代码不得调用 localStorage 的 get/set/remove/clear；尤其不得清空整个 localStorage。

## 4. 签到状态机（仅当前页面内存）

### 4.1 默认数据与派生状态

```ts
const INITIAL_STREAK = 3
const todayDay = INITIAL_STREAK + 1       // 4
const todayReward = rewards[todayDay - 1] // 4

const initialCheckinState = {
  phase: 'loading',
  baseBalance: 434,
  streak: INITIAL_STREAK,
  claimedToday: false,
  errorMessage: null,
  requestId: null,
}
```

日期卡状态只从 state 派生：

```ts
function getRewardStatus(day: number, state: CheckinState) {
  if (day <= state.streak) return 'claimed'
  if (!state.claimedToday && day === todayDay) return 'today'
  return 'locked'
}
```

默认：第1～3天已领，第4天今天可领，第5～7天待解锁。成功后 `streak=4`，第4天自然变为已领；本页面当次已完成后不把第5天标成今天。

### 4.2 事件与转换

| 当前 phase | 事件 | 下一 phase | 原子数据变化 | UI 合同 |
|---|---|---|---|---|
| `loading` | `LOAD_READY` | `ready` | 无业务金额变化 | 主按钮“签到领取4布拉币” |
| `ready` / `error` | `SUBMIT(requestId)` | `submitting` | 只写 requestId、清 error；不加币、不加连签 | 100ms 内“签到中…”+ spinner，禁止重复 |
| `submitting` | `RESOLVE_SUCCESS(requestId)` | `claimed` | `streak:3→4`、`claimedToday:true` | 第4天已领+4、余额+4、按钮“今日已签到” |
| `submitting` | `RESOLVE_ERROR(requestId, message)` | `error` | 余额、连签、卡状态全部不变 | “重新签到”并显示明确错误原因 |
| `submitting` | `RESOLVE_UNCERTAIN(requestId)` | `reconciling` | 业务数据不变 | “正在确认…”，仍禁用，避免重复发奖 |
| `reconciling` | `RECONCILE_SUCCESS(requestId)` | `claimed` | 同成功的一次性原子变化 | 同成功 |
| `reconciling` | `RECONCILE_FAILED(requestId, message)` | `error` | 业务数据不变 | 只有确认未成功后才允许重试 |

最新文案不要求短暂显示“签到成功，+4”的按钮中间态；成功响应应直接让按钮稳定为“今日已签到”，同时用 toast `签到成功，获得4布拉币` 反馈。辅助文案使用下一天派生值：

```ts
const nextReward = rewards[checkinState.streak] // streak=4 时索引4，得到5
// 明天签到可领5布拉币
```

### 4.3 防双击与异步守卫

1. 事件处理开头同步检查 `requestInFlightRef.current` 与 phase。
2. 合法点击时立即置 ref=true，再 dispatch `SUBMIT`；不要等待 Promise 或下一次 render。
3. 模拟请求延迟保持 600～900ms。
4. 每个请求生成 requestId；reducer 只接受与当前 state requestId 相同的结果。
5. success/error 后清 ref；timeout 进入 reconciling 时 ref 继续保持 true，直到结果明确。
6. 成功 action 必须一次性更新 streak 与 claimedToday，金额由 `rewards[todayDay-1]` 派生，不能在多个 effect 中分别 `+4`。
7. 不写签到 localStorage。刷新、卸载、重新挂载时自然从 initial state 重建，恢复未签到。

### 4.4 七天滚动轨道状态

奖励周期永远渲染 `rewards.map` 的7项。卡片与节点/进度线放在同一宽度为7列的内层轨道，外层滚动容器负责水平滚动：

- 可视窗口严格为6个完整卡位；轨道为7个同宽列。
- 以 CSS 变量统一列宽与 gap，并让 viewport 宽度恰好等于 `6 * column + 5 * gap`，右侧提示层覆盖在 viewport 边缘之外或渐隐，不占卡宽；不得露出半张第7卡。
- `scroll-snap-type:x mandatory`；首组锚点为第1天，末组锚点为第2天。
- 卡片和进度线节点共用相同 grid/track 尺寸，因此滚动后仍对齐。
- todayDay 在1～6时初始化到 `scrollLeft=0`；todayDay 为7时初始化到 `scrollLeft=scrollWidth-clientWidth`，直接显示第2～7天。
- 自动定位只在数据 ready 后执行一次；后续用户滑动不应被 effect 强行拉回。
- 系统滚动条隐藏；外层页面不得新增横向 overflow。

## 5. 通知权限、提醒开关与任务状态机

### 5.1 单一任务派生

基础任务数组只保留一条通知任务：

```ts
{ id: 3, title: '开启通知权限', description: '开启系统通知权限' }
```

渲染属性按统一状态派生：

```ts
const notificationTask = {
  ...baseTask,
  claimed: notificationState.notificationTaskClaimed,
  action: notificationState.notificationTaskClaimed
    ? '已领取'
    : notificationState.notificationPermission === 'denied'
      ? '去设置'
      : '去开启',
}
```

若任务已领取，即使权限后来被拒绝/撤销，任务仍显示带勾选图标的“已领取”并禁用，不能重新出现“去设置”以提供第二次领奖入口。系统设置入口仍可从顶部开关进入。

### 5.2 权限与开关转换

| 当前 permission / reminder / claimed | 事件 | 下一状态 | 副作用与提示 |
|---|---|---|---|
| default / off / no | 点顶部开关或“去开启” | 状态不变，打开同一授权说明 | 说明应使用当前 `reminderTime`；不调用真实 iOS 通知 |
| default / off / no | “暂不开启” | 不变 | 只关弹窗 |
| default / off / no | “继续开启”→ granted | granted / on / yes | 首次且 `rewardCredited=false` 时原子记账 +2；toast“签到提醒已开启，每天 HH:mm 提醒你” |
| default / off / no | “继续开启”→ denied | denied / off / no | toast“通知权限未开启，请前往系统设置授权” |
| denied / off / no | 点开关或“去设置” | 不变 | 打开模拟设置说明，绝不先打开开关 |
| granted / on / yes | 点开关 | granted / off / yes | toast“签到提醒已关闭”；不扣奖励 |
| granted / off / yes | 点开关 | granted / on / yes | toast“签到提醒已开启，每天 HH:mm 提醒你”；不重复奖励 |
| granted / 任意 / yes | 模拟系统撤销 | denied或default / off / yes | toast“通知权限已关闭”；任务仍已领 |
| denied/default / off / yes | 模拟设置后授权 | granted / on / yes | 保留 reward/bonus，不重复 +2 |

所有授权请求也要有 `permissionRequestInFlightRef`，防止“继续开启”双击重复发奖。前端 mock 可继续通过 query 参数控制 granted/denied；禁止调用或声称接入真实 iOS 通知 API。

## 6. 提醒时间选择器状态机

提醒区应形成两个同级、独立按钮：

```text
签到提醒                  [开关]
每天 20:00 ›
```

建议事件：

```ts
type TimeAction =
  | { type: 'OPEN_TIME_SHEET' }
  | { type: 'CHANGE_DRAFT_TIME'; value: string }
  | { type: 'CANCEL_TIME_SHEET' }
  | { type: 'SAVE_TIME_SHEET' }
```

转换合同：

1. `OPEN_TIME_SHEET`：`draftTime = notificationState.reminderTime`，打开移动端 bottom sheet；不改任何持久化数据。
2. `CHANGE_DRAFT_TIME`：只更新 draft，允许用户滚动/选择时与页面当前值不同。
3. `CANCEL_TIME_SHEET`：关闭并丢弃 draft；`reminderTime`、permission、switch、task、balance 全部不变。
4. `SAVE_TIME_SHEET`：先校验/规范化 draft，再只写 `notificationState.reminderTime`，关闭 sheet并持久化完整通知记录；toast `提醒时间已更新为HH:mm`。
5. 保存时间在 reminder on 时代表下一次模拟提醒立即采用新时间；reminder off 时只保存设置。两种情况均不自动切换 reminder。
6. 时间入口应始终可用，不依赖 reminder 是否开启；默认和坏值回退均为20:00。
7. 开关与时间按钮分别为真实 `<button>`，点击区域都至少44×44px；不要把两者包在同一个 click handler 中，必要时阻止事件冒泡。

## 7. localStorage 合同

仅通知域持久化，建议升级独立版本 key，或对现有 `bula-notification-v1:${scenario}` 做向后兼容迁移：

```ts
type PersistedNotificationState = {
  version: 2
  notificationPermission: NotificationPermission
  reminderEnabled: boolean
  reminderTime: string
  notificationTaskClaimed: boolean
  rewardCredited: boolean
  balanceBonus: 0 | 2
  updatedAt: string
}
```

读取规范化顺序：

1. 非对象或非法 permission：忽略记录，使用 seed。
2. `reminderTime` 非法或旧 v1 缺失：补 `20:00`。
3. `claimed = Boolean(saved.notificationTaskClaimed || saved.rewardCredited)`；`rewardCredited=claimed`。
4. permission 非 granted 时强制 reminder false。
5. 只有 `saved.balanceBonus===2 && rewardCredited` 才恢复 bonus2，否则为0。
6. `hydrated`、时间选择器 draft、任何签到 phase/request/bonus 均不写入。

写入时机：权限授权/拒绝/撤销、提醒开关切换、提醒时间保存、通知任务首次奖励到账。整条记录用一次 `setItem` 写入；取消时间选择不写；相同状态的 focus 同步不写、不重复 toast。

刷新行为验收：

- 签到立即恢复为 `434 + notificationBalanceBonus`、连签3、第4天今天可领、CTA“签到领取4布拉币”。
- notificationPermission、reminderEnabled、reminderTime、notificationTaskClaimed、rewardCredited、balanceBonus 保持。
- 禁止 `localStorage.clear()`；移除旧签到 key 不是运行时必要动作，也不要为实现刷新重置而删除其他业务 key。

## 8. 每日任务文案与完成态

从当前图标与任务数据看，奖励单位是固定 `+2` 布拉币，因此说明应同步为：

- 页面浏览：`浏览首页15秒，领取2布拉币`
- 看视频广告：`看完广告，领取2布拉币`

已领取按钮的语义和视觉不能只靠浅灰：按钮内渲染勾选 icon + `已领取`，保留 disabled，但文字/图标对比度应足以阅读。通知任务也复用同一完成态。

邀请好友当前代码只有“邀请一位朋友”和通用弹窗，没有成功条件、次数限制、到账时间/金额的真实数据；不得自行补具体规则。布拉币按钮当前没有已发现的明细路由；不要为本轮创建虚假资产页。

## 9. 实现后状态验收矩阵

| 编号 | 场景 | 预期 |
|---|---|---|
| C01 | 首次加载 | 奖励由1～7生成；连签3；第4天“今天/可领4”；CTA领取4 |
| C02 | 快速连点签到 | 只创建一个 request；提交期余额仍不变 |
| C03 | 签到成功 | 连签4、第4天已领+4、余额+4、CTA今日已签到、toast与次日+5均从 rewards 派生 |
| C04 | 签到失败 | 连签/日期/余额不变；显示重新签到和明确原因 |
| C05 | 签到成功后刷新 | 恢复未签到、连签3、移除+4；通知设置和通知+2仍保留 |
| C06 | 375px与390px默认轨道 | 只完整显示第1～6天；不露半张第7天；右侧有提示 |
| C07 | 左滑轨道 | 完整显示第2～7天；卡片与进度节点仍对齐；滚动条隐藏 |
| C08 | todayDay=7 测试 fixture | 初始自动定位第2～7天；today直接可见 |
| N01 | 未授权 | 开关关；唯一通知任务去开启；时间入口仍显示已保存时间 |
| N02 | 两个授权入口 | 顶部开关与任务按钮进入同一说明/模拟权限流程 |
| N03 | 首次授权成功 | 开关开、任务已领取、通知奖励只+2一次；刷新不重复 |
| N04 | 拒绝 | 开关关；未领取任务去设置；余额不变 |
| N05 | 授权后关闭提醒 | 开关关；任务仍已领取；时间保留；不扣币 |
| N06 | 权限撤销 | 开关自动关闭；任务与奖励记账保持；刷新一致 |
| T01 | 打开并取消时间选择器 | 草稿可变，但页面时间、开关、权限、任务、余额均不变 |
| T02 | 保存21:30 | 页面变“每天21:30 ›”，toast准确；开关状态完全不变 |
| T03 | 保存后刷新 | 仍显示21:30；通知任务不重复，通知奖励不重复 |
| A01 | 完成态可读性 | 所有已领取任务均有勾选 icon + 文本，disabled仍清晰 |

## 10. 非目标与业务待确认

- 不接真实 iOS 或浏览器通知权限服务；所有权限与提醒行为均为前端原型状态。
- 不创建布拉币明细页；当前代码没有已发现的明细路由。
- 不编造邀请好友成功条件、次数限制、奖励金额或到账时间；这些均待业务确认。
- 不改视觉体系、图片素材、技术栈或无关组件。

