import { randomUUID } from 'crypto'

/** 与前端 createDefaultDocument 结构对齐的默认空页面 */
export function createDefaultDocumentPayload(name = '页面 1') {
  const rootId = randomUUID()
  const metaId = randomUUID()
  return {
    meta: {
      id: metaId,
      name,
      width: 1920,
      height: 1080,
      backgroundColor: '#0b0c10',
      viewportId: 'desktop-1920',
    },
    root: {
      id: rootId,
      type: 'frame',
      name: '画布',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      style: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
      },
      props: {},
      children: [],
      visible: true,
      locked: false,
    },
  }
}
