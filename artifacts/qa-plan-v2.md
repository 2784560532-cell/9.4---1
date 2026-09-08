# 签到交互改造 QA Plan v2

## Agent Handoff

- Role: qa-auditor
- Status: ready-for-execution
- Scope: 真实浏览器逐项验证新版签到状态机、7 天奖励、持久化、响应式尺寸、减弱动态效果、控制台与截图证据
- Files created: `artifacts/qa-plan-v2.md`
- Files changed: none
- Source changes: none；本计划不修改 `src/`
- Decisions: 以 390px 为主验收宽度，320px 为窄屏横滚验收宽度；成功、失败、超时三个场景使用相互隔离的 localStorage 初态；每轮均从页面真实 reload 开始
- Open questions: 第 6 天奖励值未确定，未配置时必须显示“待定”，测试不得替产品猜值
- Validation to run: `npm run build`；真实浏览器 390×844 与 320×844；success/error/timeout 三种 mock；刷新持久化；reduced-motion；console/localStorage 检查
- Evidence required: 成功态截图、失败态截图、320px 手机尺寸截图；关键 DOM 文案/尺寸记录；控制台结果；localStorage 快照
- Next agent: ui-implementer 完成后由 qa-auditor 执行本计划，再交 release

## 1. 测试目标与通过门槛

本轮只验收三类变化：统一签到状态、补齐 7 天奖励、签到操作反馈。页面原有布局、暖色渐变、卡片、角色、任务区和素材不应因改造发生无关变化。

所有 P0 用例必须通过，且浏览器控制台无 React error、未捕获异常、资源 404 或重复 key 警告。失败、超时场景不得修改余额、连续天数、日期领取状态或写入“今日已签到”持久化记录。

## 2. 测试环境与可测性约定

### 2.1 启动

1. 执行 `npm run build`，要求退出码为 0。
2. 启动 `npm run dev -- --host 0.0.0.0`，或使用已有的 `http://localhost:4173/`。
3. 用真实 Chromium 浏览器打开页面，不以 jsdom、静态 DOM 或构建成功替代浏览器验收。
4. 主视口设为 `390×844`、deviceScaleFactor 1；窄屏视口设为 `320×844`。
5. 页面缩放保持 100%，默认测试 `prefers-reduced-motion: no-preference`。

### 2.2 推荐的稳定测试钩子

实现应提供稳定、非视觉耦合的定位方式；推荐但不限于：

- 主按钮：`data-testid="checkin-button"`
- 奖励列表：`data-testid="reward-list"`
- 第 N 天：`data-testid="reward-day-N"`
- 骨架：`data-testid="reward-skeleton"`
- 余额：`data-testid="balance-value"`
- 连签：`data-testid="streak-value"`
- 状态提示：`data-testid="checkin-status-message"`
- toast：`role="status"` 或 `aria-live="polite"`

如果未加 test id，QA 可按可访问名称和文字定位，但不得依赖动态 class 哈希或颜色取样来判断业务状态。

### 2.3 Mock 结果切换

代码应保留明确的 `success | error | timeout` 切换方式。QA 优先使用实现提供的 URL 参数或开发模式选择器；若实现使用常量，则每次切换后重启开发服务并记录所用值。三种结果必须走同一个按钮和状态机，不能分别制作静态演示页。

推荐约定：`?checkinResult=success|error|timeout`。若使用 localStorage 配置项，配置项必须与签到业务数据分键，且不得被当作业务持久化结果。

### 2.4 localStorage 隔离策略

每个用例使用全新的页面上下文；若只能复用同一 tab，则按以下顺序复位：

1. 在清理前保存与本应用无关的键值快照。
2. 只删除本应用命名空间下的签到键，不执行无差别 `localStorage.clear()`。
3. 清除后 reload，等待 loading 完成，再开始操作。
4. 用例结束记录本应用相关键的键名和值；成功用例应有当日已签到记录，error/timeout 不应有 claimed 记录。
5. 用例之间再次只删除本应用键；测试完成后恢复测试前快照。

建议业务键带应用命名空间和本地日期，例如 `daily-checkin:claimed:YYYY-MM-DD`；日期按 `Asia/Shanghai` 的本地日历日计算。不要把 success、error、timeout 的 mock 开关与 claimed 数据放在同一个键里。QA 报告中记录实际键名，不打印与本应用无关的 storage 内容。

## 3. 初始数据基线

清除当日 claimed 数据后 reload，loading 结束时应稳定为：

| 项目 | 期望 |
| --- | --- |
| 余额 | `434` |
| 连续签到 | `3 天` |
| 第 1～3 天 | 勾选图标 + “已领” + 各自奖励，且不可领取 |
| 第 4 天 | “今天” + “可领 6” + 重点描边，可触发签到 |
| 第 5～7 天 | 锁图标 + “第 N 天” + 未来奖励 |
| 第 6 天 | 未配置时奖励显示“待定” |
| 主按钮 | “签到领取 6 布拉币” |

每个状态必须同时具有文字和图标，不能只凭粉色、灰色或描边判断。

## 4. P0 状态机用例

### QA-01 loading 不闪错态

前置：移除当日 claimed 数据，mock 结果设为 success；打开 DevTools 后禁用缓存，reload。

步骤与观察：

1. 从 reload 发起后立即观察奖励区。
2. loading 期间奖励区显示骨架屏，主 CTA 不可误触。
3. 在 loading 完成前连续观察按钮文字和奖励卡。
4. loading 完成后才展示 7 天真实奖励和 ready CTA。

通过标准：至少能观察到一帧骨架；全程不短暂出现旧版“立即签到”、错误的 claimed 状态或错误奖励；无 layout crash。若本机过快无法人工捕获，应临时使用 DevTools CPU slowdown 或实现已有的 mock loading delay，不改生产视觉。

### QA-02 ready：第 4 天为今天

前置：干净初态，390×844，success mock。

步骤：等待 loading 完成；逐个检查 7 个日期单元、余额、连签和主按钮。

通过标准：数据与第 3 节基线完全一致；第 4 天是唯一的“今天可领取”；第 1～3 天不能再次触发；第 5～7 天均为锁定状态；主按钮可点击且文案为“签到领取 6 布拉币”。

### QA-03 锁定日期反馈

前置：ready。

步骤：分别点击第 5、第 6、第 7 天的完整触控区域。

通过标准：每次只出现对应提示“连续签到至第 N 天可领取”；余额仍为 434、连签仍为 3、第 4 天仍为今天；第 6 天未配置时仍显示“待定”。

### QA-04 快速双击只提交一次

前置：ready，success mock；记录余额和 localStorage 初态。

步骤：在同一事件循环内对主按钮快速触发两次 click，或人工双击间隔小于 100ms；同时观察 CTA。

通过标准：第一次触发后 100ms 内进入 submitting；第二次点击不产生第二个请求/计时器；最终只出现一次成功反馈，余额只到 440，连签只到 4，第 4 天只领取一次；刷新后仍为 440/4，不出现 446/5。若实现提供请求计数日志，应为 1；没有计数日志时，以单次奖励和单条 claimed 记录为硬证据。

### QA-05 submitting 禁止重复点击且不提前记账

前置：ready，success mock。

步骤：单击 CTA；在 0～500ms 内多次点击 CTA、读取页面数值和按钮状态。

通过标准：100ms 内按钮显示小型 loading 和“签到中…”；按钮具备 disabled 或 `aria-disabled=true` 且不会响应；余额保持 434、连签保持 3、第 4 天仍显示今天可领；不能提前显示 `+6`。

### QA-06 success 原子更新

前置：承接 QA-05。

步骤：等待模拟请求在约 600～900ms 后完成，观察日期卡、进度线、余额、连签、按钮和 toast。

通过标准：

- 第 4 天变为勾选图标 + “已领” + `+6`，不可再次领取。
- 连签从 3 更新到 4。
- 余额从 434 更新到 440，旁边短暂出现 `+6`。
- 进度线完成部分延伸到第 4 天。
- CTA 短暂显示“签到成功，+6”，随后稳定为“今日已签到”。
- toast/页面提示为“签到成功，获得 6 布拉币”。
- claimed 稳定态显示辅助信息“明天签到可领 7 布拉币”（若产品实现为可选，QA 记录是否展示，不因此单独判 fail）。
- 支持 `navigator.vibrate` 时只请求一次轻量触觉反馈；不支持时静默跳过；全程不播放声音。

原子性要求：成功回调前业务数值不变；成功回调后相关视图在同一状态提交内一致，不允许出现“余额 440 但第 4 天仍可领”等长时间中间态。

### QA-07 claimed 刷新持久化

前置：QA-06 成功完成，不清理 storage。

步骤：记录应用签到键；reload；等待 loading 结束；再次点击 CTA 和第 4 天。

通过标准：刷新后保持余额 440、连签 4、第 4 天已领、CTA“今日已签到”；CTA 与第 4 天不可再次签到；点击不会再次增加奖励；localStorage 只有一份当日 claimed 结果。页面不能先稳定显示 ready 再跳 claimed。

### QA-08 error 不修改业务状态

前置：新上下文或只清除应用 claimed 键；mock 设为 error；reload 到 ready。

步骤：点击 CTA；确认 submitting；等待失败结果；记录页面与 storage；再点击“重新签到”一次验证可重试。

通过标准：失败后余额仍为 434、连签仍为 3、第 4 天仍是“今天/可领 6”；未写入 claimed；CTA 恢复可点击并显示“重新签到”；按钮下显示“签到未完成，网络连接异常。请重试”；错误提示为文字且可被读屏获取。重试每次仍必须经过 submitting，不能累积多次奖励。

截图：在 390×844 保存失败态，画面需同时包含 434、连续 3 天、第 4 天今天、重新签到按钮和完整错误文案。

### QA-09 timeout 进入 reconciling 且不开放重复操作

前置：新上下文或只清除应用 claimed 键；mock 设为 timeout；reload 到 ready。

步骤：点击 CTA；等待超过常规模拟请求时长进入 reconciling；在 reconciling 中连续点击按钮和第 4 天至少 3 次；观察 2 秒并检查 storage。

通过标准：CTA 显示“正在确认…”并持续禁止点击；提示“正在确认签到结果，请勿重复操作”；余额仍为 434、连签仍为 3、第 4 天未变已领；没有 claimed 写入；重复点击不创建新提交、不切回 ready/error。若实现随后有独立 reconciliation 结果，必须在结果明确后才进入 claimed 或 error；本用例至少应在未明确期间验证锁定状态。

## 5. P0 七天奖励与响应式用例

### QA-10 奖励序列完整

在 390px ready 初态逐项读取：

1. 第 1 天 `+1`
2. 第 2 天 `+1`
3. 第 3 天 `+5`
4. 第 4 天 `+6`
5. 第 5 天 `+7`
6. 第 6 天未配置时“待定”；若明确注入 `day6Reward`，显示该配置值
7. 第 7 天 `+8`

通过标准：7 个单元全部存在、顺序正确，无第 6 天缺失；标签不应错误跳过到“第七天”。

### QA-11 390px 优先完整显示

前置：390×844，ready。

步骤：记录奖励容器和 7 个单元的 `getBoundingClientRect()`；确认页面初始 `scrollLeft`。

通过标准：常规手机宽度下优先让 7 个日期完整可见；无文字相互覆盖；页面本身不存在水平滚动。若视觉约束确实需要奖励容器轻微横滚，必须至少自动让第 4 天完整可见，且横滚仅发生在奖励区域。

### QA-12 320px 横滚与自动定位今天

前置：320×844，清理 claimed 后 reload 到 ready。

步骤：不手动横滚，先检查第 4 天；再横向拖动奖励列表至两端；纵向滚动页面。

通过标准：第 4 天“今天”在初始可视区域且整个触控单元可识别；空间不足时奖励区域可横向滚动并能到达第 1 和第 7 天；横滚不会带动整页横向位移；纵向滚动正常；卡片、角色和任务区不被拉伸成桌面布局。

截图：保存 320×844 手机尺寸运行截图，必须能看到第 4 天今天；如 7 天不能同屏，另补一张滚到第 7 天的证据图。

### QA-13 44×44 触控尺寸

分别在 390px 和 320px 对 7 个日期单元执行 `getBoundingClientRect()`。

通过标准：每个日期单元实际可点击元素或其命中容器 `width >= 44` 且 `height >= 44` CSS px；不能只把内部图标做 44px 而外层点击目标更小。锁定项也需可点击以显示提示。

## 6. P1 动画、无障碍与视觉回归

### QA-14 默认动画节奏

使用浏览器 Performance 录制一次成功签到：按钮按下约 100～120ms 缩放到 0.98；日期卡状态过渡约 180～220ms；进度线约 220～280ms；余额 434→440 约 250～350ms；`+6` 只短暂出现。允许帧率造成小范围误差，但不能让动画延迟业务落账或阻碍后续滚动、关闭弹层等操作。

### QA-15 prefers-reduced-motion

在 DevTools Rendering 或浏览器自动化上下文中模拟 `prefers-reduced-motion: reduce`，reload 后完成一次 success 流程。

通过标准：`matchMedia('(prefers-reduced-motion: reduce)').matches === true`；按钮不缩放，余额/日期卡/进度线不做位移、弹跳或长时间补间；允许简短淡入或直接替换；状态、数值和 toast 与普通模式一致。

### QA-16 文字、图标与可访问状态

检查 7 个日期和 CTA：

- 已领取：勾选图标、文字“已领”、奖励数量三者同时存在。
- 今天：文字“今天”“可领 6”和重点描边同时存在。
- 待解锁：锁图标、“第 N 天”和未来奖励同时存在。
- submitting/reconciling/claimed 按钮均有明确文字，disabled 状态可由 DOM 属性或可访问状态识别。
- loading、toast、错误和确认提示使用合适的 live region，不要求用户只看颜色变化。

### QA-17 原页面视觉回归

在 390×844 将 ready 页面与改造前基准截图并排检查。顶部、余额区、IP 角色遮挡、签到大卡外形、右上提醒异形区、主渐变 CTA、每日任务卡、字体、颜色与圆角保持原风格。允许奖励区为容纳 7 天做必要的内部密度/横滚调整，不接受无关的重新排版或桌面化拉伸。

## 7. 控制台、资源与数据检查

每个 success/error/timeout 场景都执行：

1. reload 前清空 Console 输出。
2. 完整跑完场景后检查 error 与 warning。
3. Network 检查本地图片资源无 404；模拟 Promise 不应声称调用真实签到 API。
4. 检查 localStorage：success 只写一份当日 claimed；error/timeout 不写 claimed；刷新 claimed 不重复写奖励。
5. 不将浏览器扩展、favicon 等与应用无关的噪声归为应用缺陷，但报告中注明来源。

硬失败项：React runtime error、未捕获 Promise rejection、状态更新到卸载组件警告、资源 404、重复 key、一次用户操作产生多条 claimed 记录、console 中伪造真实 API 成功信息。

## 8. 截图与证据命名

建议统一写入 `.image2-ui/`：

- `v2-success-390.png`：成功完成后的 claimed 态，包含 440、连续 4 天、第 4 天已领、今日已签到。
- `v2-error-390.png`：error 态，包含 434、连续 3 天、第 4 天今天、重新签到和完整错误文案。
- `v2-mobile-320.png`：320×844 ready 态，证明今天自动可见、局部横滚和整体移动端布局。
- 可选 `v2-timeout-390.png`：reconciling 态，包含“正在确认…”及防重复提示。
- 可选 `v2-loading-390.png`：奖励骨架屏。

截图前需等待目标状态稳定，但 success 截图不得等到 claimed 数据被人为重置；error/timeout 截图不得与 success 共用未清理的 storage。

## 9. 最终验收矩阵

| 验收项 | 用例 | 优先级 |
| --- | --- | --- |
| loading 骨架且不闪错误 CTA | QA-01 | P0 |
| 连续 3 天时今天为第 4 天 | QA-02 | P0 |
| 1～7 天完整、day6 可配置/待定 | QA-10 | P0 |
| 快速连续点击只提交一次 | QA-04 | P0 |
| submitting 禁止重复且不提前加余额 | QA-05 | P0 |
| 成功后 440/4/第 4 天已领 | QA-06 | P0 |
| 刷新后保持今日已签到 | QA-07 | P0 |
| error 不增加余额且可重试 | QA-08 | P0 |
| timeout reconciling 不开放重复签到 | QA-09 | P0 |
| 待解锁点击只提示对应第 N 天 | QA-03 | P0 |
| 390 完整优先、320 局部横滚并定位今天 | QA-11/12 | P0 |
| 日期触控区域至少 44×44 | QA-13 | P0 |
| 所有状态有图标和文字 | QA-16 | P0 |
| reduced motion 不缩放/位移 | QA-15 | P1 |
| 动画节奏与同步反馈 | QA-14 | P1 |
| 原页面风格与布局无关部分不回归 | QA-17 | P1 |
| 控制台、资源、localStorage 干净 | 第 7 节 | P0 |

## 10. 执行后报告模板

QA 执行者应在新报告中填写：

- Build: pass/fail
- Browser/viewport: 版本、390×844、320×844
- Mock switch used: success/error/timeout 的实际切换方式
- Storage key used: 仅记录本应用键名和业务字段，不记录无关数据
- P0 result: `x/y passed`
- P1 result: `x/y passed`
- Double-click submission count/evidence
- Success final values: balance/streak/day4/button
- Error final values: balance/streak/day4/button/message
- Timeout final values: balance/streak/day4/button/message
- Reward geometry: 7 个单元数量、320/390 scrollWidth/clientWidth、最小命中尺寸
- Reduced motion result
- Console/network result
- Screenshot paths
- Open defects with severity and reproducible steps
- Next agent: release（仅在所有 P0 通过后）
