# 第 7 天签到与次周期状态合同（latest）

## Agent Handoff

- Role: state-machine specialist
- Status: complete
- Scope: 只读检查 `src/App.tsx`，聚焦默认第 7 天、领取当天保持完成态、模拟进入下一自然日、刷新演示重置，以及通知 localStorage 的边界
- Files created: `artifacts/cycle-state-latest.md`
- Files changed: none outside this handoff document
- Source changed: none
- Primary decision: 签到周期与本次签到余额增量仅存在 React 内存；通知权限、提醒开关、提醒时间、通知任务领取与其一次性 `+2` 记账继续持久化。第 7 天成功后当天保持 7 天完成态，只有显式 `ADVANCE_DAY` 才切换至下一周期第 1 天。
- Test-entry decision: 删除 `prototypeDate=next` 对初始状态的直接篡改；改用仅在 `?cycleTest=1` 时出现的“模拟进入下一天”入口，它在同一页面会话内 dispatch `ADVANCE_DAY`，刷新仍回到第 7 天未签到演示态。
- Validation performed: static source/state-transition audit only; no runtime interaction and no source edit by this role
- Next agent: implement the reducer/UI deltas below, then hand to browser validation for day-7 success, same-day hold, in-session advance, and refresh/localStorage boundary checks

## 1. 当前实现盘点

`src/App.tsx` 已具备大部分正确基础：

- `rewards = [1, 2, 3, 4, 5, 6, 7]` 是统一数组。
- 默认 `INITIAL_BALANCE=434`、`INITIAL_STREAK=6`，因此第 7 天是今天，奖励由 `rewards[6]` 得到 7。
- `SUCCESS` 从提交态原子执行余额 `434→441`、连签 `6→7`、`claimedToday:false→true`。
- `ADVANCE_DAY` 已能在第 7 天领取后把 `streak` 设为 0、`claimedToday` 设为 false，并保留余额 441；之后第 1 天奖励自然由 `rewards[0]` 得到 1。
- 签到状态没有写 localStorage；通知状态仍独立写入 `bula-notification-v2:${scenario}`。

仍需修正的状态问题：

1. `getInitialCheckinState()` 读取 `prototypeDate=next` 并直接以 `streak=0` 启动；这相当于靠重载/URL 初始值冒充自然日推进，也破坏“刷新恢复第 7 天未签到”的固定演示合同。
2. 第 7 天成功 toast 仍为通用 `签到成功，获得7布拉币`，缺少本轮完成与次日重置说明。
3. `claimed` 辅助文案仍按 `rewards[Math.min(streak, 6)]` 计算；`streak=7` 时错误显示“明天签到可领7布拉币”，正确语义应为明天从第 1 天领取 1。
4. `success` 阶段按钮短暂显示“签到成功，+7”，而最新验收要求请求成功后按钮为“今日已签到”。可以保留 `success` 作为动画阶段，但其按钮语义应与 claimed 一致。
5. `ADVANCE_DAY` 没有可操作的测试入口。
6. 进入下一周期 `streak=0` 后，进度百分比公式会生成负值；必须 clamp 为 0。

## 2. 签到内存状态与派生值

无需引入另一套复杂周期模型；在当前原型中继续让 `streak` 表示“本轮已领天数”即可：

```ts
type CheckinState = {
  phase: 'loading' | 'ready' | 'submitting' | 'success' | 'claimed' | 'error' | 'reconciling'
  balance: number
  streak: number          // 0..7，本轮已领取的天数
  claimedToday: boolean
}

const rewards = [1, 2, 3, 4, 5, 6, 7] as const
const INITIAL_BALANCE = 434
const INITIAL_STREAK = 6
```

核心派生值只能从数组和 state 计算：

```ts
const todayDay = state.claimedToday
  ? Math.max(1, state.streak)
  : Math.min(state.streak + 1, rewards.length)

const todayReward = rewards[todayDay - 1]
const cycleCompleted = state.claimedToday && state.streak === rewards.length
const nextCycleReward = rewards[0]
```

禁止另设 `CHECKIN_REWARD=7`、在按钮/toast/余额中分别写死 7。当前默认的“第 7 天”和“+7”都应由 `INITIAL_STREAK + 1` 与 `rewards[6]` 得到。

## 3. 必须持续成立的不变量

1. `0 <= streak <= rewards.length`。
2. 第 7 天领取成功当天：`streak===7 && claimedToday===true`，第 1～7 天全部为 `claimed`；界面不得自动跳回第 1 天。
3. 只有显式“进入下一自然日”事件可以从完成态切到 `streak=0 / claimedToday=false`。
4. `ADVANCE_DAY` 不扣回第 7 天奖励，因此同一会话中余额继续为 441；下一周期第 1 天签到成功后才由数组再加 1。
5. 页面 reload/remount 不执行 `ADVANCE_DAY`，而是重新创建固定演示初始态 `434 / streak6 / claimedToday=false`。
6. 签到 state、phase、自然日测试状态和签到新增的 7 都不得写 localStorage。
7. 通知 localStorage 的读取、写入、迁移或失败不得改变 `streak`、`claimedToday` 或签到 phase。
8. 通知奖励是否首次到账只看 `notificationState.rewardCredited`；不得因签到刷新而清零或重发。
9. 显示余额为 `checkinState.balance + notificationState.balanceBonus`。默认截图 seed 的 `rewardCredited=true / balanceBonus=0` 表示 434 已含历史通知奖励；如果测试场景中首次授权新增 +2，刷新后应显示 436 而不是丢回 434。
10. 因此“刷新恢复余额434”准确适用于默认通知 seed；若当前 scenario 已在本地新记账通知 +2，则刷新只移除签到 +7，保留通知 +2。这是“通知奖励不能丢失/不能重复”的必要边界。

## 4. 推荐转换

### 4.1 初始与加载

```ts
function getInitialCheckinState(): CheckinState {
  return {
    phase: 'loading',
    balance: INITIAL_BALANCE,
    streak: INITIAL_STREAK,
    claimedToday: false,
  }
}
```

不要再由 `prototypeDate` 或 localStorage 改写该初始状态。加载完成后仅 `LOAD_READY: loading→ready`。

### 4.2 第 7 天提交成功

`SUCCESS` 只允许从 `submitting` 进入，并在一个 reducer action 中完成：

```ts
case 'SUCCESS': {
  if (state.phase !== 'submitting') return state
  const reward = rewards[state.streak] ?? 0
  return {
    ...state,
    phase: 'success',
    balance: state.balance + reward,
    streak: Math.min(state.streak + 1, rewards.length),
    claimedToday: true,
  }
}
```

默认请求中 `state.streak===6`，所以 reward 为 `rewards[6]===7`。防双击继续依靠同步 `requestInFlightRef` + phase 双重守卫。

成功后的 UI 合同：

- 标题：`已连续签到7天`
- 第 7 天卡：`已领 +7`
- 余额：441（再叠加既有通知 bonus）
- 主按钮：`今日已签到`
- toast：`领取成功，获得7布拉币。本轮签到已完成，明天将从第1天重新开始。`
- 按钮下辅助文案：`本轮签到已完成，明天将从第1天重新开始`

如果为了状态变化动画保留约 900ms 的 `success` phase，`buttonPresentation('success')` 也应返回“今日已签到”，不能在业务已成功后显示一个似乎仍可操作的领取文案。随后 `SET_CLAIMED` 只结束动画，不再改业务数据。

### 4.3 下一自然日

沿用现有 action，但增加严谨 guard：

```ts
case 'ADVANCE_DAY':
  return state.claimedToday && state.streak === rewards.length
    ? { ...state, phase: 'ready', streak: 0, claimedToday: false }
    : state
```

进入下一天后的同一页面状态：

- 余额仍为 441（钱包累计值，不回滚）
- 连签展示 0 天
- 第 1 天为 `today / 可领 +1`
- 第 2～7 天锁定
- CTA：`签到领取1布拉币`
- 奖励轨道定位到最左端第 1～6 天
- 进度宽度使用 `Math.max(0, ...)`，不可出现负百分比

本轮无需模拟再领第 1 天，但 reducer 现有通用 SUCCESS 路径应可正确得到 `rewards[0]===1`。

## 5. 可维护的测试入口

为同时满足“真实页面默认不出现调试控件”和“不能用刷新冒充自然日”，建议：

```ts
const cycleTestEnabled =
  new URLSearchParams(window.location.search).get('cycleTest') === '1'
```

仅当 `cycleTestEnabled && checkinState.claimedToday && checkinState.streak===7` 时，在第 7 天完成辅助文案附近显示轻量按钮：

```tsx
<button
  type="button"
  className="cycle-test-button"
  aria-label="测试：模拟进入下一自然日"
  onClick={() => dispatch({ type: 'ADVANCE_DAY' })}
>
  模拟进入下一天
</button>
```

测试 URL 示例：

```text
/?mock=success&scenario=cycle-day7&cycleTest=1
```

正确测试顺序必须发生在同一 tab、同一 React 会话：

1. 加载看到第 7 天今天可领 7。
2. 点击签到，等待成功，确认仍停在 7 天完成态。
3. 点击“模拟进入下一天”，确认切至第 1 天可领 1，余额仍 441。
4. 此时刷新，确认演示状态回到 434/第 7 天待领；通知设置仍由相同 scenario 的 localStorage 恢复。

不要继续支持 `prototypeDate=next` 作为“下一天”实现；如果为兼容旧测试 URL 暂时保留，应明确标为 deprecated，且不可参与正常初始 reducer。

## 6. 第 7 天反馈派生规则

在 `handleCheckin()` 发请求前捕获本次 day/reward，避免 Promise 返回时从已变化 state 再错误索引：

```ts
const submitDay = checkinState.streak + 1
const submitReward = rewards[submitDay - 1]
const completesCycle = submitDay === rewards.length
```

成功 toast：

```ts
const message = completesCycle
  ? `领取成功，获得${submitReward}布拉币。本轮签到已完成，明天将从第1天重新开始。`
  : `签到成功，获得${submitReward}布拉币`
```

辅助文案：

```ts
if (cycleCompleted) return '本轮签到已完成，明天将从第1天重新开始'
if (state.phase === 'claimed') {
  return `明天签到可领${rewards[state.streak]}布拉币`
}
if (!state.claimedToday && todayDay === rewards.length) {
  return '完成第7天后，明天将从第1天重新开始'
}
```

必须先判断 `cycleCompleted`，否则 `rewards[state.streak]` 在 streak=7 时为 `undefined`，或经 clamp 错显示 7。

## 7. 通知 localStorage 边界

保持当前独立持久化域：

```ts
type NotificationState = {
  notificationPermission: 'default' | 'granted' | 'denied'
  reminderEnabled: boolean
  reminderTime: string
  notificationTaskClaimed: boolean
  rewardCredited: boolean
  balanceBonus: number
}
```

允许写 localStorage 的事件只有：权限授权/拒绝/撤销、提醒开关切换、提醒时间保存、通知任务首次奖励记账。以下内容绝不持久化：

- `CheckinState`
- 当前奖励轨道 scrollLeft
- “左右滑动查看”首屏短提示是否展示（若要只展示一次会话，可用 component state；不要借通知 key 存）
- `cycleTest` 是否启用
- 是否已点击“模拟进入下一天”

时间选择器取消只丢弃 draft，不触发 notification reducer，因此不应产生 localStorage 写入。签到成功、签到失败、ADVANCE_DAY、页面刷新也不应写/删除通知 key。禁止 `localStorage.clear()`。

当前 `scenario` 参与通知 storage key 是合适的测试隔离方式。浏览器验证每个通知场景时应使用唯一 scenario，不要通过重置签到 state 来清理通知数据。

## 8. 验收矩阵

| 编号 | 场景 | 操作 | 必须结果 |
|---|---|---|---|
| C01 | 默认刷新 | 打开正常 URL | 434、连签6、第1～6已领、第7今天可领7、CTA领取7 |
| C02 | 快速双击 | 连续点签到 | 只提交一次；提交中余额仍434；按钮禁用 |
| C03 | 第7天成功 | 等待600～900ms | 441、连签7、第7天已领、按钮今日已签到、完整周期完成反馈 |
| C04 | 当天保持 | 成功后等待超过动画时长 | 仍是连签7与今日已签到；不会自动跳第1天 |
| C05 | 非法推进 | 未签到时尝试 ADVANCE_DAY | reducer no-op |
| C06 | 模拟次日 | 成功后在 cycleTest 入口推进 | 同一页面切为第1天可领1；余额仍441 |
| C07 | 次日进度 | 推进后检查轨道 | 第1天 today；进度不出现负宽度；轨道最左 |
| C08 | 成功后刷新 | 不点推进直接刷新 | 回到434、连签6、第7天待领；演示可重复 |
| C09 | 推进后刷新 | 先推进再刷新 | 同样回到固定第7天未签到演示态，不把“次日”持久化 |
| N01 | 保存提醒设置 | 修改时间/开关后刷新 | permission、开关、时间、任务领取继续保留 |
| N02 | 通知奖励已到账 | 首次授权+2后完成签到、再刷新 | 只移除签到+7；通知+2仍保留且不能再次领取 |
| N03 | 默认通知 seed | 正常场景刷新 | 默认基线仍为434，不因 claimed/credited 历史态再补+2 |
| I01 | 状态隔离 | 切换提醒、改时间、签到、推进下一天 | 各状态互不污染；任何签到事件不写通知 key |

## 9. 非目标

- 不接真实日期服务、服务端签到记录或真实 iOS 通知。
- 不把刷新解释成正式产品的自然日变化；刷新仅是本原型的演示复位。
- 不持久化签到周期或第 7 天领取结果。
- 不因新周期开始扣除钱包余额或清除通知任务奖励。
- 不改页面整体视觉、素材、任务业务或邀请流程。

