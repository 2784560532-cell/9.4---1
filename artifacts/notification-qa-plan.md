# 通知交互浏览器验收计划

## Agent Handoff

- Owner: QA auditor
- Scope: 仅验收通知权限、签到提醒开关、通知任务奖励与持久化；不改视觉设计，不改签到状态机的其他部分
- Source changes: 无；本文件只定义测试场景、通过标准与证据要求
- Primary viewport: `390 × 844`
- Secondary viewport: `320 × 844`（确认通知改造未造成移动端溢出或任务错位）
- Entry point: `http://localhost:4173/`
- Storage namespace: `bula-notification-v1:<scenario>`；关联签到数据为 `bula-daily-checkin-v2:<scenario>`
- Validation to run: 默认截图态、未询问、授权并只到账一次、刷新、拒绝/去设置、已授权但关闭、重新开启不重发奖励、焦点同步撤权、唯一任务计数、顶部与任务同源、无真实浏览器权限请求
- Evidence required: 每个场景的 URL、关键 DOM 文案和 `aria-checked`、余额、通知任务数量、应用命名空间 localStorage 快照、控制台错误、必要截图
- P0 blockers: 重复通知任务；开关与任务状态矛盾；奖励重复到账；权限非 `granted` 时开关仍开启；调用真实 `Notification.requestPermission()`；刷新后状态回退或再次奖励

## 1. 隔离与参数约定

每个场景必须使用唯一 `scenario`，避免 localStorage 串场。推荐参数：

| 场景 | URL 参数 |
| --- | --- |
| 默认截图态 | `?scenario=notify-default-shot` |
| 尚未询问 | `?scenario=notify-unasked&notificationSeed=default` |
| 授权成功 | `?scenario=notify-grant&notificationSeed=default&permissionResult=granted` |
| 用户拒绝 | `?scenario=notify-deny&notificationSeed=default&permissionResult=denied` |
| 已授权但提醒关闭 | `?scenario=notify-granted-off&notificationSeed=granted-off` |
| 权限撤销 | `?scenario=notify-revoke&notificationSeed=granted-off&systemPermission=denied` |

参数语义建议固定为：

- `notificationSeed=default|denied|granted-off|granted-on`：仅在该 `scenario` 没有已保存通知状态时提供初始数据，不能覆盖已有持久化数据。
- `permissionResult=granted|denied`：只决定“继续开启”后的模拟权限请求结果。
- `systemPermission=default|granted|denied`：模拟页面重新进入或获得焦点时读取到的系统权限；不得读取或修改真实浏览器通知权限。
- `scenario=<unique-id>`：同时隔离通知和签到记录。QA 不使用无差别 `localStorage.clear()`，只删除本应用当前场景的两个精确键。

开始每个全新场景前，在页面控制台只执行：

```js
localStorage.removeItem('bula-notification-v1:<scenario>')
localStorage.removeItem('bula-daily-checkin-v2:<scenario>')
location.reload()
```

同一场景内验证刷新持久化时不得删键。截图和报告中不要输出其他站点或其他应用的 storage。

## 2. 通用观测项

每次页面稳定后记录：

1. 顶部开关 `role="switch"` 的数量必须为 1，`aria-checked` 与视觉开关一致。
2. 文本精确为“开启通知权限”的任务数量必须为 1；DOM 中也不得保留第二条被 CSS 隐藏的重复项。
3. 通知任务按钮文案、禁用状态与权限/领取状态一致。
4. 开关旁“每天 20:00”只在 `notificationPermission=granted && reminderEnabled=true` 时出现。
5. 余额变化与该场景 localStorage 中 `rewardCredited`、`balanceBonus` 一致。
6. console 无 uncaught error、React key warning、重复状态更新 warning。
7. Network 面板无通知权限相关 API 请求；网页原型只使用本地延时模拟。

可在控制台使用以下只读检查：

```js
({
  switches: document.querySelectorAll('[role="switch"]').length,
  switchChecked: document.querySelector('[role="switch"]')?.getAttribute('aria-checked'),
  notificationTasks: [...document.querySelectorAll('.task-item')]
    .filter((node) => node.textContent?.includes('开启通知权限')).length,
  notificationStore: JSON.parse(localStorage.getItem('bula-notification-v1:<scenario>') || 'null')
})
```

## 3. 验收场景

### N1 默认截图态

前置：清除 `notify-default-shot` 的两个精确键，打开默认截图态 URL。

步骤：等待页面 hydration 完成，不做操作。

预期：

- 权限为 `granted`，提醒为 `true`，任务领取为 `true`。
- 顶部开关开启，`aria-checked="true"`，旁边显示“每天 20:00”。
- “开启通知权限”只出现一次，按钮显示“已领取”且不可点击。
- 余额保持默认值；默认截图态视为奖励此前已到账，不能在本次首次加载时再增加 2。
- 页面不闪现“去开启”或关闭开关的错误中间态。

证据：390px 稳定态截图、DOM 计数、通知 storage 快照。

### N2 尚未询问权限

前置：全新 `notify-unasked` 场景。

预期初态：

- `notificationPermission=default`、`reminderEnabled=false`、`notificationTaskClaimed=false`、`rewardCredited=false`。
- 顶部开关关闭，`aria-checked="false"`，不显示“每天 20:00”。
- 唯一通知任务按钮为“去开启”，可点击。

分别从任务按钮和顶部开关验证入口（可使用两个不同的全新 scenario）：

1. 点击入口。
2. 出现轻量说明，正文精确包含“开启后，我们会在每天 20:00 提醒你签到，可随时关闭。”。
3. 操作按钮为“暂不开启”和“继续开启”。
4. 点击“暂不开启”：弹层关闭，开关仍关闭，任务仍为“去开启”，余额和 storage 奖励字段不变。

### N3 授权成功，奖励只到账一次

前置：全新 `notify-grant` 场景，记录余额 `B0`。

步骤：

1. 点击顶部开关或通知任务“去开启”。
2. 点击“继续开启”。
3. 在模拟请求进行中快速重复点击；确认不能启动第二次流程。
4. 等待模拟授权成功。

预期：

- 结果为 `granted / true / true / rewardCredited=true`。
- 开关开启并显示“每天 20:00”。
- 唯一通知任务变为“已领取”并禁用。
- toast 为“签到提醒已开启，每天 20:00 提醒你”。
- 余额从 `B0` 精确增加 2，仅变化一次。
- storage 中 `balanceBonus=2`，不存在重复奖励记录或累计为 4 的情况。

继续验证幂等：尝试重复点击已领取任务、快速关闭再开启提醒，余额始终为 `B0 + 2`。

### N4 刷新不重复任务、不重复奖励

前置：紧接 N3，不清 storage。

步骤：记录余额和通知 storage，刷新页面两次。

预期：

- 每次刷新后仍为 `granted / true / claimed`。
- 通知任务数量始终为 1，按钮始终“已领取”。
- 余额始终是 N3 成功后的值，不再增加 2。
- `rewardCredited=true` 与 `balanceBonus=2` 保持不变。
- hydration 前不闪现相反开关或可领取按钮。

### N5 用户拒绝与“去设置”

前置：全新 `notify-deny` 场景。

步骤：点击入口 → “继续开启” → 等待模拟拒绝。

预期：

- `notificationPermission=denied`、`reminderEnabled=false`。
- 顶部开关关闭，不能出现假开启状态，不显示“每天 20:00”。
- 通知任务按钮为“去设置”，奖励未领取，余额不变。
- toast 为“通知权限未开启，请前往系统设置授权”。
- 点击“去设置”只展示模拟设置说明，不跳转真实系统设置，不调用真实浏览器权限 API。
- 关闭设置说明后状态、余额不变。

### N6 已授权但关闭提醒，再打开不重发奖励

前置方式 A：完成 N3；方式 B：使用全新 `notify-granted-off` 初态。若用方式 B，先记录其奖励已到账基线。

步骤：

1. 在已授权且已领取状态下关闭顶部开关。
2. 记录余额，刷新一次。
3. 再点击开关重新开启提醒。

关闭后的预期：

- `notificationPermission=granted`、`reminderEnabled=false`、`notificationTaskClaimed=true`、`rewardCredited=true`。
- toast 为“签到提醒已关闭”。
- 通知任务仍“已领取”，不扣奖励；“每天 20:00”消失。
- 刷新后仍保持关闭。

重新开启后的预期：

- 因权限仍为 `granted`，提醒可直接恢复开启，无需再次模拟权限领取流程。
- toast 为“签到提醒已开启，每天 20:00 提醒你”。
- 通知任务仍“已领取”，余额与关闭前相同，不再增加 2。

### N7 权限被撤销，焦点同步且保持已领取

前置：先在 `notify-revoke` 场景形成 `granted / true / claimed / credited` 的持久化状态并记录余额。随后将模拟系统权限切换为 `denied`。推荐测试实现允许在不清 storage 的情况下用 `history.replaceState` 更新 `systemPermission=denied`，再触发真实的 blur/focus；若原型仅在 URL 读取参数，则用同一 `scenario` 加该参数重新进入页面后，再额外触发 focus。

步骤：

1. 页面移出焦点后重新聚焦（切换到另一浏览器标签再返回，优先于手动 dispatch 合成事件）。
2. 观察同步提示与 UI。
3. 刷新同一 URL。
4. 点击顶部开关或“去设置”入口。

预期：

- 自动变为 `notificationPermission=denied`、`reminderEnabled=false`。
- toast 为“通知权限已关闭”。
- 顶部开关关闭；不得在权限 denied 时重新打开为真。
- 奖励领取历史保留：`notificationTaskClaimed=true`、`rewardCredited=true`、`balanceBonus=2`。
- 通知任务继续显示“已领取”，余额不扣除，也不重新发放。
- 用户再次尝试开启时进入模拟设置引导，而不是直接假开启。
- 刷新后撤权状态仍一致。

### N8 顶部开关与任务同源一致性矩阵

依次检查下表，任何一行不一致均为 P0：

| Permission | Reminder | Claimed | 顶部 | 时间文案 | 任务按钮 |
| --- | --- | --- | --- | --- | --- |
| `default` | `false` | `false` | 关闭 | 无 | 去开启 |
| `granted` | `true` | `true` | 开启 | 每天 20:00 | 已领取 |
| `granted` | `false` | `true` | 关闭 | 无 | 已领取 |
| `denied` | `false` | `false` | 关闭 | 无 | 去设置 |
| `denied` | `false` | `true` | 关闭 | 无 | 已领取 |

额外不变量：不存在 `permission !== granted && reminderEnabled === true`；领取历史不能因关闭提醒或撤权回退。

### N9 无真实浏览器权限调用

在全新场景、页面业务脚本执行前，通过 DevTools Snippets 或自动化初始化脚本安装 spy：

```js
window.__realPermissionCalls = 0
if (window.Notification) {
  const original = Notification.requestPermission
  Notification.requestPermission = (...args) => {
    window.__realPermissionCalls += 1
    return Promise.reject(new Error('Real notification permission must not be called in prototype'))
  }
  window.__restoreNotificationPermission = () => { Notification.requestPermission = original }
}
```

执行 N2、N3、N5 的完整流程后，`window.__realPermissionCalls` 必须为 0，且浏览器不得出现真实通知授权提示。若浏览器属性不可改写，则使用 Playwright `page.addInitScript` 记录调用，或在 Sources 中对 `Notification.requestPermission` 设置断点；不能仅凭“没有看到弹窗”判定通过。

## 4. 移动端与视觉回归

在 N1、N3、N5 各至少检查一次 390px；在 N6 或 N7 检查 320px：

- 通知时间、开关与异形提醒区不重叠、不截断。
- “去开启 / 去设置 / 已领取”按钮不挤压任务标题，触控区域至少 44px 高。
- 弹层按钮可触控，正文不溢出手机宽度。
- 通知改造没有改变卡片圆角、主色、任务间距、角色素材和签到区域结构。
- 页面仍可纵向滚动，横向不出现整页滚动条。

截图建议：

1. `notification-default-390.png`
2. `notification-unasked-390.png`
3. `notification-granted-390.png`
4. `notification-denied-390.png`
5. `notification-granted-off-320.png`
6. `notification-revoked-390.png`

## 5. 最终通过门槛

- `npm run build` 成功。
- N1–N9 全部通过，P0 项为 0。
- 六类要求状态均有浏览器实测记录：尚未授权、授权成功、用户拒绝、已授权但关闭提醒、权限撤销、刷新。
- 所有场景中“开启通知权限”的 DOM 实例始终恰好为 1。
- 授权流程从任何入口触发时，最多只到账一次 `+2`；关闭、重新开启、撤权和刷新均不改变领取历史。
- 顶部开关与任务按钮始终由同一通知状态推导，无矛盾瞬间或稳定态。
- 真实 `Notification.requestPermission()` 调用次数为 0。
- console 无错误；报告附 URL、截图、storage 证据与每项结论。

