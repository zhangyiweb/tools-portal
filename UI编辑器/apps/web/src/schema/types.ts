export type BasicNodeType = 'frame' | 'text' | 'image' | 'rect' | 'button' | 'input'

export type AntdNodeType =
  | 'antd-button'
  | 'antd-input'
  | 'antd-textarea'
  | 'antd-input-number'
  | 'antd-select'
  | 'antd-cascader'
  | 'antd-switch'
  | 'antd-slider'
  | 'antd-rate'
  | 'antd-checkbox'
  | 'antd-radio'
  | 'antd-date-picker'
  | 'antd-time-picker'
  | 'antd-upload'
  | 'antd-card'
  | 'antd-table'
  | 'antd-list'
  | 'antd-tag'
  | 'antd-badge'
  | 'antd-avatar'
  | 'antd-alert'
  | 'antd-progress'
  | 'antd-spin'
  | 'antd-empty'
  | 'antd-divider'
  | 'antd-breadcrumb'
  | 'antd-tabs'
  | 'antd-pagination'
  | 'antd-steps'
  | 'antd-timeline'
  | 'antd-collapse'
  | 'antd-statistic'
  | 'antd-segmented'
  | 'antd-descriptions'

export type ElementNodeType =
  | 'el-button'
  | 'el-input'
  | 'el-textarea'
  | 'el-input-number'
  | 'el-select'
  | 'el-cascader'
  | 'el-switch'
  | 'el-slider'
  | 'el-rate'
  | 'el-checkbox'
  | 'el-radio'
  | 'el-date-picker'
  | 'el-time-picker'
  | 'el-upload'
  | 'el-card'
  | 'el-table'
  | 'el-tag'
  | 'el-badge'
  | 'el-avatar'
  | 'el-alert'
  | 'el-progress'
  | 'el-loading'
  | 'el-empty'
  | 'el-divider'
  | 'el-breadcrumb'
  | 'el-tabs'
  | 'el-pagination'
  | 'el-steps'
  | 'el-timeline'
  | 'el-collapse'
  | 'el-statistic'
  | 'el-segmented'
  | 'el-descriptions'
  | 'el-link'
  | 'el-text'

export type NodeType = BasicNodeType | AntdNodeType | ElementNodeType

export type ComponentLibrary = 'basic' | 'antd' | 'element-plus'

/** 导出/适配单位：px 固定；rem 随页面宽度缩放 */
export type CssUnit = 'px' | 'rem'

export interface StyleProps {
  backgroundColor?: string
  /** 完整 background（渐变等），优先于 backgroundColor；有 backgroundImage 时不使用 */
  background?: string
  /** 背景图 URL（不含 url() 包裹） */
  backgroundImage?: string
  backgroundSize?: string
  backgroundPosition?: string
  backgroundRepeat?: string
  color?: string
  fontSize?: number
  fontWeight?: number | string
  fontFamily?: string
  lineHeight?: number | string
  letterSpacing?: number
  textAlign?: 'left' | 'center' | 'right'
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
  borderStyle?: string
  opacity?: number
  boxShadow?: string
  padding?: number
  margin?: number
  overflow?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  objectPosition?: string
  zIndex?: number
}

export interface UINodeProps {
  text?: string
  src?: string
  placeholder?: string
  alt?: string
  variant?: 'primary' | 'default' | 'dashed' | 'text' | 'link' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'large' | 'middle' | 'small' | 'default'
  disabled?: boolean
  checked?: boolean
  options?: string
  title?: string
  tagColor?: string
  percent?: number
  value?: number
  count?: number
}

export interface UINode {
  id: string
  type: NodeType
  name: string
  x: number
  y: number
  width: number
  height: number
  style: StyleProps
  props?: UINodeProps
  children?: UINode[]
  locked?: boolean
  visible?: boolean
}

export interface DocumentMeta {
  id: string
  name: string
  width: number
  height: number
  backgroundColor: string
  viewportId?: string
  /** 默认 px；选 rem 时导出用 rem，且改分辨率会等比缩放元素 */
  cssUnit?: CssUnit
}

export interface EditorDocument {
  meta: DocumentMeta
  root: UINode
}

export interface RefLayer {
  src: string
  opacity: number
  visible: boolean
  offsetX: number
  offsetY: number
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface ViewportPreset {
  id: string
  name: string
  width: number
  height: number
  category: 'mobile' | 'tablet' | 'desktop' | 'custom'
}
