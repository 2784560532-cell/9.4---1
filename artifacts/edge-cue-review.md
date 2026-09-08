# 奖励轨道边缘提示审查

## 结论

当前遮挡来自 `.reward-viewport::before/::after`：提示符宽 `14px`、字号 `17px`，并以 `left/right: -15px` 放在轨道边缘。尤其在 `360–379px` 断点中，`.checkin-body` 的横向内边距只有 `13px`，提示符盒子和字形会越过留白，视觉上压到第一张可见奖励卡。

最小修复是不改变轨道宽度、7 天数据、滚动位置或拖拽逻辑，只把箭头完整限制在 `.checkin-body` 的内边距留白中，并让实际滚动层位于提示层上方作为防护。不要给 `.reward-scroll` 增加覆盖卡片的渐变蒙层或 `mask-image`，否则仍会产生卡片被裁切/褪色的“Bug 感”。

## 建议 CSS

```css
.checkin-body {
  --reward-cue-gutter: 17px;
}

.reward-viewport::before,
.reward-viewport::after {
  z-index: 1;
  width: calc(var(--reward-cue-gutter) - 4px);
  overflow: hidden;
  color: #b85b7a;
  font-size: 14px;
  opacity: 0;
}

.reward-viewport::before {
  left: calc(-1 * var(--reward-cue-gutter));
}

.reward-viewport::after {
  right: calc(-1 * var(--reward-cue-gutter));
}

.reward-scroll {
  position: relative;
  z-index: 2;
}

@media (max-width: 359px) {
  .checkin-body { --reward-cue-gutter: 14px; }
}

@media (min-width: 360px) and (max-width: 379px) {
  .checkin-body { --reward-cue-gutter: 13px; }
}
```

`has-left` / `has-right` 的现有显隐规则保持不变，因此滚动到最左或最右时仍会正确隐藏对应方向提示。`pointer-events: none` 也应保留，避免提示符抢占拖拽或卡片点击。

## 影响范围

- 不修改 DOM 与 React 状态。
- 不改变 `.reward-scroll` 的 `overflow-x`、`scroll-snap-type` 或鼠标拖拽事件。
- 不改变 `.reward-rail`、奖励卡和进度线尺寸，六张完整卡的可视宽度不受影响。
- 仅把左右提示从卡片表面移入现有卡片内边距，消除覆盖感。

