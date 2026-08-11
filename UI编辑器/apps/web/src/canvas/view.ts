/** 默认画布缩放 84% */
export const DEFAULT_ZOOM = 0.84

/** 将画板居中到视口 */
export function getCenteredPan(
  viewportW: number,
  viewportH: number,
  artboardW: number,
  artboardH: number,
  zoom: number,
): { panX: number; panY: number } {
  return {
    panX: Math.round((viewportW - artboardW * zoom) / 2),
    panY: Math.round((viewportH - artboardH * zoom) / 2),
  }
}
