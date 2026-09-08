# 每日签到交互状态机 v2

## 1. 现状审查与必须修正项

当前 `src/App.tsx` 使用分散的 `useState`，`handleCheckin()` 同步执行 `signed=true / streak+1 / balance+1`。奖励数组只有 6 项，第一项标签仍为“今天”，也没有加载、提交、失败、结果确认和持久化。

本轮实现必须收敛到一个签到 reducer，使余额、连签、日期卡、按钮和反馈在同一事件中原子更新。任务列表、规则弹窗、提醒开关可以继续保持独立 state，避免无关重构。

## 2. 业务常量与数据模型

```ts
type CheckinPhase =
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'success'
  | 'claimed'
  | 'error'
  | 'reconciling'

type RewardDay = {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7
  reward: number | null // null 只用于第 6 天“待定”
}

type ToastState = null | {
  id: string
  message: string
}

type CheckinState = {
  phase: CheckinPhase
  balance: number
  streak: number
  claimedThrough: number
  todayDay: 4
  todayReward: 6
  requestId: string | null
  errorMessage: string | null
  balanceDelta: number | null
  toast: ToastState
}

const INITIAL_BUSINESS_STATE = {
  balance: 434,
  streak: 3,
  claimedThrough: 3,
  todayDay: 4,
  todayReward: 6,
} as const

const day6Reward: number | null = null

const REWARDS: RewardDay[] = [
  { day: 1, reward: 1 },
  { day: 2, reward: 1 },
  { day: 3, reward: 5 },
  { day: 4, reward: 6 },
  { day: 5, reward: 7 },
  { day: 6, reward: day6Reward },
  { day: 7, reward: 8 },
]
```

初始 reducer state 必须只有 `phase: 'loading'`；业务数字可以预置在内存中，但 loading 阶段不能渲染可操作 CTA 或普通奖励卡，避免短暂闪现“立即签到”。

## 3. 日期卡状态派生

日期卡只有三种业务状态，loading 时整个奖励区域改为骨架屏，不生成第四种业务卡状态：

```ts
type DayCardState = 'claimed' | 'today' | 'locked'

function getDayCardState(day: number, state: CheckinState): DayCardState {
  if (day <= state.claimedThrough) return 'claimed'
  if (day === state.todayDay) return 'today'
  return 'locked'
}
```

| 卡状态 | 必须同时出现的非颜色线索 | 奖励文案 | 可点击性 |
|---|---|---|---|
| `claimed` | 勾选图标、文字“已领”、第 N 天/奖励 | `+N`；第 6 天若为空则“待定” | 不可点击 |
| `today` | 文字“今天”、文字“可领 6”、重点描边 | `+6` | 仅 `ready`/`error` 可触发主签到动作 |
| `locked` | 锁图标、文字“第 N 天” | `+N`；第 6 天为空显示“待定” | 点击仅 toast“连续签到至第 N 天可领取” |

初始状态：第 1～3 天 `claimed`，第 4 天 `today`，第 5～7 天 `locked`。成功后第 4 天变 `claimed`；第 5～7 天仍为 `locked`，不可将第 5 天误标为“今天”。

日期单元自身或其包裹 button 的点击区域不得小于 `44×44px`。常规手机宽度完整展示 7 项；不足时奖励容器 `overflow-x:auto`。进入 `ready`/`error` 后以第 4 天元素执行一次 `scrollIntoView({ inline: 'center', block: 'nearest' })`；若系统减弱动态效果则使用 `behavior:'auto'`，否则可用 `smooth`。

## 4. Reducer 事件

```ts
type CheckinAction =
  | { type: 'LOAD_READY' }
  | { type: 'LOAD_CLAIMED'; record: ClaimedRecord }
  | { type: 'LOAD_PENDING'; record: PendingRecord }
  | { type: 'SUBMIT'; requestId: string }
  | { type: 'SUBMIT_SUCCESS'; requestId: string; result: CheckinSuccess }
  | { type: 'SUBMIT_ERROR'; requestId: string }
  | { type: 'SUBMIT_UNCERTAIN'; requestId: string }
  | { type: 'RECONCILE_CLAIMED'; requestId: string; result: CheckinSuccess }
  | { type: 'RECONCILE_NOT_CLAIMED'; requestId: string }
  | { type: 'RECONCILE_PENDING'; requestId: string }
  | { type: 'SUCCESS_SETTLED'; requestId: string }
  | { type: 'SHOW_TOAST'; id: string; message: string }
  | { type: 'DISMISS_TOAST'; id: string }
```

所有异步结果必须携带 `requestId`。reducer 仅接受与 `state.requestId` 相同的结果，防止旧 Promise 或 timer 覆盖新状态。

## 5. 状态转换与 UI 合同

| 当前 phase | 事件 | 下一 phase | 原子数据变化 | UI |
|---|---|---|---|---|
| `loading` | `LOAD_READY` | `ready` | 保持 `434 / 3 / claimedThrough=3` | CTA“签到领取 6 布拉币” |
| `loading` | `LOAD_CLAIMED` | `claimed` | 从有效持久化记录恢复 `440 / 4 / 4` | CTA“今日已签到”；辅助“明天签到可领 7 布拉币” |
| `loading` | `LOAD_PENDING` | `reconciling` | 保持未奖励的 `434 / 3 / 3` | CTA“正在确认…”且禁用 |
| `ready`、`error` | `SUBMIT` | `submitting` | 只写 `requestId`，清空 error；绝不先加余额 | CTA“签到中…”+ 小 loading，立即禁用 |
| `submitting` | `SUBMIT_SUCCESS` | `success` | 一次性赋值 `440 / 4 / 4`；`balanceDelta=6`；toast 成功 | CTA“签到成功，+6” |
| `submitting` | `SUBMIT_ERROR` | `error` | `434 / 3 / 3` 不变 | CTA“重新签到”；下方固定错误文案 |
| `submitting` | `SUBMIT_UNCERTAIN` | `reconciling` | `434 / 3 / 3` 不变，保留 requestId | CTA“正在确认…”；固定确认提示 |
| `reconciling` | `RECONCILE_CLAIMED` | `success` | 一次性赋值服务结果 `440 / 4 / 4` | 与成功相同 |
| `reconciling` | `RECONCILE_NOT_CLAIMED` | `error` | 业务数据不变，清除 pending | 只有明确确认未签到后才恢复“重新签到” |
| `reconciling` | `RECONCILE_PENDING` | `reconciling` | 不变 | 保持禁止重复操作，可继续退避轮询 |
| `success` | `SUCCESS_SETTLED` | `claimed` | 清掉瞬时 `balanceDelta`，保留领取数据 | 稳定为“今日已签到” |

固定提示文案：

- error：`签到未完成，网络连接异常。请重试`
- reconciling：`正在确认签到结果，请勿重复操作`
- success toast：`签到成功，获得 6 布拉币`
- locked day toast：`连续签到至第 N 天可领取`

`success` 是约 1000～1500ms 的短暂展示态；定时结束后进入 `claimed`。若页面在此期间刷新，localStorage 已是 claimed，加载后直接进入 `claimed`，不重复播放成功奖励。

## 6. Reducer 关键守卫

```ts
case 'SUBMIT': {
  if (state.phase !== 'ready' && state.phase !== 'error') return state
  return {
    ...state,
    phase: 'submitting',
    requestId: action.requestId,
    errorMessage: null,
  }
}

case 'SUBMIT_SUCCESS': {
  if (state.phase !== 'submitting' || state.requestId !== action.requestId) {
    return state
  }
  return applyClaimedResult(state, action.result)
}

case 'SUBMIT_ERROR': {
  if (state.phase !== 'submitting' || state.requestId !== action.requestId) {
    return state
  }
  return {
    ...state,
    phase: 'error',
    requestId: null,
    errorMessage: '签到未完成，网络连接异常。请重试',
  }
}
```

`applyClaimedResult` 必须赋值模拟响应中的权威结果，而不是执行 `state.balance + 6`，这样即使错误回调重复到达也不会重复奖励。成功记录应先同步写入 localStorage，再 dispatch `SUBMIT_SUCCESS`，保证刷新不会重新领取。

## 7. 提交流程与防双击

点击处理按以下顺序执行：

1. 用同步 `inFlightRef.current` 守卫；如果为 true 立即 return。
2. 仅当 phase 为 `ready` 或 `error` 时继续。
3. 生成唯一 `requestId`（优先 `crypto.randomUUID()`）。
4. 立即置 `inFlightRef.current=true`，dispatch `SUBMIT`。React 下一帧按钮即“签到中…”，远低于 100ms。
5. 把 pending operation 写入 localStorage，但不写 claimed、不改余额。
6. 调用 mock Promise。
7. success：持久化 claimed → dispatch success → 清 ref。
8. error：删除当前 request 的 pending → dispatch error → 清 ref。
9. timeout/uncertain：dispatch uncertain；ref 仍保持 true，开始 reconcile；明确 claimed 或 not-claimed 前不得重新开放。

除 `disabled` 和 phase 守卫外仍需要 `inFlightRef`，因为快速双击可能发生在 React 完成重渲染之前。requestId 守卫负责解决异步乱序，二者职责不同。

## 8. 动画与减弱动态效果

- CTA `:active`：`transform: scale(.98)`，100～120ms；`submitting` 后禁用。
- 第 4 天卡状态：颜色/描边/透明度 180～220ms。
- 进度线到第 4 节点：宽度 220～280ms。
- 余额数字 434→440：250～350ms；旁边 `+6` 短暂淡入/上移后消失。
- 成功后在支持的平台调用一次 `navigator.vibrate?.(10)`；不得播放声音。浏览器拒绝或不支持时静默跳过。
- `@media (prefers-reduced-motion: reduce)`：取消 scale、位移、平滑滚动和计数滚动；使用不超过 150ms 的 opacity 或直接替换。

动画只响应业务状态，不得通过 animation end 才提交关键数据；即使动画被关闭，state 仍正确。

## 9. 验收测试矩阵

| 编号 | 场景/操作 | 预期 |
|---|---|---|
| S01 | 清 storage 后加载 | 先见奖励骨架；之后 `434 / 连签3天 / 第1～3天已领 / 第4天今天可领 / 第5～7天锁定` |
| S02 | 390px 宽度 | 完整看到第 1～7 天；第 4 天在可视区 |
| S03 | 320px 或内容不足 | 奖励区可横向滚动，并自动把第 4 天滚入可视区 |
| S04 | 所有日期卡 | 已领有勾+“已领”；今天有“今天/可领6”；待解锁有锁+“第N天”，不只靠颜色 |
| S05 | 第 6 天无配置 | 显示“待定”，不出现 `+undefined`、`+null` 或猜测数字 |
| S06 | 点击第 5/6/7 天 | 仅 toast“连续签到至第 N 天可领取”，业务数据不变 |
| S07 | success 模式单击 CTA | 100ms 内变“签到中…”且 spinner；600～900ms 后进入 success |
| S08 | success 完成 | 同步变为 `440 / 连签4天 / 第4天已领 / CTA签到成功+6 / 成功 toast / 余额旁+6` |
| S09 | success 稳定后 | CTA“今日已签到”且 disabled；辅助“明天签到可领 7 布拉币” |
| S10 | 极快双击/连点 CTA | mock submit 调用一次，余额只到 440，连签只到 4 |
| S11 | submitting 中再点/键盘激活 | 无第二请求，无提前余额变化 |
| S12 | claimed 后刷新 | loading 后直接恢复 `440 / 4 / 第4天已领 / 今日已签到`，不能重领 |
| S13 | error 模式提交 | `434 / 3 / claimedThrough=3` 全不变；CTA“重新签到”；显示固定错误文案 |
| S14 | error 后切 success 重试 | 只发一次新 request，成功后数据只增加一次 |
| S15 | timeout 模式提交 | 进入 reconciling；显示“正在确认…”和固定提示；按钮禁用 |
| S16 | reconciling 中点击或刷新 | 不开启第二次签到；刷新后仍 reconciling 并继续确认 |
| S17 | reconcile 明确 claimed | 原子变为成功值并持久化；随后 claimed |
| S18 | reconcile 明确 not-claimed | 数据不变，pending 清除，进入 error 后允许重试 |
| S19 | 旧 request 回调晚到 | requestId 不匹配，reducer 忽略，不覆盖当前状态 |
| S20 | `prefers-reduced-motion: reduce` | 无缩放/位移/平滑滚动；状态与反馈仍完整 |
| S21 | 触控尺寸检查 | 7 个日期单元、CTA、switch、返回/规则均至少 44×44px 可触达 |

## 10. 非目标

- 不接真实 API、不创建 server、不伪装线上连接。
- 不改任务列表业务逻辑、页面视觉体系或现有素材。
- 不用颜色单独承担状态含义。
- 不把第 6 天猜成任意奖励值。

