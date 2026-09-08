# 375–390px 响应式与可访问性交接

## 结论

当前源码尚不能满足本轮验收：375px 时奖励滚动口约为 `317px`，390px 时约为 `324px`，但 `.reward-grid-v2` / `.progress-track` 的最小宽度仅为 `317px`，因此七张卡会一起挤进单屏；`scrollIntoView({ inline: 'center' })` 还会在第 4 天为今天时把轨道居中偏移。提醒开关实际只有 `34×21px`，时间文本不是独立按钮，也没有底部时间选择器。

以下建议不要求更换素材或重做视觉，只调整 DOM 归属、滚动几何和热区。

## 关键发现（按优先级）

### P0 — 奖励卡与进度线需要一个共同的内容轨道

- 当前 `App.tsx:214-220` 中卡片网格和进度线虽同处 `.reward-scroll`，但没有共同的定宽父轨道；两者各自依赖 `min-width: 317px`。
- 当前 `styles.css:155,169` 的 `repeat(7, minmax(44px, 1fr))` 会让七列平均分配滚动口，375–390px 下不会形成可滑动的第 7 天。
- 推荐 DOM：

```tsx
<div className="reward-rail-shell" data-at-end={atEnd}>
  <div ref={scrollRef} className="reward-scroll">
    <div className="reward-track">
      <div className="reward-grid-v2">{/* 7 cards */}</div>
      <div className="progress-track">{/* fill + 7 nodes */}</div>
    </div>
  </div>
  {!atEnd && <span className="reward-more-cue" aria-hidden="true" />}
</div>
```

- `.reward-track` 是唯一横向内容盒；卡片网格和进度线宽度都由它控制，不能把进度线放到 `.reward-scroll` 外。
- 建议几何参数：`--reward-gap: 5px`。375px 下滚动口约 `317px`，每卡 `(317 - 5×5) / 6 = 48.67px`；390px 下约 `324px`，每卡 `49.83px`。两者均不缩字体且大于 44px。
- 可用容器查询单位避免 JS 测宽：

```css
.reward-scroll {
  container-type: inline-size;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-inline: contain;
}

.reward-track {
  --reward-gap: 5px;
  width: max-content;
}

.reward-grid-v2,
.progress-track {
  width: max-content;
  display: grid;
  grid-template-columns: repeat(7, calc((100cqw - 5 * var(--reward-gap)) / 6));
  column-gap: var(--reward-gap);
}

.reward-day {
  min-width: 44px;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

- 若不采用 `cqw`，请用 `ResizeObserver` 把 `scrollRef.current.clientWidth` 写入 CSS 变量 `--reward-viewport`，列宽仍按 `(viewport - 5×gap)/6` 计算；不要退回固定 `317px`。
- 骨架屏必须复用同一 `.reward-track` 和相同列宽，否则加载完成时会发生明显横跳。
- 右侧提示应放在 `.reward-scroll` 外层的 `.reward-rail-shell` 上，`pointer-events: none`；建议 10–14px 的内阴影/渐隐和一个很轻的右向提示。不要给滚动口增加右 padding，否则默认会露出半张第 7 天。
- `atEnd` 可由 `scrollLeft + clientWidth >= scrollWidth - 1` 计算，到末端隐藏提示。

### P0 — 初始定位逻辑不能再居中第 4 天

- 当前 `App.tsx:204-212` 对硬编码第 4 天执行 `scrollIntoView({ inline: 'center' })`，会破坏“第 1–6 天为默认页”。
- 改为持有滚动容器 ref，并以“今天是第几天”计算：

```ts
const targetLeft = todayDay === 7
  ? scrollEl.scrollWidth - scrollEl.clientWidth
  : 0
scrollEl.scrollTo({ left: targetLeft, behavior: 'auto' })
```

- 首次定位使用 `auto`，不要 `smooth`；否则进入页面时第 7 天会先不可见再滑入。窗口尺寸变化后重算一次。
- 今天为 1–6 天始终 `left = 0`；今天为 7 天始终滚到最右，恰好显示第 2–7 天。

### P0 — 提醒开关与时间必须是两个独立的 44px 热区

- 当前 `Switch` (`App.tsx:189-190`) 的按钮本体就是视觉轨道，CSS 为 `34×21px` (`styles.css:147`)；不满足 44×44px。
- 保留 34×21px 粉色视觉轨道，但把 button 扩为 44×44px。推荐让 `button.switch` 透明，使用 `::before` 画轨道，`span` 画滑块：

```css
.switch {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
}
.switch::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 11.5px;
  width: 34px;
  height: 21px;
  border-radius: 999px;
  background: #ddd;
}
.switch.is-on::before { background: #ffbfd4; }
.switch span { left: 8px; top: 14.5px; }
.switch.is-on span { transform: translateX(13px); }
```

- 提醒区 DOM 不要给整个 notch 绑定 click；改为两个 sibling buttons：

```tsx
<div className="reminder-notch">
  <div className="reminder-toggle-row">
    <span>签到提醒</span>
    <Switch checked={reminderEnabled} onChange={onToggleReminder} />
  </div>
  <button type="button" className="reminder-time" onClick={onOpenTimePicker}>
    <span>每天 {reminderTime}</span>
    <UiIcon name="next" size={14} aria-hidden="true" />
  </button>
</div>
```

- `reminder-time` 需 `min-width: 44px; min-height: 44px`，并设置明确的 `aria-label={`修改签到提醒时间，当前每天 ${reminderTime}`}`。
- 两个按钮的边界不要覆盖：若保留斜切 notch，建议把 notch 高度增加到约 88px，第一行 44px、第二行 44px；相应将 `.checkin-heading` 高度调整为 88px。不要用负 margin 把两行热区压叠。
- 时间入口始终显示；提醒关闭时也不得隐藏或禁用，因为“关闭时只保存时间”。
- 开关的 `aria-label` 应根据状态表达动作，例如开启时为“关闭签到提醒”，关闭时为“开启签到提醒”；`role=switch` 和 `aria-checked` 继续保留。

### P1 — 移动端底部时间选择器

- 现有 `Modal` 是居中弹窗，没有 bottom sheet。新增独立 `TimePickerSheet`，不要把普通 `.modal` 强行改到底部，避免影响规则/邀请/授权弹窗。
- 推荐 DOM：

```tsx
<div className="time-sheet-backdrop" onMouseDown={onBackdrop}>
  <section
    className="time-sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="time-sheet-title"
    onMouseDown={(event) => event.stopPropagation()}
  >
    <header>
      <button type="button" onClick={onCancel}>取消</button>
      <h2 id="time-sheet-title">提醒时间</h2>
      <button type="button" onClick={onSave}>保存</button>
    </header>
    <label>
      <span className="sr-only">每天提醒时间</span>
      <input type="time" step="60" value={draftTime} onChange={...} />
    </label>
  </section>
</div>
```

- 打开时把已保存的 `reminderTime` 复制到 `draftTime`；取消只关闭；保存才提交 `draftTime`。不要让 input 的 `onChange` 直接写入持久状态。
- sheet 建议固定在手机页面底部：

```css
.time-sheet-backdrop {
  position: fixed;
  z-index: 40;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(16, 7, 10, .34);
}
.time-sheet {
  width: min(390px, 100%);
  padding: 0 18px max(18px, env(safe-area-inset-bottom));
  border-radius: 24px 24px 0 0;
  background: #fff;
}
.time-sheet header {
  min-height: 56px;
  display: grid;
  grid-template-columns: 64px 1fr 64px;
  align-items: center;
}
.time-sheet header button { min-width: 44px; min-height: 44px; }
.time-sheet input[type='time'] {
  width: 100%;
  min-height: 56px;
  font-size: 28px;
  text-align: center;
}
```

- 需要：打开后聚焦时间 input；Escape 等同取消；关闭后将焦点恢复到 `.reminder-time`；弹层打开时锁定背景滚动。若选择原生 `input[type=time]`，文案中明确这是网页原型，不宣称真实 iOS 系统选择器。

### P1 — 完成态和辅助文案对比度

- 当前 `.task-copy p` 的 `#999698` 对白色约 `2.93:1`，`.task-action.claimed` 的 `#d0cecf` 对 `#f7f7f7` 约 `1.46:1`，都过低。
- 建议 `.task-copy p { color: #6f696c; }`，对白色约 `5.37:1`。
- 建议完成 pill 使用文字 `#686366`、底色 `#f3f1f2`，对比约 `5.24:1`；奖励锁定文字可同样改为 `#6f696c`（对 `#f2f2f2` 约 `4.79:1`）。仍可保持灰色禁用观感。
- `TaskItem` 的已领取按钮需加入代码图标：

```tsx
{task.claimed ? <><UiIcon name="check" size={14} aria-hidden="true" /><span>已领取</span></> : task.action}
```

- 当前 `.task-action` 高度 34px。为保持现有 34px 胶囊外观，可让按钮本体 `height: 44px; background: transparent; position: relative`，用 `::before { inset-block: 5px; ... }` 画 34px 胶囊；文字和勾选图标置于伪元素上方。
- `.checkin-feedback` 当前 11px 可保留视觉尺寸，但颜色应至少使用 `#7a4355` 一类深色，错误态 `#b72f53`；不要用 opacity 降低整行。

### P2 — 其它语义与布局细节

- `.reward-scroll` 应有清晰 accessible name，并可选 `tabIndex={0}`；键盘焦点进入第 7 天按钮时浏览器会把它带入可视区。
- 日期卡本体已高 70px、最小宽 44px；保留真实 button，不要用 `div` + click。
- `.reward-more-cue` 必须 `aria-hidden="true"`，方向提示不能成为多余 tab stop。
- 任务描述不要继续 `white-space: nowrap` + 静默截断关键奖励文案。375px 下“浏览首页15秒，领取2布拉币”可通过把右侧操作按钮视觉宽保持 64px、任务列 `minmax(0,1fr)` 来容纳；若仍不足，描述允许两行而不是省略业务金额：`white-space: normal; display: -webkit-box; -webkit-line-clamp: 2`。
- 320–359px 时，六张 44px 卡加间距可能超过当前滚动口；不要把卡缩到 44px 以下，可允许这一档显示少于六张。用户本轮明确的“六张完整卡”验收宽度是 375–390px。

## 建议验证点

1. 375px：第 1–6 天完整可见，第 7 天完全不露边；水平滑到底后第 2–7 天完整可见。
2. 390px：重复上述验证，进度节点始终落在对应卡中心线。
3. 今天第 4 天：首次渲染 `scrollLeft === 0`；今天第 7 天：首次渲染 `scrollLeft === scrollWidth - clientWidth`（容许 1px 取整误差）。
4. 开关、时间入口、取消、保存的 DOM `getBoundingClientRect()` 均至少 44×44px，且开关与时间入口矩形不相交。
5. 修改时间后开关 `aria-checked` 不变；取消后页面时间不变。
6. 键盘可聚焦时间入口，Enter 打开，Escape 关闭并恢复焦点；焦点不落到遮罩后的页面。
7. 完成任务显示勾选图标与“已领取”，禁用但文本清晰；锁定日期也有锁图标与可读奖励。

## Agent Handoff
- Role: visual/accessibility specialist
- Status: complete
- Scope: 只读检查 `src/App.tsx` 与 `src/styles.css`；针对 375–390px 六卡轨道、进度线同轨、44px 热区、完成态可读性和底部时间选择器提出实现建议。
- Files created: `artifacts/responsive-audit-latest.md`
- Files changed: 无源代码变更。
- Decisions: 六卡列宽按滚动口动态计算；卡与进度线共享一个定宽内容轨；第 4 天不居中，第 7 天才滚到最右；开关视觉尺寸与点击热区分离；时间选择器使用独立 bottom sheet 与草稿值。
- Open questions: 分钟选择是否允许任意分钟或只允许固定步长，当前业务未定义；建议 `step="60"` 先允许任意分钟。
- Validation run: 静态源码审查；按 375px/390px 当前 padding 计算滚动口与六卡列宽；使用 WCAG 相对亮度公式核算建议色对比度。未运行浏览器截图或修改实现。
- Next agent: ui-implementer（按本建议落地后交 accessibility / qa-auditor 做浏览器验证）。
