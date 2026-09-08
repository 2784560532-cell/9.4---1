# 每日签到交互改造 QA 计划（latest）

## Agent Handoff

- Role: qa-auditor
- Status: ready
- Scope: 仅定义本轮“提醒时间、通知权限与任务同源、7 天/单屏 6 天奖励、签到内存态、任务文案与完成态可读性”的构建和真实浏览器验收；不修改业务源码
- Files created: `artifacts/qa-plan-latest.md`
- Files changed: 无业务源文件变更
- Decisions: 以 `390×844` 为主视口、`375×812` 为复核视口；所有持久化测试用唯一 `scenario` 隔离；只允许清理精确的 `bula-notification-v2:<scenario>` 键；签到成功态通过 reload 验证必须回到未签到；通知设置通过 reload 验证必须保留
- Open questions: 当前实现没有可从 URL 进入“第 7 天为今天（streak=6）”的测试钩子，验收该项前需提供只影响内存初态的 `checkinSeed=day7`（或等价开发态入口）；邀请好友的成功条件、次数限制和到账规则待业务确认；当前无布拉币明细路由
- Validation run: 待实现完成后执行 `npm run build`（内含 `tsc --noEmit -p tsconfig.app.json` 与 Vite build）；项目无独立 `lint` 脚本，记录为 unavailable，不以未运行冒充通过；真实浏览器跑 375/390 两个手机视口、success/error/timeout、通知 default/granted/denied/granted-off/revoked、刷新与横滑
- Next agent: ui-implementer 完成后交 qa-auditor 执行本计划；全部 P0 通过后交 release

## 1. 仓库脚本与可测入口

### 1.1 现有脚本

| 检查 | 命令 | 结论 |
| --- | --- | --- |
| TypeScript + production build | `npm run build` | 已配置；实际执行 `tsc --noEmit -p tsconfig.app.json && vite build` |
| 单独 TypeScript | `npx tsc --noEmit -p tsconfig.app.json` | 可选复跑；与 build 前半段重复 |
| Lint | 无 | `package.json` 未配置 `lint`，不得声称 lint 通过 |
| Dev server | `npm run dev` | Vite，默认现有预览为 `http://localhost:4173/` |
| Preview | `npm run preview` | 用于 dist 产物复核；端口以实际输出为准 |

### 1.2 当前确认的查询参数

| 参数 | 值 | 用途 |
| --- | --- | --- |
| `mock` | `success \| error \| timeout` | 签到模拟结果；默认 success |
| `scenario` | 任意唯一短标识 | 隔离通知 localStorage 键 |
| `notificationSeed` | `default \| denied \| granted-off`，缺省为已授权且开启 | 仅当当前 scenario 尚无有效存储时提供通知初态 |
| `permissionResult` | `granted \| denied` | “继续开启”后的模拟权限结果；默认 granted |
| `systemPermission` | `default \| granted \| denied` | mount/focus 时模拟系统权限同步；不调用真实通知 API |

当前签到状态固定从 `streak=3`、第 4 天可领开始，且不写 localStorage。为验收“第 7 天为今天自动显示第 2～7 天”，实现应补一个仅开发/QA 使用且不持久化的状态入口，例如：

- `checkinSeed=day4`：默认 `streak=3`，第 4 天为今天。
- `checkinSeed=day7`：`streak=6`，第 7 天为今天。

若最终没有该入口，QA 只能判定第 7 天自动定位为“未验证”，不能用手工滚动到第 7 天代替。

## 2. 查询参数测试矩阵

每一行均使用全新的 `scenario`。测试开始前仅删除该行的精确通知键；同一行做刷新持久化时不得删除。

| ID | URL 参数 | 主目的 | 关键预期 |
| --- | --- | --- | --- |
| Q01 | `?mock=success&scenario=latest-default-390` | 默认截图态 + 第 4 天签到成功 | 通知已授权/已开启/任务已领取；签到 434→438、3→4、第 4 天已领 +4 |
| Q02 | `?mock=error&scenario=latest-error-390` | 签到失败 | 余额/连签/第 4 天不变；“重新签到”及明确错误文案 |
| Q03 | `?mock=timeout&scenario=latest-timeout-390` | reconciling 防重复 | “正在确认…”期间禁用；无提前记账；明确后才允许重试 |
| Q04 | `?scenario=latest-notify-default&notificationSeed=default&permissionResult=granted` | 未授权→授权成功 | 同一授权流程；提醒开；任务已领取；只发一次 +2；434→436 |
| Q05 | `?scenario=latest-notify-denied&notificationSeed=default&permissionResult=denied` | 用户拒绝 | 开关关；唯一任务“去设置”；不发奖励 |
| Q06 | `?scenario=latest-notify-off&notificationSeed=granted-off` | 已授权但关闭 | 开关关；任务仍“已领取”；改时间不改变开关 |
| Q07 | `?scenario=latest-notify-revoke`，先形成 granted/claimed，再同 scenario 加 `&systemPermission=denied` | 权限撤销 | 自动关闭开关；领取历史与 +2 不回退、不重发 |
| Q08 | `?scenario=latest-time-picker&notificationSeed=granted-off` | 时间取消/保存/刷新 | 默认 20:00；取消不变；保存 21:30 后仍关闭；刷新保持 21:30 |
| Q09 | `?scenario=latest-day4-375&checkinSeed=day4` | 375px 单屏 6 天 | 1～6 完整，第 7 天完全不可见但有右侧提示；左滑后第 7 天完整出现 |
| Q10 | `?scenario=latest-day7-390&checkinSeed=day7` | 第 7 天为今天自动定位 | 首帧稳定后显示第 2～7 天且第 7 天完整可见；卡片和进度线同步偏移 |

注：Q09/Q10 的 `checkinSeed` 是待补可测性约定；若实现采用其他参数名，报告记录实际名称即可，语义必须等价。

## 3. 构建、类型与静态检查

1. 执行 `npm run build`，要求退出码 0，无 TypeScript error、Vite resolve error 或资源引用失败。
2. 如需区分故障，单独执行 `npx tsc --noEmit -p tsconfig.app.json`；结果应与 build 前半段一致。
3. 运行 `npm run` 并在 QA 报告中明确：项目没有 lint 脚本，lint 为 `not configured`，不是 pass。
4. 使用 `rg` 静态确认：
   - 奖励唯一来源为 `const rewards = [1, 2, 3, 4, 5, 6, 7]`；第 4 天按钮、toast、余额增量、明日奖励均从数组或其派生常量读取。
   - 任务数据中“开启通知权限”只存在一个数据项；不得存在第二条后用 CSS/文字过滤隐藏。
   - 签到成功不调用 `localStorage.setItem`；通知配置只写应用命名空间键。
   - 代码不调用 `Notification.requestPermission()`，不声称已接入真实 iOS 通知。
   - 页面浏览说明为“浏览首页15秒，领取2布拉币”，视频说明为“看完广告，领取2布拉币”。
5. 检查最终 dist 加载，无本地图片 404、无远程替换素材、无新增依赖。

## 4. 真实浏览器公共设置

1. 使用 Chromium 真浏览器；先设 `390×844`、缩放 100%、`deviceScaleFactor=1`，再设 `375×812` 复核。
2. 每个场景 reload 后等待 loading 完成；记录 console error/warning，并确认页面根元素 `scrollWidth <= clientWidth`。
3. 只清理精确键：`localStorage.removeItem('bula-notification-v2:<scenario>')`。禁止 `localStorage.clear()`。
4. 观察通知 storage 时只读该应用键；不输出或修改其他应用存储。
5. 建议证据截图写入 `screenshots/`：`latest-success-390.png`、`latest-error-390.png`、`latest-time-375.png`、`latest-day6-375.png`、`latest-day7-390.png`。
6. 浏览器检查结束后恢复原视口，避免影响后续人工预览。

## 5. 提醒开关与时间选择器（P0）

### T01 两个独立热区

在 granted/on 与 granted/off 两种状态检查：

- 页面同时显示“签到提醒”、开关，以及“每天 20:00 ›”。
- 开关命中元素与时间入口各自 `getBoundingClientRect()` 的宽高或命中容器均不小于 `44×44 CSS px`。
- 点击时间入口只打开底部时间选择器，`aria-checked` 不变化；点击开关不打开时间选择器。
- 底部面板从移动端底部出现，包含“取消”“保存”，无遮挡、无横向溢出。

### T02 取消与保存

1. 记录初始 `20:00` 与开关状态。
2. 打开时间选择器，改草稿为 `21:30`，点“取消”。
3. 再次打开，确认仍为 `20:00`。
4. 改为 `21:30`，点“保存”。

预期：页面显示“每天 21:30 ›”；toast 精确为“提醒时间已更新为21:30”；开关状态在取消和保存前后均不变化。

### T03 开启/关闭时改时间

- granted/on：保存新时间后提醒保持开启，提示与页面均使用新时间。
- granted/off：保存新时间后提醒保持关闭，仅保存时间；通知任务保持“已领取”。
- reload：时间和开关状态均恢复；不出现旧时间闪回后的稳定错态。

## 6. 通知权限、任务与一次性奖励（P0）

### N01 未授权同源入口

使用 Q04 清洁初态。顶部开关关闭，唯一通知任务为“去开启”。分别用两个 scenario 从顶部开关和任务按钮触发，均打开相同说明流程，且继续前不改变余额、权限、开关或任务。

### N02 授权成功和防重复

点击“继续开启”后快速连点；只允许一次模拟请求。成功后：

- `notificationPermission=granted`、`reminderEnabled=true`、`notificationTaskClaimed=true`。
- 开关开启；唯一任务显示勾选图标 + “已领取”且禁用。
- 余额只从 434 到 436；刷新、关闭再开启、再次聚焦均不再 +2。
- toast 使用已保存时间，例如“签到提醒已开启，每天 21:30 提醒你”。

### N03 拒绝与设置说明

使用 Q05：授权模拟返回 denied 后开关必须关闭，任务按钮“去设置”，余额不变。点击“去设置”只展示网页原型设置说明，不拉起真实权限、不把开关先设为真。

### N04 已授权后关闭

使用 Q06 或承接 N02：关闭开关后权限仍 granted、任务仍“已领取”、奖励不扣除；时间入口仍可用。再次开启无需重新领奖，余额不变。

### N05 权限撤销和刷新

同一 scenario 先形成 granted/on/claimed/credited，再加 `systemPermission=denied` reload 或切标签触发真实 focus。预期自动关闭开关并提示“通知权限已关闭”；任务领取历史和通知奖励余额保留。刷新继续一致。

### N06 唯一任务与完成态可读性

- DOM 中包含“开启通知权限”的 `.task-item` 数量恒为 1，不仅视觉上为 1。
- 已领取按钮具备 `disabled`，并同时展示勾选图标和“已领取”。
- 通过 computed style/人工目检确认已领取与辅助说明在白/浅灰背景上清晰可读；若自动对比度可测，普通说明文字目标至少 4.5:1，大号或粗体按 WCAG 对应门槛。

## 7. 七天奖励、单屏六天与同轨进度（P0）

### R01 数据与状态

默认 ready 稳定态必须为：余额 434、连续 3 天、奖励依次 +1～+7；第 1～3 天为勾选 + “已领 +N”，第 4 天为“今天/可领 +4”，第 5～7 天为锁图标 + 第 N 天 + 奖励；主按钮“签到领取4布拉币”。

### R02 390/375 首屏只完整显示六张

在两个视口分别读取奖励 viewport、7 个卡片的矩形：

- 第 1～6 张全部完整落在 viewport 左右边界内。
- 第 7 张与 viewport 初始可视矩形无交集；不能露出半张、边框或文字。
- `scrollWidth > clientWidth`；右侧有渐隐、阴影或轻量方向提示。
- 字号与卡片内容不因塞 7 张而缩小；7 张触控区域均至少 `44×44px`。
- 整页无横向滚动，横滚只发生在奖励 viewport。

### R03 吸附、隐藏滚动条、卡线同轨

左滑到末端后：第 7 张完整可见，落点吸附稳定；浏览器系统滚动条不可见。比较第 N 张卡片中心与第 N 个进度节点中心，误差应在 1 CSS px 左右；滑动前后误差不增加。DOM 上卡片网格和进度线应位于同一可滚动 rail 内。

### R04 第 7 天为今天自动定位

使用 Q10。无需手动滑动，loading 结束后滚动位置应落到末端，完整显示第 2～7 天；第 7 天带“今天/可领 +7”，同轨进度同步移动。`prefers-reduced-motion: reduce` 下使用直接定位，不做平滑位移。

## 8. 签到状态机与刷新（P0）

### C01 loading/ready

reload 后奖励区域先显示骨架，不闪旧版或错误 CTA；约 420ms 后 ready。ready 时第 4 天可领 +4，按钮“签到领取4布拉币”。

### C02 快速连点与 submitting

对主 CTA 在 100ms 内双击/多击。按钮应在 100ms 内显示 spinner + “签到中…”并禁用；余额仍 434、连签仍 3、第 4 天仍未领取；请求只创建一次。

### C03 success 原子更新

使用 Q01，约 600～900ms 后：

- 余额 434→438，旁边短暂 +4。
- 连续签到 3→4。
- 第 4 天变成勾选 + “已领 +4”。
- 按钮短暂“签到成功，+4”，最终“今日已签到”。
- toast “签到成功，获得4布拉币”。
- 辅助文案“明天签到可领5布拉币”。

所有数字均与 rewards[3] / rewards[4] 一致，不允许某一处残留 6 或 7。

### C04 error

使用 Q02：失败后余额 434、连签 3、第 4 天 today 状态不变；按钮“重新签到”；错误提示清晰且为可访问文字。再次点击必须重新经过 submitting。

### C05 timeout/reconciling

使用 Q03：超时后按钮“正在确认…”且禁用，提示“正在确认签到结果，请勿重复操作”；在结果未明确前连点不能创建新提交或记账。当前实现若 2.2s 后转 error，须确认转入 error 后才重新开放。

### C06 刷新只重置签到

承接 C03，不清任何 storage，直接 reload：

- 签到回到余额基础值 434、连续 3 天、第 4 天可领、按钮“签到领取4布拉币”。
- 若该 scenario 曾领取通知 +2，则刷新后的可见余额应为 436（基础 434 + 持久化通知奖励 2），而不是 440；通知时间/权限/开关/任务领取历史全部保留。
- localStorage 中不得出现签到 claimed 记录；不得清除通知键或其他业务键。

## 9. 任务文案、业务边界与视觉回归

1. 页面浏览描述精确为“浏览首页15秒，领取2布拉币”；视频广告描述为“看完广告，领取2布拉币”；左侧奖励仍为 +2 布拉币。
2. 已领取按钮同时有勾选图标和文字；辅助说明比旧版浅灰更易读，同时仍保持禁用外观。
3. 邀请好友弹窗只能展示项目已有的泛化信息，不能出现未经数据支持的次数、到账时长或具体奖励数字。
4. 点击“布拉币 >”：若无既有路由，不得跳转到伪造资产页；记录当前无明细路由，不判定为本轮新增缺陷。
5. 与基准视觉对比：顶部渐变、IP 角色/星星/硬币现有素材、卡片圆角、粉色 CTA、任务布局均无无关重构。

## 10. 两轮视觉调整约束

- 第 1 轮：先修阻断项——整页横向溢出、半张第 7 天、卡线错位、提醒热区误触、文字截断/遮挡、console error。
- 第 2 轮：修非阻断但明显的间距、渐隐提示、已领取对比度和底部 sheet 视觉偏差。
- 两轮后停止截图迭代；仍存在的非阻断偏差写入 QA 报告的 known differences，不继续无限调整。

## 11. 最终报告通过门槛

- `npm run build`: pass；单独 typecheck 如执行则 pass；lint 明确为 not configured。
- 375×812 与 390×844 均无整页横向溢出、文字截断或素材遮挡。
- 通知任务 DOM 数量始终为 1；开关、权限、时间、领取状态与余额同源且刷新一致。
- 时间取消/保存、开关独立、通知一次性 +2 全部通过。
- 7 天数据完整；首屏恰好 6 张完整卡；第 7 天可横滑；第 7 天 today 自动定位有真实证据。
- 签到 success/error/timeout、防双击与刷新重置全部通过。
- console 无应用错误、React warning、资源 404；未调用真实通知权限 API。
- 若第 7 天 today 缺少可测入口或未验证，P0 不得标为全通过。

