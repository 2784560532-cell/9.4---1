import {
  CaretLeft,
  CaretRight,
  CellSignalFull,
  Check,
  CircleNotch,
  LockSimple,
  WifiHigh,
} from '@phosphor-icons/react'

type IconName = 'back' | 'next' | 'signal' | 'wifi' | 'check' | 'lock' | 'spinner'

const icons = {
  back: CaretLeft,
  next: CaretRight,
  signal: CellSignalFull,
  wifi: WifiHigh,
  check: Check,
  lock: LockSimple,
  spinner: CircleNotch,
} as const

type Props = {
  name: IconName
  size?: number
  weight?: 'regular' | 'bold' | 'fill'
  className?: string
}

export function UiIcon({ name, size = 20, weight = 'regular', className }: Props) {
  const Icon = icons[name]
  return <Icon aria-hidden="true" className={`ui-icon ${className ?? ''}`} size={size} weight={weight} />
}
