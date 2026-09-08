# RewardDays 横向拖拽只读评审

## 结论

当前 `RewardDays` 已经采用正确的最小实现方向：

- 原生 `overflow-x: auto` 继续负责触摸滑动、触控惯性和滚动条语义；
- Pointer Events 仅在 `pointerType === "mouse"` 且鼠标主键按下时介入，因此不会覆盖手机原生滑动；
- 7 张卡片和进度线放在同一个 `.reward-rail` 内，所以拖动时不会错位；
- 拖动结束后只吸附到 `0` 或 `logicalMax`，与当前仅有“第 1～6 天”和“第 2～7 天”两个完整视窗一致，不会露出半张卡；
- 4px 位移阈值和 `onClickCapture` 能区分点击与拖拽，普通点击“今天”仍可签到；
- 没有绑定触摸 Pointer Move，也没有阻止键盘事件，现有触摸、按钮焦点与 ARIA 标签不会被鼠标拖拽替代。

因此无需改写为自制轮播，也不应使用全局 `mousedown/mousemove`、`touchmove preventDefault()` 或给卡片增加不可访问的拖拽层。

## 当前实现中建议补齐的两个边界

### 1. `pointercancel` 后可能误吞下一次点击

当前 `finishPointerDrag` 同时处理 `pointerup` 和 `pointercancel`。若鼠标拖动过程中触发 `pointercancel`，浏览器通常不会再派发本次 `click`，此时 `dragRef.current.moved` 会一直保留为 `true`，下一次正常点击卡片可能被 `onClickCapture` 误判为拖拽后的 click 而拦截。

最小修正：将“结束拖拽”和“仅拦截紧随 pointerup 的 click”分开。可以新增 `suppressClickRef`，只在 `pointerup && moved` 时置为 `true`，并用零延迟或短延迟定时器兜底清除；`pointercancel` 直接清理，不设置 click 抑制。

示意：

```tsx
const suppressClickRef = useRef(false)

const finishPointerDrag = (
  event: ReactPointerEvent<HTMLDivElement>,
  cancelled = false,
) => {
  const drag = dragRef.current
  const element = scrollRef.current
  if (!drag.active || drag.pointerId !== event.pointerId || !element) return

  const moved = drag.moved
  dragRef.current = {
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startScroll: 0,
  }
  setIsDragging(false)

  if (element.hasPointerCapture(event.pointerId)) {
    element.releasePointerCapture(event.pointerId)
  }

  if (moved && !cancelled) {
    suppressClickRef.current = true
    window.setTimeout(() => { suppressClickRef.current = false }, 0)
    const logicalMax = getLogicalMax(element)
    element.scrollTo({
      left: element.scrollLeft < logicalMax / 2 ? 0 : logicalMax,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }
}
```

绑定方式：

```tsx
onPointerUp={(event) => finishPointerDrag(event)}
onPointerCancel={(event) => finishPointerDrag(event, true)}
onClickCapture={(event) => {
  if (!suppressClickRef.current) return
  event.preventDefault()
  event.stopPropagation()
  suppressClickRef.current = false
}}
```

说明：若实际浏览器测试确认 `setTimeout(..., 0)` 早于合成 click，可改为 50ms；不要长期保留抑制标志。

### 2. 补充桌面拖拽的可见手势，同时避免图片原生拖影

目前鼠标可以拖动，但缺少 `grab/grabbing` 光标，卡片内 PNG 也可能触发浏览器原生图片拖拽。仅为精细鼠标设备增加以下 CSS 即可，不影响触摸：

```css
@media (hover: hover) and (pointer: fine) {
  .reward-scroll { cursor: grab; }
  .reward-scroll.is-dragging {
    cursor: grabbing;
    user-select: none;
  }

  .reward-scroll img {
    -webkit-user-drag: none;
    user-select: none;
  }
}
```

如需覆盖 Firefox 等环境，可同时在图片元素加 `draggable={false}`。这不应加到按钮或整个轨道的 ARIA 上，也不需要新增透明遮罩层。

## 可访问性约束

- 保留每张 `.reward-day` 为真实 `<button type="button">`；不要改成 `div` 或依赖拖动手势完成签到。
- 仅在鼠标左键启动拖拽；忽略触摸、笔、右键和辅助按钮。
- 不调用 `preventDefault()` 于 `pointerdown`；只有位移超过阈值、确认进入鼠标拖拽后，才在 `pointermove` 调用，保证简单点击和焦点行为不被破坏。
- 不拦截 `keydown`，保留 Tab 到可操作日期卡和 Enter/Space 激活。隐藏在视口外的可操作按钮获得焦点时，浏览器仍可将其滚入可见区域。
- 当前滚动容器已有准确 `aria-label`，子按钮也有完整“第 N 天 / 状态 / 奖励”标签。无需加 `role="slider"`、`aria-valuenow` 或 `aria-grabbed`；这不是数值滑块，也不是重排式拖放。
- 若希望滚动容器自身能用方向键滚动，可选增加 `tabIndex={0}` 与 `role="region"`，但会增加一个 Tab 停靠点。当前内容按钮本身可聚焦，因此这不是修复鼠标拖动的必要条件，建议本轮不加。
- `prefers-reduced-motion` 已用于拖拽结束吸附；继续保留 `auto` 回退。

## 建议验收

1. 桌面鼠标从卡片文字、勾选图标和硬币 PNG 上分别左右拖动，均能在两端完整吸附。
2. 位移小于 4px 的点击仍触发日期卡原行为；位移超过阈值后不会误签到。
3. 快速拖出窗口、Alt+Tab 或触发 `pointercancel` 后，下一次正常点击不被吞掉。
4. 手机触摸滑动仍有原生惯性；纵向页面滚动和横向奖励滑动互不锁死。
5. Tab、Shift+Tab、Enter、Space 行为不变，焦点环仍可见。
6. 375px 与 390px 下两个停止位都只出现 6 张完整卡，进度节点始终与卡片中心对齐。

## 不建议的方案

- 不要用 `touch-action: none` 或捕获所有 pointer 类型；会破坏手机滚动。
- 不要把 7 张卡复制成无限轮播；会产生重复朗读、重复焦点和任务状态问题。
- 不要用绝对定位单独移动进度线；应继续让卡片与进度线共享 `.reward-rail`。
- 不要在 pointerdown 时立刻屏蔽 click；用户在“今天”卡上的正常签到点击必须保留。
