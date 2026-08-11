import type { ResizeHandle } from '../schema/types'
import './SelectionOverlay.css'

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

interface Props {
  rect: { x: number; y: number; width: number; height: number }
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void
}

export function SelectionOverlay({ rect, onResizeStart }: Props) {
  return (
    <div
      className="selection-overlay"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    >
      {HANDLES.map((h) => (
        <div
          key={h}
          className={`selection-handle selection-handle--${h}`}
          onPointerDown={(e) => onResizeStart(h, e)}
        />
      ))}
    </div>
  )
}
