# Interaction update QA report

## Agent Handoff

- Role: qa-auditor
- Status: complete
- Scope: all requested check-in states and mobile geometry
- Files created: `screenshots/success-390.png`, `screenshots/error-390.png`, `screenshots/mobile-320.png`, this report
- Files changed: none
- Decisions: accepted tiny text and pill warnings because they preserve the supplied screenshot; horizontal scrolling is intentional only inside the reward strip below 375px
- Open questions: none
- Validation run: browser interaction and DOM geometry checks detailed below
- Next agent: release

## Verified behavior

- Loading: 7 skeleton cards; CTA is `加载中…`; ready state never flashes first.
- Ready: balance 434, streak 3, three claimed cards, day 4 `今天 / 可领 6`, three locked cards.
- Full sequence: `+1, +1, +5, +6, +7, 待定, +8`.
- Duplicate click: browser double-click resulted in one atomic award only.
- Submitting: CTA changed to `签到中…`, became disabled, and balance/streak stayed 434/3.
- Success: balance 440, streak 4, four claimed cards, CTA `签到成功，+6`, delta `+6`, success toast.
- Claimed: CTA settles to disabled `今日已签到`; helper copy says tomorrow awards 7.
- Persistence: reload begins in loading, then restores 440/4/claimed without reopening the reward.
- Error: balance/streak remain 434/3; CTA becomes enabled `重新签到`; exact network error copy appears.
- Reconciling: balance/streak remain 434/3; CTA is disabled `正在确认…`; after 2.2s unresolved result becomes retryable error.
- Locked card: click shows `连续签到至第 N 天可领取`.
- 375px: all 7 cards are visible, each at least `44×70px`.
- 320px: page has no horizontal overflow; reward strip scrolls to day 4 (`scrollLeft=26`) and day 4 is fully visible.
- 430px: phone surface remains centered at 390px.
- Production build: pass (`npm run build`).
- Static UI audit: 0 failures; reference-preserving warnings only.
- Fresh browser tab: no console warnings or errors.
