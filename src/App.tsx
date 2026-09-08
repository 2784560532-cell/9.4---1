import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { UiIcon } from './UiIcon'

type Task = { id: number; title: string; description: string; action: '已领取' | '去开启' | '去邀请' | '去设置' | '处理中…'; claimed: boolean; loading?: boolean }
type CheckinPhase = 'loading' | 'ready' | 'submitting' | 'success' | 'claimed' | 'error' | 'reconciling'
type MockResult = 'success' | 'error' | 'timeout'
type RewardStatus = 'claimed' | 'today' | 'locked'
type NotificationPermission = 'default' | 'granted' | 'denied'
type PermissionResult = 'granted' | 'denied'
type CheckinState = { phase: CheckinPhase; balance: number; streak: number; claimedToday: boolean }
type NotificationState = {
  notificationPermission: NotificationPermission
  reminderEnabled: boolean
  reminderTime: string
  notificationTaskClaimed: boolean
  rewardCredited: boolean
  balanceBonus: number
}
type CheckinAction =
  | { type: 'LOAD_READY' }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS' }
  | { type: 'SET_CLAIMED' }
  | { type: 'ERROR' }
  | { type: 'RECONCILING' }
  | { type: 'ADVANCE_DAY' }
type NotificationAction =
  | { type: 'GRANT' }
  | { type: 'DENY' }
  | { type: 'SET_REMINDER'; enabled: boolean }
  | { type: 'SET_TIME'; time: string }
  | { type: 'REVOKE' }

const INITIAL_BALANCE = 434
const INITIAL_STREAK = 6
const rewards = [1, 2, 3, 4, 5, 6, 7] as const
const LOAD_DELAY_MS = 420
const SUBMIT_DELAY_MS = 760
const SUCCESS_HOLD_MS = 900
const RECONCILE_DELAY_MS = 2200
const PERMISSION_DELAY_MS = 520
const NOTIFICATION_REWARD = 2
const DEFAULT_REMINDER_TIME = '20:00'

function getInitialCheckinState(): CheckinState {
  return { phase: 'loading', balance: INITIAL_BALANCE, streak: INITIAL_STREAK, claimedToday: false }
}
const initialTasks: Task[] = [
  { id: 1, title: '页面浏览', description: '浏览首页15秒，领取2布拉币', action: '已领取', claimed: true },
  { id: 2, title: '看视频广告', description: '看完广告，领取2布拉币', action: '已领取', claimed: true },
  { id: 3, title: '开启通知权限', description: '开启系统通知权限', action: '去开启', claimed: false },
  { id: 4, title: '邀请好友', description: '每邀请1位新用户，获得2布拉币，不限次数', action: '去邀请', claimed: false },
]
const rewardDays = rewards.map((reward, index) => ({ day: index + 1, reward }))

function checkinReducer(state: CheckinState, action: CheckinAction): CheckinState {
  switch (action.type) {
    case 'LOAD_READY': return { ...state, phase: 'ready' }
    case 'SUBMIT': return state.phase === 'ready' || state.phase === 'error' ? { ...state, phase: 'submitting' } : state
    case 'SUCCESS': return state.phase === 'submitting' ? { phase: 'success', balance: state.balance + (rewards[state.streak] ?? 0), streak: state.streak + 1, claimedToday: true } : state
    case 'SET_CLAIMED': return state.phase === 'success' ? { ...state, phase: 'claimed' } : state
    case 'ERROR': return state.claimedToday ? { ...state, phase: 'claimed' } : { ...state, phase: 'error' }
    case 'RECONCILING': return state.phase === 'submitting' ? { ...state, phase: 'reconciling' } : state
    case 'ADVANCE_DAY': return state.claimedToday && state.streak >= rewards.length ? { ...state, phase: 'ready', streak: 0, claimedToday: false } : state
  }
}

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'GRANT': {
      const isFirstCredit = !state.rewardCredited
      return { ...state, notificationPermission: 'granted', reminderEnabled: true, notificationTaskClaimed: true, rewardCredited: true, balanceBonus: state.balanceBonus + (isFirstCredit ? NOTIFICATION_REWARD : 0) }
    }
    case 'DENY':
    case 'REVOKE': return { ...state, notificationPermission: 'denied', reminderEnabled: false }
    case 'SET_REMINDER': return { ...state, reminderEnabled: state.notificationPermission === 'granted' && action.enabled }
    case 'SET_TIME': return { ...state, reminderTime: action.time }
  }
}

function getScenario() {
  return new URLSearchParams(window.location.search).get('scenario') || 'default'
}

function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function getNotificationSeed(): NotificationState {
  const seed = new URLSearchParams(window.location.search).get('notificationSeed')
  if (seed === 'default') return { notificationPermission: 'default', reminderEnabled: false, reminderTime: DEFAULT_REMINDER_TIME, notificationTaskClaimed: false, rewardCredited: false, balanceBonus: 0 }
  if (seed === 'denied') return { notificationPermission: 'denied', reminderEnabled: false, reminderTime: DEFAULT_REMINDER_TIME, notificationTaskClaimed: false, rewardCredited: false, balanceBonus: 0 }
  if (seed === 'granted-off') return { notificationPermission: 'granted', reminderEnabled: false, reminderTime: DEFAULT_REMINDER_TIME, notificationTaskClaimed: true, rewardCredited: true, balanceBonus: 0 }
  return { notificationPermission: 'granted', reminderEnabled: true, reminderTime: DEFAULT_REMINDER_TIME, notificationTaskClaimed: true, rewardCredited: true, balanceBonus: 0 }
}

function normalizeNotificationState(value: unknown): NotificationState | null {
  if (!value || typeof value !== 'object') return null
  const saved = value as Partial<NotificationState>
  if (saved.notificationPermission !== 'default' && saved.notificationPermission !== 'granted' && saved.notificationPermission !== 'denied') return null
  const notificationTaskClaimed = Boolean(saved.notificationTaskClaimed)
  const rewardCredited = Boolean(saved.rewardCredited) || notificationTaskClaimed
  return {
    notificationPermission: saved.notificationPermission,
    reminderEnabled: saved.notificationPermission === 'granted' && Boolean(saved.reminderEnabled),
    reminderTime: isReminderTime(saved.reminderTime) ? saved.reminderTime : DEFAULT_REMINDER_TIME,
    notificationTaskClaimed,
    rewardCredited,
    balanceBonus: saved.balanceBonus === NOTIFICATION_REWARD ? NOTIFICATION_REWARD : 0,
  }
}

function getNotificationStorageKey() { return `bula-notification-v2:${getScenario()}` }
function getLegacyNotificationStorageKey() { return `bula-notification-v1:${getScenario()}` }

function getInitialNotificationState(): NotificationState {
  const seed = getNotificationSeed()
  try {
    const stored = window.localStorage.getItem(getNotificationStorageKey()) ?? window.localStorage.getItem(getLegacyNotificationStorageKey())
    const normalized = stored ? normalizeNotificationState(JSON.parse(stored)) : null
    return normalized ?? seed
  } catch { return seed }
}

function getMockResult(): MockResult {
  const value = new URLSearchParams(window.location.search).get('mock')
  return value === 'error' || value === 'timeout' ? value : 'success'
}

function getPermissionResult(): PermissionResult {
  return new URLSearchParams(window.location.search).get('permissionResult') === 'denied' ? 'denied' : 'granted'
}

function getSimulatedSystemPermission(): NotificationPermission | null {
  const value = new URLSearchParams(window.location.search).get('systemPermission')
  return value === 'default' || value === 'granted' || value === 'denied' ? value : null
}

function simulateCheckin(result: MockResult): Promise<MockResult> {
  return new Promise((resolve) => window.setTimeout(() => resolve(result), result === 'timeout' ? 850 : SUBMIT_DELAY_MS))
}

function simulateNotificationPermission(result: PermissionResult): Promise<PermissionResult> {
  return new Promise((resolve) => window.setTimeout(() => resolve(result), PERMISSION_DELAY_MS))
}

function StatusBar() {
  return <div className="status-bar" aria-label="手机状态栏"><time>9:41</time><div className="status-icons"><UiIcon name="signal" size={18} weight="fill" /><UiIcon name="wifi" size={18} weight="bold" /><span className="battery" aria-label="电量"><i /></span></div></div>
}

function Header({ onRules }: { onRules: () => void }) {
  return <header className="header"><button className="icon-button back-button" aria-label="返回" onClick={() => window.history.length > 1 ? window.history.back() : console.log('back')}><UiIcon name="back" size={27} weight="bold" /></button><h1>每日签到</h1><button className="rules-button" onClick={onRules}>规则</button></header>
}

function BalanceSection({ balance, delta, onOpenDetails }: { balance: number; delta: number | null; onOpenDetails: () => void }) {
  return <section className="balance-section" aria-label="布拉币余额"><button type="button" className="balance-entry" aria-label={`查看布拉币详情，当前余额 ${balance} 布拉币`} onClick={onOpenDetails}><span className="balance-link">布拉币余额 <UiIcon name="next" size={15} weight="bold" /></span><span className={`balance-number ${delta ? 'is-updated' : ''}`} aria-live="polite"><strong>{balance}</strong>{delta && <span className="balance-delta">+{delta}</span>}</span></button><img className="hero-character" src="/assets/ip-character.png" alt="粉色布拉币角色" /><img className="hero-star hero-star-left" src="/assets/star-yellow.png" alt="" /><img className="hero-star hero-star-right" src="/assets/star-yellow.png" alt="" /><span className="spark spark-one" /><span className="spark spark-two" /><span className="spark spark-three" /></section>
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label="签到提醒" className={`switch switch-hit-area ${checked ? 'is-on' : ''}`} onClick={onChange}><span /></button>
}

function rewardStatus(day: number, state: CheckinState): RewardStatus {
  if (day <= state.streak) return 'claimed'
  if (!state.claimedToday && day === state.streak + 1) return 'today'
  return 'locked'
}

function RewardSkeleton() {
  return <div className="reward-viewport has-more"><div className="reward-scroll reward-scroll-loading" aria-label="正在加载签到奖励" aria-busy="true"><div className="reward-rail"><div className="reward-grid-v2">{rewardDays.map(({ day }) => <div className="reward-skeleton" key={day}><i /><span /><b /></div>)}</div><div className="progress-track skeleton-track" /></div></div></div>
}

function RewardDays({ state, onCheckin, onLocked }: { state: CheckinState; onCheckin: () => void; onLocked: (day: number) => void }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ active: false, moved: false, pointerId: -1, startX: 0, startScroll: 0 })
  const suppressClickRef = useRef(false)
  const todayDay = state.claimedToday ? state.streak : Math.min(state.streak + 1, rewards.length)
  const getLogicalMax = (element: HTMLDivElement) => {
    const cards = element.querySelectorAll<HTMLElement>('.reward-day')
    return cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : element.scrollWidth - element.clientWidth
  }
  const updateScrollState = () => {
    const element = scrollRef.current
    if (!element) return
    const logicalMax = getLogicalMax(element)
    setCanScrollLeft(element.scrollLeft > 2)
    setCanScrollRight(element.scrollLeft < logicalMax - 2)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const element = scrollRef.current
      if (!element) return
      element.scrollTo({ left: todayDay === 7 || state.streak >= 6 ? getLogicalMax(element) : 0, behavior: 'auto' })
      window.requestAnimationFrame(updateScrollState)
    }, 60)
    return () => window.clearTimeout(timer)
  }, [state.streak, todayDay])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !scrollRef.current) return
    dragRef.current = { active: true, moved: false, pointerId: event.pointerId, startX: event.clientX, startScroll: scrollRef.current.scrollLeft }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const element = scrollRef.current
    if (!drag.active || drag.pointerId !== event.pointerId || !element) return
    const delta = event.clientX - drag.startX
    if (Math.abs(delta) > 4 && !drag.moved) {
      drag.moved = true
      element.setPointerCapture(event.pointerId)
      setIsDragging(true)
    }
    if (!drag.moved) return
    event.preventDefault()
    element.scrollLeft = drag.startScroll - delta
    updateScrollState()
  }

  const finishPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const element = scrollRef.current
    if (!drag.active || drag.pointerId !== event.pointerId || !element) return
    drag.active = false
    setIsDragging(false)
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    if (drag.moved) {
      const logicalMax = getLogicalMax(element)
      element.scrollTo({ left: element.scrollLeft < logicalMax / 2 ? 0 : logicalMax, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      window.setTimeout(updateScrollState, 220)
      if (event.type === 'pointerup') {
        suppressClickRef.current = true
        window.setTimeout(() => { suppressClickRef.current = false }, 0)
      }
    }
    drag.moved = false
  }

  return <div className={`reward-viewport ${canScrollLeft ? 'has-left' : ''} ${canScrollRight ? 'has-right' : ''}`}><div ref={scrollRef} className={`reward-scroll ${isDragging ? 'is-dragging' : ''}`} aria-label="7天签到奖励，可左右拖动查看完整周期" onScroll={updateScrollState} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointerDrag} onPointerCancel={finishPointerDrag} onClickCapture={(event) => { if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); suppressClickRef.current = false } }}><div className="reward-rail"><div className="reward-grid-v2">{rewardDays.map(({ day, reward }) => {
    const status = rewardStatus(day, state)
    const interactionLocked = ['submitting', 'success', 'reconciling'].includes(state.phase)
    const unavailable = status === 'claimed' || interactionLocked
    return <button type="button" className={`reward-day reward-${status}`} key={day} aria-disabled={unavailable} tabIndex={status === 'claimed' ? -1 : 0} aria-label={status === 'claimed' ? `第 ${day} 天，已领取，奖励 ${reward} 布拉币` : status === 'today' ? `今天，第 ${day} 天，可领取 ${reward} 布拉币` : `第 ${day} 天，待解锁，奖励 ${reward} 布拉币`} onClick={() => { if (unavailable) return; status === 'today' ? onCheckin() : onLocked(day) }}><span className="reward-day-label">{status === 'today' ? '今天' : `第${day}天`}</span><span className="reward-state-icon">{status === 'claimed' && <UiIcon name="check" size={16} weight="bold" />}{status === 'today' && <img draggable={false} src="/assets/coin-pink.png" alt="" />}{status === 'locked' && <UiIcon name="lock" size={15} weight="bold" />}</span><span className="reward-state-copy">{status === 'claimed' ? `已领 +${reward}` : status === 'today' ? `可领 +${reward}` : `+${reward}`}</span></button>
  })}</div><div className="progress-track" aria-label={`已完成 ${state.streak} 天`}><span className="progress-fill" style={{ '--progress-percent': `${(Math.max(state.streak - 1, 0) / (rewards.length - 1)) * 85.714}%` } as CSSProperties} />{rewardDays.map(({ day }) => <i className={day <= state.streak ? 'complete' : ''} key={day} />)}</div></div></div></div>
}

function buttonPresentation(phase: CheckinPhase, reward: number) {
  switch (phase) {
    case 'loading': return { label: '加载中…', icon: 'spinner' as const }
    case 'ready': return { label: `签到领取${reward}布拉币`, icon: null }
    case 'submitting': return { label: '签到中…', icon: 'spinner' as const }
    case 'success': return { label: `签到成功，+${reward}`, icon: 'check' as const }
    case 'claimed': return { label: '今日已签到', icon: 'check' as const }
    case 'error': return { label: '重新签到', icon: null }
    case 'reconciling': return { label: '正在确认…', icon: 'spinner' as const }
  }
}

function ReminderArea({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <div className="reminder-notch"><div className="reminder-first-row"><b>签到提醒</b><Switch checked={enabled} onChange={onToggle} /></div></div>
}

function CheckinCard({ reminderEnabled, reminderTime, onToggleReminder, onEditTime, state, onCheckin, onLocked, prototypeControls, onAdvanceDay }: { reminderEnabled: boolean; reminderTime: string; onToggleReminder: () => void; onEditTime: () => void; state: CheckinState; onCheckin: () => void; onLocked: (day: number) => void; prototypeControls: boolean; onAdvanceDay: () => void }) {
  const currentReward = rewards[Math.min(state.claimedToday ? state.streak - 1 : state.streak, rewards.length - 1)]
  const presentation = buttonPresentation(state.phase, currentReward)
  const disabled = state.phase !== 'ready' && state.phase !== 'error'
  const tomorrowReward = rewards[Math.min(state.streak, rewards.length - 1)]
  const cycleCompleted = state.streak >= rewards.length && state.claimedToday
  const feedback = state.phase === 'error' ? '签到未完成，网络连接异常。请重试' : state.phase === 'reconciling' ? '正在确认签到结果，请勿重复操作' : cycleCompleted ? '本轮签到已完成，明天将从第1天重新开始' : state.phase === 'claimed' ? `明天签到可领${tomorrowReward}布拉币` : state.phase === 'loading' ? '正在加载签到信息' : state.streak === 6 ? '完成第7天后，明天将从第1天重新开始' : ''
  return <section className={`checkin-card card phase-${state.phase}`} aria-busy={state.phase === 'loading' || state.phase === 'submitting' || state.phase === 'reconciling'}><div className="checkin-heading"><div className="checkin-top-row"><h2>已连续签到<em>{state.streak}</em>天</h2><ReminderArea enabled={reminderEnabled} onToggle={onToggleReminder} /></div><button type="button" className="reminder-time" onClick={onEditTime} aria-label={`修改签到提醒时间，当前${reminderTime}`}>提醒时间 {reminderTime}<UiIcon name="next" size={11} weight="bold" /></button></div><div className="checkin-body">{state.phase === 'loading' ? <RewardSkeleton /> : <RewardDays state={state} onCheckin={onCheckin} onLocked={onLocked} />}<button className="checkin-button" disabled={disabled} onClick={onCheckin}>{presentation.icon && <UiIcon name={presentation.icon} size={17} weight="bold" className={presentation.icon === 'spinner' ? 'spin' : ''} />}<span>{presentation.label}</span></button><p className={`checkin-feedback ${state.phase === 'error' ? 'is-error' : ''}`} aria-live="polite">{feedback}</p>{prototypeControls && cycleCompleted && <button type="button" className="cycle-test-button" onClick={onAdvanceDay}>模拟进入下一自然日</button>}</div></section>
}

function RewardBadge({ claimed }: { claimed: boolean }) {
  return <div className={`task-reward ${claimed ? 'outlined' : ''}`}><img src="/assets/coin-pink.png" alt="2 布拉币" /><span>+2</span></div>
}

function TaskItem({ task, onAction }: { task: Task; onAction: (task: Task) => void }) {
  const disabled = task.claimed || task.loading
  return <article className="task-item"><RewardBadge claimed={task.claimed} /><div className="task-copy"><h3>{task.title}</h3><p>{task.description}</p></div><button disabled={disabled} aria-label={`${task.title}，${task.claimed ? '已领取' : task.action}`} className={`task-action ${task.claimed ? 'claimed' : ''} ${task.loading ? 'loading' : ''}`} onClick={() => onAction(task)}>{task.claimed && <UiIcon name="check" size={15} weight="bold" />}{task.loading && <UiIcon name="spinner" size={15} weight="bold" className="spin" />}<span>{task.claimed ? '已领取' : task.action}</span></button></article>
}

function DailyTasks({ tasks, onTask, onAll }: { tasks: Task[]; onTask: (task: Task) => void; onAll: () => void }) {
  return <section className="tasks-card card"><div className="tasks-header"><h2>每日任务</h2><button onClick={onAll}>全部任务 <UiIcon name="next" size={19} weight="bold" /></button></div><div className="task-list">{tasks.map((task) => <TaskItem key={task.id} task={task} onAction={onTask} />)}</div></section>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="modal-title">{title}</h2><p>{children}</p><button autoFocus onClick={onClose}>知道了</button></section></div>
}

function NotificationIntroModal({ time, requesting, onCancel, onContinue }: { time: string; requesting: boolean; onCancel: () => void; onContinue: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={() => !requesting && onCancel()}><section className="modal notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-modal-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="notification-modal-title">开启签到提醒</h2><p>开启后，我们会在每天 {time} 提醒你签到，可随时关闭。</p><div className="permission-modal-actions"><button className="secondary" disabled={requesting} onClick={onCancel}>暂不开启</button><button disabled={requesting} onClick={onContinue}>{requesting && <UiIcon name="spinner" size={15} weight="bold" className="spin" />}{requesting ? '请求中…' : '继续开启'}</button></div><small>网页原型使用模拟通知权限</small></section></div>
}

function TimePickerSheet({ initialTime, onCancel, onSave }: { initialTime: string; onCancel: () => void; onSave: (time: string) => void }) {
  const [draft, setDraft] = useState(initialTime)
  return <div className="sheet-backdrop" role="presentation" onMouseDown={onCancel}><section className="time-sheet" role="dialog" aria-modal="true" aria-labelledby="time-sheet-title" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-header"><button type="button" onClick={onCancel}>取消</button><h2 id="time-sheet-title">提醒时间</h2><button type="button" className="save" onClick={() => onSave(draft)}>保存</button></div><label className="time-input-wrap"><span>每天</span><input autoFocus type="time" step="60" value={draft} onInput={(event) => setDraft(event.currentTarget.value)} aria-label="选择每天提醒时间" /></label><p>仅保存网页原型中的提醒时间设置</p></section></div>
}

export default function App() {
  const [checkinState, dispatch] = useReducer(checkinReducer, undefined, getInitialCheckinState)
  const [notificationState, dispatchNotification] = useReducer(notificationReducer, undefined, getInitialNotificationState)
  const [modal, setModal] = useState<'rules' | 'invite' | 'notification-intro' | 'notification-settings' | 'time' | null>(null)
  const [toast, setToast] = useState('')
  const [permissionRequesting, setPermissionRequesting] = useState(false)
  const [notificationRewardPulse, setNotificationRewardPulse] = useState(false)
  const requestInFlightRef = useRef(false)
  const permissionInFlightRef = useRef(false)
  const revocationHandledRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const rewardPulseTimerRef = useRef<number | null>(null)
  const reconcileTimerRef = useRef<number | null>(null)
  const notificationStorageKey = useMemo(getNotificationStorageKey, [])
  const mockResult = useMemo(getMockResult, [])
  const permissionResult = useMemo(getPermissionResult, [])
  const simulatedSystemPermission = useMemo(getSimulatedSystemPermission, [])
  const prototypeControls = useMemo(() => new URLSearchParams(window.location.search).get('prototypeControls') === '1', [])
  const currentCheckinReward = rewards[Math.min(checkinState.claimedToday ? checkinState.streak - 1 : checkinState.streak, rewards.length - 1)]

  useEffect(() => {
    const timer = window.setTimeout(() => dispatch({ type: 'LOAD_READY' }), LOAD_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    try { window.localStorage.setItem(notificationStorageKey, JSON.stringify(notificationState)) } catch { /* 设置仍可在当前页面运行。 */ }
  }, [notificationState, notificationStorageKey])

  useEffect(() => {
    if (checkinState.phase !== 'success') return
    const timer = window.setTimeout(() => dispatch({ type: 'SET_CLAIMED' }), SUCCESS_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [checkinState.phase])

  const showToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    const syncPermission = () => {
      if (document.visibilityState === 'hidden') return
      if (simulatedSystemPermission === 'denied' && notificationState.notificationPermission === 'granted' && !revocationHandledRef.current) {
        revocationHandledRef.current = true
        dispatchNotification({ type: 'REVOKE' })
        showToast('通知权限已关闭')
      }
    }
    window.addEventListener('focus', syncPermission)
    document.addEventListener('visibilitychange', syncPermission)
    syncPermission()
    return () => {
      window.removeEventListener('focus', syncPermission)
      document.removeEventListener('visibilitychange', syncPermission)
    }
  }, [notificationState.notificationPermission, simulatedSystemPermission])

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    if (rewardPulseTimerRef.current) window.clearTimeout(rewardPulseTimerRef.current)
    if (reconcileTimerRef.current) window.clearTimeout(reconcileTimerRef.current)
  }, [])

  const handleCheckin = async () => {
    if (requestInFlightRef.current || (checkinState.phase !== 'ready' && checkinState.phase !== 'error')) return
    requestInFlightRef.current = true
    dispatch({ type: 'SUBMIT' })
    const result = await simulateCheckin(mockResult)
    if (result === 'success') {
      dispatch({ type: 'SUCCESS' })
      navigator.vibrate?.(18)
      showToast(checkinState.streak === rewards.length - 1 ? `领取成功，获得${currentCheckinReward}布拉币。本轮签到已完成，明天将从第1天重新开始。` : `签到成功，获得${currentCheckinReward}布拉币`)
      requestInFlightRef.current = false
    } else if (result === 'error') {
      dispatch({ type: 'ERROR' })
      requestInFlightRef.current = false
    } else {
      dispatch({ type: 'RECONCILING' })
      reconcileTimerRef.current = window.setTimeout(() => { dispatch({ type: 'ERROR' }); requestInFlightRef.current = false }, RECONCILE_DELAY_MS)
    }
  }

  const openPermissionFlow = () => {
    if (notificationState.notificationPermission === 'denied') {
      setModal('notification-settings')
      showToast('通知权限未开启，请前往系统设置授权')
      return
    }
    setModal('notification-intro')
  }

  const handleReminderToggle = () => {
    if (notificationState.notificationPermission !== 'granted') {
      openPermissionFlow()
      return
    }
    const enabled = !notificationState.reminderEnabled
    dispatchNotification({ type: 'SET_REMINDER', enabled })
    showToast(enabled ? `签到提醒已开启，每天 ${notificationState.reminderTime} 提醒你` : '签到提醒已关闭')
  }

  const handleContinuePermission = async () => {
    if (permissionInFlightRef.current) return
    permissionInFlightRef.current = true
    setPermissionRequesting(true)
    const result = await simulateNotificationPermission(permissionResult)
    if (result === 'granted') {
      const shouldCredit = !notificationState.rewardCredited
      dispatchNotification({ type: 'GRANT' })
      if (shouldCredit) {
        setNotificationRewardPulse(true)
        rewardPulseTimerRef.current = window.setTimeout(() => setNotificationRewardPulse(false), 900)
      }
      setModal(null)
      showToast(`签到提醒已开启，每天 ${notificationState.reminderTime} 提醒你`)
    } else {
      dispatchNotification({ type: 'DENY' })
      setModal(null)
      showToast('通知权限未开启，请前往系统设置授权')
    }
    setPermissionRequesting(false)
    permissionInFlightRef.current = false
  }

  const tasks = useMemo(() => initialTasks.map((task) => {
    if (task.id !== 3) return task
    if (permissionRequesting) return { ...task, claimed: false, action: '处理中…' as const, loading: true }
    if (notificationState.notificationTaskClaimed) return { ...task, claimed: true, action: '已领取' as const }
    if (notificationState.notificationPermission === 'denied') return { ...task, claimed: false, action: '去设置' as const }
    return { ...task, claimed: false, action: '去开启' as const }
  }), [notificationState.notificationPermission, notificationState.notificationTaskClaimed, permissionRequesting])

  const handleTask = (task: Task) => {
    if (task.loading) return
    if (task.id === 4) { setModal('invite'); showToast('邀请流程暂未开放'); return }
    if (task.id === 3) openPermissionFlow()
  }

  const saveReminderTime = (time: string) => {
    if (!isReminderTime(time)) return
    dispatchNotification({ type: 'SET_TIME', time })
    setModal(null)
    showToast(`提醒时间已更新为${time}`)
  }

  const visibleBalance = checkinState.balance + notificationState.balanceBonus
  const visibleDelta = checkinState.phase === 'success' ? currentCheckinReward : notificationRewardPulse ? NOTIFICATION_REWARD : null

  const handleAdvanceDay = () => {
    dispatch({ type: 'ADVANCE_DAY' })
    showToast('已模拟进入下一自然日，从第1天开始签到')
  }

  return <main className="phone-shell"><div className="top-gradient"><StatusBar /><Header onRules={() => setModal('rules')} /><BalanceSection balance={visibleBalance} delta={visibleDelta} onOpenDetails={() => showToast('布拉币详情页暂未开放')} /></div><div className="content-stack"><CheckinCard reminderEnabled={notificationState.reminderEnabled} reminderTime={notificationState.reminderTime} onToggleReminder={handleReminderToggle} onEditTime={() => setModal('time')} state={checkinState} onCheckin={handleCheckin} onLocked={(day) => showToast(`连续签到至第 ${day} 天可领取`)} prototypeControls={prototypeControls} onAdvanceDay={handleAdvanceDay} /><DailyTasks tasks={tasks} onTask={handleTask} onAll={() => showToast('已展示全部任务')} /></div>{modal === 'rules' && <Modal title="签到规则" onClose={() => setModal(null)}>连续签到可获得更多奖励。</Modal>}{modal === 'invite' && <Modal title="邀请好友" onClose={() => setModal(null)}>每成功邀请1位符合项目新用户判定条件的用户，可获得2布拉币，不限次数；同一位新用户不能重复计入。邀请流程暂未开放。</Modal>}{modal === 'notification-settings' && <Modal title="前往通知设置" onClose={() => setModal(null)}>这是网页原型，请在模拟场景中将通知权限设为已授权后返回页面。</Modal>}{modal === 'notification-intro' && <NotificationIntroModal time={notificationState.reminderTime} requesting={permissionRequesting} onCancel={() => setModal(null)} onContinue={handleContinuePermission} />}{modal === 'time' && <TimePickerSheet initialTime={notificationState.reminderTime} onCancel={() => setModal(null)} onSave={saveReminderTime} />}{toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}</main>
}
