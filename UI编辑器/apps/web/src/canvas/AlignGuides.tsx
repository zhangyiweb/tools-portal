import type { AlignGuide } from './snap'
import './AlignGuides.css'

interface Props {
  guides: AlignGuide[]
  /** 父容器尺寸，用于画满辅助线 */
  bounds: { width: number; height: number }
  /** 父容器在画板上的偏移（通常为 0） */
  offset?: { x: number; y: number }
}

export function AlignGuides({ guides, bounds, offset = { x: 0, y: 0 } }: Props) {
  if (!guides.length) return null
  return (
    <div className="align-guides" aria-hidden>
      {guides.map((g, i) =>
        g.orientation === 'v' ? (
          <div
            key={`v-${g.position}-${i}`}
            className="align-guide align-guide--v"
            style={{
              left: offset.x + g.position,
              top: offset.y,
              height: bounds.height,
            }}
          />
        ) : (
          <div
            key={`h-${g.position}-${i}`}
            className="align-guide align-guide--h"
            style={{
              top: offset.y + g.position,
              left: offset.x,
              width: bounds.width,
            }}
          />
        ),
      )}
    </div>
  )
}
