/** 组件库拖放到画布的 dataTransfer MIME */
export const PALETTE_DND_MIME = 'application/x-ui-editor-node-type'

/** 图层树拖拽 MIME */
export const LAYER_DND_MIME = 'application/x-ui-editor-layer-id'

/** 切图资源拖放到画布 */
export const ASSET_DND_MIME = 'application/x-ui-editor-asset'

export type AssetDragPayload = {
  url: string
  name: string
  width?: number
  height?: number
}
