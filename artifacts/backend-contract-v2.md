# 每日签到 Mock / 持久化合同 v2

## 1. 边界

本轮是明确标识的前端 mock，不连接真实后端。Promise 延迟只用于演示异步状态，不能在文案或代码中暗示数据来自线上。实现需保留 `success / error / timeout` 三种可切换结果，并为 timeout 提供结果确认阶段。

## 2. Mock 运行模式

```ts
type MockSubmitMode = 'success' | 'error' | 'timeout'
type MockReconcileResult = 'claimed' | 'not_claimed' | 'pending'

const DEFAULT_MOCK_MODE: MockSubmitMode = 'success'
const DEFAULT_TIMEOUT_RECONCILE: MockReconcileResult = 'pending'
```

建议提供不进入生产 UI 的切换方式，便于实际截图和验收：

```ts
function getMockMode(): MockSubmitMode {
  const mode = new URLSearchParams(location.search).get('mock')
  return mode === 'error' || mode === 'timeout' || mode === 'success'
    ? mode
    : DEFAULT_MOCK_MODE
}
```

- `/?mock=success`：默认成功。
- `/?mock=error`：明确失败。
- `/?mock=timeout`：请求结果不确定，进入 reconciling。
- timeout 的确认结果可通过独立开发常量或 `?reconcile=claimed|not_claimed|pending` 控制；默认 `pending`，方便验证“不立即开放重复签到”。

验收不同模式前必须清理当天 demo 记录，否则已持久化 claimed 会正确地直接进入“今日已签到”，不会再次提交。

## 3. 请求与响应类型

```ts
type CheckinRequest = {
  requestId: string
  dayKey: string
  expectedDay: 4
}

type CheckinSuccess = {
  requestId: string
  dayKey: string
  awardedCoins: 6
  balance: 440
  streak: 4
  claimedThrough: 4
  checkedInToday: true
}

class MockNetworkError extends Error {
  code = 'MOCK_NETWORK_ERROR' as const
}

class MockUncertainError extends Error {
  code = 'MOCK_RESULT_UNCERTAIN' as const
}

type ReconcileResponse =
  | { status: 'claimed'; result: CheckinSuccess }
  | { status: 'not_claimed' }
  | { status: 'pending' }
```

模拟成功响应返回绝对值，不返回“客户端自行 +6”的指令。UI reducer 直接采用响应中的 `440 / 4 / 4`，可避免重放回调造成重复累计。

## 4. Promise 行为

```ts
function mockSubmitCheckin(
  request: CheckinRequest,
  mode: MockSubmitMode,
): Promise<CheckinSuccess> {
  const delay = 600 + Math.floor(Math.random() * 301) // 600..900ms

  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (mode === 'error') {
        reject(new MockNetworkError('mock network failure'))
        return
      }
      if (mode === 'timeout') {
        reject(new MockUncertainError('mock result unknown'))
        return
      }
      resolve({
        requestId: request.requestId,
        dayKey: request.dayKey,
        awardedCoins: 6,
        balance: 440,
        streak: 4,
        claimedThrough: 4,
        checkedInToday: true,
      })
    }, delay)
  })
}
```

error 与 timeout 必须使用不同错误码，不得仅根据错误 message 猜测。只有 error 能立即清除 pending 并恢复重试；timeout 进入 reconciling，不能当失败处理。

## 5. 结果确认行为

```ts
function mockReconcileCheckin(
  request: CheckinRequest,
  resultMode: MockReconcileResult,
): Promise<ReconcileResponse>
```

建议首次等待约 1000ms，后续使用 1500ms、3000ms 的有上限退避；组件卸载时取消 timer。返回值处理：

- `claimed`：先持久化 claimed，再 dispatch `RECONCILE_CLAIMED`。
- `not_claimed`：删除 requestId 匹配的 pending，再 dispatch `RECONCILE_NOT_CLAIMED`，此后才允许重试。
- `pending`：保持 reconciling 和禁用状态；可停止自动轮询并保留一个“仍在确认”的演示状态，或继续有上限轮询。无论采用哪种，都不能自动退回 ready。

纯前端页面刷新会丢失内存中的 Promise，所以 pending operation 必须持久化。加载到 pending 时直接进入 reconciling 并重新调用 reconcile，不能显示 ready。

## 6. localStorage schema

键名：

```ts
const STORAGE_KEY = 'bula-checkin-demo:v2'
```

数据：

```ts
type ClaimedRecord = {
  status: 'claimed'
  requestId: string
  awardedCoins: 6
  balance: 440
  streak: 4
  claimedThrough: 4
  updatedAt: string // ISO timestamp
}

type PendingRecord = {
  status: 'pending'
  requestId: string
  baseBalance: 434
  baseStreak: 3
  baseClaimedThrough: 3
  createdAt: string // ISO timestamp
}

type CheckinStorageV2 = {
  version: 2
  records: Record<string, ClaimedRecord | PendingRecord>
}
```

示例：

```json
{
  "version": 2,
  "records": {
    "2026-09-04": {
      "status": "claimed",
      "requestId": "0ef0d54f-...",
      "awardedCoins": 6,
      "balance": 440,
      "streak": 4,
      "claimedThrough": 4,
      "updatedAt": "2026-09-04T10:03:12.153Z"
    }
  }
}
```

只恢复当前 `dayKey` 的记录。旧日期记录不应让今天显示已领取；可以保留用于调试，也可以在写入时仅保留最近 7 条。不得使用 UTC 日期直接 `toISOString().slice(0,10)` 作为本地“今天”，否则东八区午夜会错日。

```ts
function getLocalDayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

## 7. 读取、校验和写入顺序

### 加载

1. 页面以 `loading` 挂载并显示骨架。
2. `loadMockOverview()` 用 Promise 延迟约 200～350ms，读取 localStorage。
3. JSON 解析失败、version 不等于 2、字段类型/范围不合法：忽略坏记录并回到默认 ready；开发环境可 `console.warn`，用户界面不崩溃。
4. 当前日记录为 claimed：dispatch `LOAD_CLAIMED`。
5. 当前日记录为 pending：dispatch `LOAD_PENDING` 并启动 reconcile。
6. 无当前日记录：dispatch `LOAD_READY`。

### 提交

1. 同步生成 requestId 并写 pending。
2. dispatch submitting；余额/连签/claimedThrough 不变。
3. success：以同 requestId 把 pending 替换为 claimed，确认写入成功后 dispatch success。
4. error：仅删除 requestId 相同的 pending，dispatch error。
5. timeout：保留 pending，dispatch reconciling。

localStorage 写入失败（隐私模式、容量限制等）不应伪装成网络失败。演示页仍可在当前会话完成签到，但需 `console.warn`；此时无法保证刷新持久化。不要因写入失败执行第二次奖励。

## 8. 幂等与竞态合同

- UI：CTA 在 submitting/success/claimed/reconciling 为原生 `disabled`。
- handler：`inFlightRef` 在 dispatch 前同步置位，封住同一 event loop 的双击。
- reducer：只允许 ready/error → submitting；其余 phase 的 `SUBMIT` 返回原 state。
- async：响应 requestId 必须匹配当前 requestId。
- persistence：同一天 claimed 是终态；任何后到的 pending/error 不得覆盖 claimed。
- reconcile：只有明确 `not_claimed` 才能清 pending 和开放 retry。
- 成功：写入绝对结果，不能用读取到的 balance 再加 6。

可抽出以下写入守卫：

```ts
function savePending(dayKey: string, next: PendingRecord) {
  const current = readRecord(dayKey)
  if (current?.status === 'claimed') return false
  if (current?.status === 'pending') return false
  writeRecord(dayKey, next)
  return true
}
```

若 `savePending` 返回 false：claimed 时加载 claimed；pending 时加载 reconciling；不得继续调用 submit Promise。

## 9. UI 需要消费的派生字段

| phase | CTA 文案 | disabled | spinner | 辅助/错误文案 |
|---|---|---:|---:|---|
| loading | 不显示真实 CTA或显示 skeleton | 是 | 否 | 无 |
| ready | 签到领取 6 布拉币 | 否 | 否 | 无 |
| submitting | 签到中… | 是 | 是 | 无 |
| success | 签到成功，+6 | 是 | 否 | 成功 toast；余额旁 +6 |
| claimed | 今日已签到 | 是 | 否 | 明天签到可领 7 布拉币 |
| error | 重新签到 | 否 | 否 | 签到未完成，网络连接异常。请重试 |
| reconciling | 正在确认… | 是 | 可选小 spinner | 正在确认签到结果，请勿重复操作 |

## 10. 手动测试准备

控制台清除本 demo 数据：

```js
localStorage.removeItem('bula-checkin-demo:v2')
location.reload()
```

测试顺序建议：

1. `?mock=success`：清 storage，加载、双击、成功、刷新持久化。
2. 清 storage，`?mock=error`：确认无奖励、按钮可重试。
3. 清 storage，`?mock=timeout&reconcile=pending`：确认 reconciling 禁用；刷新仍 reconciling。
4. 清 storage，`?mock=timeout&reconcile=claimed`：确认 reconcile 后只奖励一次。
5. 清 storage，`?mock=timeout&reconcile=not_claimed`：确认明确失败后才可重试。

测试用 query 只控制 mock，不应在正常页面加入调试面板或改变既有视觉。

## 11. 未来真实后端的替换边界

未来接真实接口时，可保持 `CheckinRequest / CheckinSuccess / ReconcileResponse` 形状，将以下函数替换为 HTTP 实现：

- `loadMockOverview()` → `GET /api/checkin/overview`
- `mockSubmitCheckin()` → 带 idempotency key 的 `POST /api/checkin`
- `mockReconcileCheckin()` → `GET /api/checkin/operations/:requestId`

真实服务端必须按用户、业务日期和 idempotency key 保证幂等，客户端余额不能作为可信输入。本轮不得创建这些端点。

