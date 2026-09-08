# Reward rail / reminder / balance visual audit

## Findings and exact implementation guidance

### 1. Seven-day rail: keep the current six-card geometry

- `src/styles.css:159-160` already uses the correct geometry for seven equal columns while exposing exactly six cards:
  - rail width: `calc(116.666667% + .667px)`
  - seven columns, `4px` gap
- The `.667px` term is important. With six visible cards and five visible gaps, it compensates for the sixth off-screen gap and makes the viewport end exactly after card 6. Do not replace this with a guessed width or shrink the type.
- Keep `.reward-grid-v2` and `.progress-track` inside the same `.reward-rail`; this is what guarantees the nodes remain centered under their cards.
- At 375/390px, validate these two exact positions:
  - `scrollLeft = 0`: only days 1–6 are fully visible.
  - `scrollLeft = scrollWidth - clientWidth`: only days 2–7 are fully visible.
  No edge of the seventh/first card should be visible at the opposite boundary.
- `min-width: 332px` is safe for the requested 375–390px viewport but becomes wider than the reward viewport below roughly 360px. Preserve it only if 320px support is still required to prioritize 44px targets; page-level overflow remains clipped by `.phone-shell`.

### 2. Connect the new left/right scroll states to visuals

`src/App.tsx:174+` now emits `has-left` and `has-right`, but the stylesheet still listens to the obsolete `.has-more` class. Replace the one-sided rules with symmetric overlays:

```css
.reward-viewport::before,
.reward-viewport::after {
  content: '';
  position: absolute;
  z-index: 5;
  top: 0;
  width: 24px;
  height: 91px; /* reward card + progress rail */
  pointer-events: none;
  opacity: 0;
  transition: opacity .18s ease;
}
.reward-viewport::before {
  left: -1px;
  background: linear-gradient(90deg, rgba(255,255,255,.98), rgba(255,255,255,0));
  box-shadow: -8px 0 13px rgba(91,47,60,.10);
}
.reward-viewport::after {
  right: -1px;
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.98));
  box-shadow: 8px 0 13px rgba(91,47,60,.10);
}
.reward-viewport.has-left::before,
.reward-viewport.has-right::after { opacity: 1; }
```

- This yields the requested default state for day 7: left affordance visible, right affordance hidden.
- A small code-rendered chevron may be added inside the fades, but the gradient alone is sufficient and less visually disruptive. If added, it must be `aria-hidden="true"` and `pointer-events:none`.
- Keep `updateScrollState()` as the source of truth and also call it after initial programmatic scrolling and on resize/orientation change. Do not infer the fade from the current day alone.
- The skeleton should use the right affordance only, or no affordance; it must not display a stale left hint before the real rail is positioned.

### 3. First-entry swipe hint

- The current `sessionStorage` choice is appropriate for “首次进入显示一次”: once per tab/session without coupling it to persisted reminder state.
- Position the hint above the rail without changing layout and without intercepting gestures:

```css
.swipe-hint {
  position: absolute;
  z-index: 7;
  left: 50%;
  top: 40px;
  transform: translate(-50%, -50%);
  max-width: calc(100% - 40px);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(50, 28, 35, .82);
  color: #fff;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  pointer-events: none;
  animation: swipe-hint-in .18s ease-out;
}
```

- Hide immediately after the first user scroll/pointer interaction rather than waiting the full 2.6s; this prevents it from covering the card being explored.
- Its current `role="status"` is acceptable, but avoid repeatedly remounting it on reward state changes. Under `prefers-reduced-motion`, use a direct fade/no translation.

### 4. Reminder notch: protect text from the diagonal edge

- Current geometry (`width:154px`, `clip-path` starts near `30.8px`, `padding-left:30px`) places the text exactly on the cut edge. The new two-line copy will visually collide with it.
- For the 375–390px target, use approximately:

```css
.reminder-notch {
  width: 172px;
  height: 89px;
  padding: 0 9px 0 39px;
  color: #6d6266;
}
.reminder-top { height: 44px; }
.reminder-title { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.reminder-title b { color: #7f3b43; font-size: 12px; line-height: 14px; font-weight: 600; }
.reminder-title small { color: #6d6266; font-size: 10px; line-height: 12px; }
.reminder-time {
  min-height: 44px;
  margin-top: 0;
  padding: 0 2px 0 0;
  justify-content: flex-end;
  gap: 3px;
  color: #7f3b43;
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
}
.reminder-time:focus-visible {
  outline: 2px solid rgba(255,59,124,.4);
  outline-offset: -3px;
  border-radius: 9px;
}
```

- `#6d6266` on `#fff0f4` is about `5.30:1`; it is safer for 10–12px status text than the current lighter treatment.
- Keep switch and time as separate sibling buttons. Their current 44px heights satisfy the target, provided the notch height is no longer 86px with a `-2px` overlap.
- Give the switch a dynamic accessible name: `开启签到提醒` when off, `关闭签到提醒` when on. The time button's existing value-bearing label is good.
- If 320px support must remain, add a dedicated compact media rule instead of letting the 172px notch collide with the streak heading. Do not reduce either target below 44px.

### 5. Balance: entire region must be one semantic hit target

- `src/App.tsx:156` has already moved the text and number into `.balance-entry`, which is the correct semantic direction. Finish the CSS so the button covers the entire 158px region instead of only its intrinsic content:

```css
.balance-section { padding: 0; }
.balance-entry {
  position: absolute;
  z-index: 4;
  inset: 0;
  width: 100%;
  padding: 24px 0 0 33px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.balance-entry:active .balance-number { transform: scale(.99); }
```

- Update the number selector from `.balance-copy strong` to `.balance-entry strong`; otherwise the 42px gradient number style is lost after the markup change.
- Decorative character and stars should remain `pointer-events:none`; consider `alt=""` on the character because the button's `aria-label` already communicates the actionable content and the mascot is decorative.
- On the placeholder response, use a toast such as “布拉币详情页暂未开放”; do not navigate to a fabricated route.

### 6. Completed task contrast and semantics

- Current `.task-action.claimed` is `#777476` on `#f1f1f1`, approximately `4.09:1`; that misses 4.5:1 for the 14px text.
- Recommended visually compatible pair: `color:#625d60; background:#eeecee`, approximately `5.49:1`.
- Retain the check icon plus “已领取”; do not rely on gray alone. `disabled` is correct for preventing repeat activation. The current explicit `opacity` behavior does not dim the button further, which is good.
- Increase task secondary text only if needed: current `#777476` on white is approximately `4.62:1` and passes normal-text contrast, but `#6a6668` gives a safer `5.66:1` at the 12px small-screen breakpoint.
- Add non-color processing state (`spinner + 处理中…`) and keep `aria-label` value-bearing as already implemented.

## Priority order for the implementer

1. Replace obsolete `.has-more` CSS with `.has-left` / `.has-right` and add `.swipe-hint` styling.
2. Add `.balance-entry` layout and fix the stale `.balance-copy strong` selector.
3. Expand/repad the reminder notch and raise copy contrast while keeping two independent 44px controls.
4. Raise claimed-task contrast.
5. Browser-verify at 375px and 390px at both rail boundaries, then check focus-visible and reduced-motion behavior.

## Agent Handoff
- Role: visual/accessibility specialist
- Status: complete
- Scope: Read-only audit of reward rail, reminder notch, balance entry, and completed task state.
- Files created: `artifacts/reward-visual-latest.md`
- Files changed: none (source files untouched)
- Decisions: Preserve the existing exact six-of-seven rail width; add symmetric scroll affordances driven by actual scroll position; widen and repad the reminder notch; make the balance entry a full-area semantic button; raise claimed-state contrast to at least 4.5:1.
- Open questions: Whether 320px remains a release requirement for this iteration; if yes, the widened reminder notch needs a compact breakpoint treatment.
- Validation run: Static source/CSS audit; contrast calculations for current and proposed color pairs. No browser run in this read-only scope.
- Next agent: lead/ui-implementer, then browser QA at 375px and 390px.
