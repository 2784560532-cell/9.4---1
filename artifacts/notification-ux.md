# Notification UX handoff

## Scope

Only repair notification-related state presentation and feedback. Preserve the current page composition, warm pink palette, rounded cards, type scale, spacing rhythm, character assets, reward area, check-in state machine, and daily-task styling. Do not add a new page or visually redesign the header/card.

The notification task must exist exactly once in the source task data/render tree. Do not hide a duplicate with text matching, CSS, array filtering at render time, or `display: none`.

## One visual truth

The top switch and the single notification task must be projections of the same persisted state:

| Permission | Reminder | Reward claimed | Top reminder | Notification task action |
| --- | --- | --- | --- | --- |
| `default` | `false` | `false` | Switch off; no time line | `去开启` |
| `granted` | `true` | `true` | Switch on; show `每天 20:00` | `已领取` |
| `granted` | `false` | `true` | Switch off; no time line | `已领取` |
| `denied` | `false` | `false` | Switch off; no time line | `去设置` |
| `denied` (revoked after claim) | `false` | `true` | Switch off; no time line | `已领取` |

`reminderEnabled=true` must never render unless permission is `granted`. Reward-claimed status wins the task-button presentation even after permission is revoked; the user re-enters settings from the top switch in that case.

## Top “签到提醒” treatment

Keep the current clipped pale-pink notch and switch. When enabled, stack the label and schedule inside one compact copy block:

- Primary line: `签到提醒`, 12–13px, medium/600, current wine-pink color.
- Secondary line: `每天 20:00`, 9–10px, 400/500, about 70% opacity, 11–12px line-height.
- Copy block uses `display:flex; flex-direction:column; align-items:flex-start`; no wrapping within either line.
- Keep the switch at 34×21px and its full interactive button at least 44×44px (the visual track can stay smaller; use padding or a pseudo hit area).
- Enabled notch target: 148–152px wide and 45–47px high, right inset 5px. Keep at least 7px between copy and the visual switch.
- Do not show `每天 20:00` when the switch is off. This prevents an off state from implying that delivery is active.

Small-width accommodation (`<=359px`): reduce only the notch internals, not the overall page design. Use a 136–140px notch, a 12px primary line, a 9px secondary line, and a 32×20px visual switch. Reduce the check-in heading to about 18–19px if needed so its text does not sit beneath the notch. There should remain roughly 8–10px of visible separation between the heading and notch at 320px.

## Single notification task

Retain the existing task-row geometry and reward tile. The one source item is:

- Title: `开启通知权限`
- Description: `开启系统通知权限`
- Reward: `+2`

Button variants reuse the current pill styling and size hierarchy:

- `去开启`: active pale-pink pill, pink text.
- `去设置`: same active treatment; do not introduce a warning color.
- `已领取`: disabled light-gray pill, gray text.
- Visual height 34px, interactive height at least 44px through an invisible hit-area wrapper/pseudo-element; minimum visual width 64px and horizontal padding 12–13px.
- Never change the row title/description to communicate state. The action word is sufficient and avoids reflow.
- Reward tile remains `+2`; the gray `已领取` control, not removal of the reward tile, communicates completion.

At 320px the existing three-column row is viable if the action remains no wider than about 68px. Keep the middle column `min-width:0` and existing ellipsis protection. Do not let button text wrap.

## Permission explanation modal

Both `去开启` and an off top switch in the `default` state open exactly the same modal and flow.

Reuse the existing centered white modal: max width 310px, 22px radius, 24px padding, current shadow/backdrop, and 180ms entrance. Content:

- Title: `开启签到提醒`
- Body: `开启后，我们会在每天 20:00 提醒你签到，可随时关闭。`
- Left action: `暂不开启`
- Right action: `继续开启`

Actions sit side by side with a 10px gap and 44px height. The left action should be a soft neutral/pale-pink secondary pill with wine-gray text; the right action keeps the existing pink-to-coral primary gradient. On a 320px viewport, modal outer width is at most `calc(100vw - 48px)`; its approximately 224px inner width leaves about 107px per button, enough for both labels.

After `继续开启`, make the simulation explicit rather than visually impersonating a real iOS prompt. Either resolve from the test scenario or show a second dialog titled `模拟系统通知权限`, with a small `网页原型` note and actions `不允许` / `允许`. During the simulated request, disable both intro actions and show the existing small spinner with `请求中…` in the primary action.

Focus should enter the dialog, stay trapped while open, and return to the entry control on close. Escape/backdrop may close only while no permission request is in flight.

## Simulated settings explanation

When permission is `denied`, tapping either `去设置` or the off top switch opens the same settings explanation modal:

- Title: `前往系统设置`
- Body: `这是网页原型，无法直接打开系统设置。请在模拟设置中将通知权限改为允许。`
- Secondary action: `暂不设置`
- Primary action: `模拟已授权`

Use the same modal and two-button geometry; do not create a sheet or new settings page. `模拟已授权` may restore permission and enable the reminder, but must not re-credit `+2` if the task was claimed previously.

## Toast feedback

Reuse the current dark translucent capsule, 13px white text, 200ms entrance, and approximately 2.2s duration. Exact messages:

- Initial grant or re-enable: `签到提醒已开启，每天 20:00 提醒你`
- User turns reminder off: `签到提醒已关闭`
- User denies permission: `通知权限未开启，请前往系统设置授权`
- Permission found revoked on entry/focus: `通知权限已关闭`

The two long messages overflow the current `white-space:nowrap` toast at 320px. Constrain the toast to `max-width: calc(100vw - 32px)`, allow normal wrapping, use centered 18px line-height, and keep 10px vertical / 16px horizontal padding. Add `bottom: max(34px, env(safe-area-inset-bottom) + 16px)` where supported. Keep a single toast live region; replace its message/timer instead of stacking multiple toasts.

## Transition behavior

- Permission grant updates switch, `每天 20:00`, task button, balance, and toast in the same committed state update.
- The balance `+2` delta may reuse the existing 250–350ms balance-pop treatment.
- Switch track/thumb transition remains about 200ms.
- Task button color/state transition may be 180–220ms; text should switch immediately with state.
- Turning the reminder off never changes task reward styling or balance.
- Honor `prefers-reduced-motion` using the page's existing reduction rule.

## Overflow and regression checks

1. At 390px, enabled reminder shows both lines without overlapping the streak heading or clipping the switch.
2. At 375px, both modal actions remain one line and at least 44px high.
3. At 320px, streak heading and notch do not overlap; task title/description keep their middle column; `去设置` and `已领取` do not wrap.
4. At 320px, every long toast wraps inside 16px viewport gutters rather than extending offscreen.
5. A claimed notification task remains gray/disabled after reminder-off and permission-revoked states.
6. No extra notification row appears after refresh, focus sync, permission change, or task-state update.
7. Keyboard focus indicator remains visible on the switch and both modal buttons; switch exposes `role=switch` and the correct `aria-checked` value.

## Agent handoff

- **Deliverable produced:** notification visual/interaction specification only.
- **Files changed:** `artifacts/notification-ux.md` only.
- **Source files intentionally untouched:** `src/App.tsx`, `src/styles.css`, components, assets, and storage/state implementation.
- **Implementation owner next step:** wire the persisted notification reducer to both top reminder and the sole task record, then apply the compact two-line notch, two modal variants, and toast overflow guard described above.
- **Acceptance priority:** state truth and one-time reward first; preserve current appearance second; small-screen overflow/accessibility third. No unrelated refactor.
