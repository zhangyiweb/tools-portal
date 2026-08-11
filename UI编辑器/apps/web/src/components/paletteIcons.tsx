import type { ComponentType, CSSProperties } from 'react'
import {
  AlertOutlined,
  AppstoreOutlined,
  BorderOuterOutlined,
  BorderOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  EditOutlined,
  FieldNumberOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  FormOutlined,
  FundOutlined,
  IdcardOutlined,
  InboxOutlined,
  LinkOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MinusOutlined,
  NodeIndexOutlined,
  OrderedListOutlined,
  PartitionOutlined,
  PictureOutlined,
  ProfileOutlined,
  SelectOutlined,
  SlidersOutlined,
  StarOutlined,
  SwapOutlined,
  TableOutlined,
  TagOutlined,
  UnorderedListOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { NodeType } from '../schema/types'

type IconComp = ComponentType<{ style?: CSSProperties; className?: string }>

/** 组件类型 → 官网风格图标（@ant-design/icons） */
const ICONS_BY_KEY: Record<string, IconComp> = {
  frame: BorderOuterOutlined,
  rect: BorderOutlined,
  text: FontSizeOutlined,
  image: PictureOutlined,
  button: BorderOutlined,
  input: EditOutlined,
  textarea: FileTextOutlined,
  'input-number': FieldNumberOutlined,
  select: SelectOutlined,
  cascader: PartitionOutlined,
  switch: SwapOutlined,
  slider: SlidersOutlined,
  rate: StarOutlined,
  checkbox: CheckSquareOutlined,
  radio: CheckCircleOutlined,
  'date-picker': CalendarOutlined,
  'time-picker': ClockCircleOutlined,
  upload: UploadOutlined,
  card: IdcardOutlined,
  table: TableOutlined,
  list: UnorderedListOutlined,
  tag: TagOutlined,
  badge: AppstoreOutlined,
  avatar: UserOutlined,
  alert: AlertOutlined,
  progress: DashboardOutlined,
  spin: LoadingOutlined,
  loading: LoadingOutlined,
  empty: InboxOutlined,
  divider: MinusOutlined,
  breadcrumb: NodeIndexOutlined,
  tabs: FormOutlined,
  pagination: OrderedListOutlined,
  steps: OrderedListOutlined,
  timeline: FieldTimeOutlined,
  collapse: MenuFoldOutlined,
  statistic: FundOutlined,
  segmented: AppstoreOutlined,
  descriptions: ProfileOutlined,
  link: LinkOutlined,
}

export function getPaletteIcon(type: NodeType): IconComp | null {
  if (ICONS_BY_KEY[type]) return ICONS_BY_KEY[type]
  const key = type.replace(/^(antd|el)-/, '')
  return ICONS_BY_KEY[key] ?? null
}

export function paletteIconTone(type: NodeType): 'antd' | 'element' | 'basic' {
  if (type.startsWith('antd-')) return 'antd'
  if (type.startsWith('el-')) return 'element'
  return 'basic'
}
