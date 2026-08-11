import { v4 as uuid } from 'uuid'
import type {
  DocumentMeta,
  EditorDocument,
  NodeType,
  StyleProps,
  UINode,
  UINodeProps,
} from './types'
import { DEFAULT_VIEWPORT_ID, findViewport } from './viewports'

const DEFAULT_STYLES: Partial<Record<NodeType, StyleProps>> = {
  frame: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'hidden',
  },
  rect: {
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  text: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: 400,
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'left',
    backgroundColor: 'transparent',
  },
  image: {
    backgroundColor: 'transparent',
    objectFit: 'cover',
    borderRadius: 0,
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
    textAlign: 'center',
    borderRadius: 8,
  },
  input: {
    backgroundColor: 'transparent',
    color: '#e5e7eb',
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    borderRadius: 0,
    padding: 8,
  },
}

type Size = { width: number; height: number }

const LIB_SIZE: Record<string, Size> = {
  button: { width: 88, height: 32 },
  input: { width: 220, height: 32 },
  textarea: { width: 260, height: 80 },
  'input-number': { width: 140, height: 32 },
  select: { width: 220, height: 32 },
  cascader: { width: 220, height: 32 },
  switch: { width: 48, height: 24 },
  slider: { width: 220, height: 24 },
  rate: { width: 160, height: 28 },
  checkbox: { width: 120, height: 24 },
  radio: { width: 120, height: 24 },
  'date-picker': { width: 220, height: 32 },
  'time-picker': { width: 160, height: 32 },
  upload: { width: 120, height: 32 },
  card: { width: 300, height: 160 },
  table: { width: 520, height: 200 },
  list: { width: 280, height: 160 },
  tag: { width: 64, height: 24 },
  badge: { width: 48, height: 28 },
  avatar: { width: 40, height: 40 },
  alert: { width: 320, height: 40 },
  progress: { width: 240, height: 24 },
  spin: { width: 48, height: 48 },
  loading: { width: 48, height: 48 },
  empty: { width: 200, height: 140 },
  divider: { width: 280, height: 24 },
  breadcrumb: { width: 280, height: 28 },
  tabs: { width: 360, height: 40 },
  pagination: { width: 320, height: 32 },
  steps: { width: 420, height: 56 },
  timeline: { width: 260, height: 140 },
  collapse: { width: 320, height: 100 },
  statistic: { width: 140, height: 64 },
  segmented: { width: 240, height: 32 },
  descriptions: { width: 360, height: 100 },
  link: { width: 80, height: 24 },
  text: { width: 120, height: 24 },
}

function libKey(type: NodeType): string {
  return type.replace(/^(antd|el)-/, '')
}

function defaultLibSize(type: NodeType): Size {
  return LIB_SIZE[libKey(type)] ?? { width: 160, height: 32 }
}

const DEFAULT_SIZE: Partial<Record<NodeType, Size>> = {
  frame: { width: 1920, height: 1080 },
  rect: { width: 120, height: 80 },
  text: { width: 160, height: 24 },
  image: { width: 200, height: 150 },
  button: { width: 120, height: 40 },
  input: { width: 200, height: 40 },
}

const DEFAULT_PROPS: Partial<Record<NodeType, UINodeProps>> = {
  frame: {},
  rect: {},
  text: { text: '文本内容' },
  image: { src: '', alt: '图片' },
  button: { text: '按钮' },
  input: { placeholder: '请输入…' },

  'antd-button': { text: '主要按钮', variant: 'primary', size: 'middle' },
  'antd-input': { placeholder: '请输入内容' },
  'antd-textarea': { placeholder: '请输入多行文本' },
  'antd-input-number': { placeholder: '请输入数字', value: 1 },
  'antd-select': { placeholder: '请选择', options: '选项一,选项二,选项三' },
  'antd-cascader': { placeholder: '请选择地区', options: '浙江/杭州,江苏/南京' },
  'antd-switch': { checked: true },
  'antd-slider': { value: 40 },
  'antd-rate': { value: 3 },
  'antd-checkbox': { text: '同意协议', checked: false },
  'antd-radio': { text: '选项 A', checked: true },
  'antd-date-picker': { placeholder: '选择日期' },
  'antd-time-picker': { placeholder: '选择时间' },
  'antd-upload': { text: '点击上传' },
  'antd-card': { title: '卡片标题', text: '这里是卡片内容描述。' },
  'antd-table': { title: '数据表格' },
  'antd-list': { title: '列表', text: '列表项一,列表项二,列表项三' },
  'antd-tag': { text: '标签', tagColor: 'blue' },
  'antd-badge': { text: '消息', count: 5 },
  'antd-avatar': { text: '用' },
  'antd-alert': { title: '提示信息', text: '这是一条成功提示', variant: 'success' },
  'antd-progress': { percent: 60 },
  'antd-spin': {},
  'antd-empty': { text: '暂无数据' },
  'antd-divider': { text: '分割线' },
  'antd-breadcrumb': { text: '首页 / 列表 / 详情' },
  'antd-tabs': { options: '概览,详情,设置', text: '概览' },
  'antd-pagination': { value: 1 },
  'antd-steps': { options: '填写信息,确认提交,完成', value: 1 },
  'antd-timeline': { options: '创建项目,提交审核,发布上线' },
  'antd-collapse': { title: '折叠面板', text: '展开后的内容区域' },
  'antd-statistic': { title: '访问量', value: 112893 },
  'antd-segmented': { options: '日,周,月', text: '日' },
  'antd-descriptions': { title: '用户信息', text: '姓名:张三,手机:13800000000,城市:上海' },

  'el-button': { text: '主要按钮', variant: 'primary', size: 'default' },
  'el-input': { placeholder: '请输入内容' },
  'el-textarea': { placeholder: '请输入多行文本' },
  'el-input-number': { placeholder: '请输入数字', value: 1 },
  'el-select': { placeholder: '请选择', options: '选项一,选项二,选项三' },
  'el-cascader': { placeholder: '请选择地区', options: '浙江/杭州,江苏/南京' },
  'el-switch': { checked: true },
  'el-slider': { value: 40 },
  'el-rate': { value: 3 },
  'el-checkbox': { text: '同意协议', checked: false },
  'el-radio': { text: '选项 A', checked: true },
  'el-date-picker': { placeholder: '选择日期' },
  'el-time-picker': { placeholder: '选择时间' },
  'el-upload': { text: '点击上传' },
  'el-card': { title: '卡片标题', text: '这里是卡片内容描述。' },
  'el-table': { title: '数据表格' },
  'el-tag': { text: '标签', tagColor: 'primary' },
  'el-badge': { text: '消息', count: 5 },
  'el-avatar': { text: '用' },
  'el-alert': { title: '提示信息', text: '这是一条成功提示', variant: 'success' },
  'el-progress': { percent: 60 },
  'el-loading': {},
  'el-empty': { text: '暂无数据' },
  'el-divider': { text: '分割线' },
  'el-breadcrumb': { text: '首页 / 列表 / 详情' },
  'el-tabs': { options: '概览,详情,设置', text: '概览' },
  'el-pagination': { value: 1 },
  'el-steps': { options: '填写信息,确认提交,完成', value: 1 },
  'el-timeline': { options: '创建项目,提交审核,发布上线' },
  'el-collapse': { title: '折叠面板', text: '展开后的内容区域' },
  'el-statistic': { title: '访问量', value: 112893 },
  'el-segmented': { options: '日,周,月', text: '日' },
  'el-descriptions': { title: '用户信息', text: '姓名:张三,手机:13800000000,城市:上海' },
  'el-link': { text: '查看详情', variant: 'primary' },
  'el-text': { text: '正文文本' },
}

export const TYPE_LABELS: Record<NodeType, string> = {
  frame: '画板',
  rect: '矩形',
  text: '文本',
  image: '图片',
  button: '按钮',
  input: '输入框',

  'antd-button': '按钮',
  'antd-input': '输入框',
  'antd-textarea': '文本域',
  'antd-input-number': '数字输入',
  'antd-select': '选择器',
  'antd-cascader': '级联选择',
  'antd-switch': '开关',
  'antd-slider': '滑动条',
  'antd-rate': '评分',
  'antd-checkbox': '复选框',
  'antd-radio': '单选框',
  'antd-date-picker': '日期选择',
  'antd-time-picker': '时间选择',
  'antd-upload': '上传',
  'antd-card': '卡片',
  'antd-table': '表格',
  'antd-list': '列表',
  'antd-tag': '标签',
  'antd-badge': '徽标数',
  'antd-avatar': '头像',
  'antd-alert': '警告提示',
  'antd-progress': '进度条',
  'antd-spin': '加载中',
  'antd-empty': '空状态',
  'antd-divider': '分割线',
  'antd-breadcrumb': '面包屑',
  'antd-tabs': '标签页',
  'antd-pagination': '分页',
  'antd-steps': '步骤条',
  'antd-timeline': '时间轴',
  'antd-collapse': '折叠面板',
  'antd-statistic': '统计数值',
  'antd-segmented': '分段控制器',
  'antd-descriptions': '描述列表',

  'el-button': '按钮',
  'el-input': '输入框',
  'el-textarea': '文本域',
  'el-input-number': '数字输入',
  'el-select': '选择器',
  'el-cascader': '级联选择',
  'el-switch': '开关',
  'el-slider': '滑动条',
  'el-rate': '评分',
  'el-checkbox': '复选框',
  'el-radio': '单选框',
  'el-date-picker': '日期选择',
  'el-time-picker': '时间选择',
  'el-upload': '上传',
  'el-card': '卡片',
  'el-table': '表格',
  'el-tag': '标签',
  'el-badge': '徽标',
  'el-avatar': '头像',
  'el-alert': '警告',
  'el-progress': '进度条',
  'el-loading': '加载',
  'el-empty': '空状态',
  'el-divider': '分割线',
  'el-breadcrumb': '面包屑',
  'el-tabs': '标签页',
  'el-pagination': '分页',
  'el-steps': '步骤条',
  'el-timeline': '时间线',
  'el-collapse': '折叠面板',
  'el-statistic': '统计数值',
  'el-segmented': '分段控制',
  'el-descriptions': '描述列表',
  'el-link': '链接',
  'el-text': '文本',
}

export const BASIC_TYPES: NodeType[] = ['rect', 'text', 'image', 'button', 'input']

export const ANTD_TYPES: NodeType[] = [
  'antd-button',
  'antd-input',
  'antd-textarea',
  'antd-input-number',
  'antd-select',
  'antd-cascader',
  'antd-switch',
  'antd-slider',
  'antd-rate',
  'antd-checkbox',
  'antd-radio',
  'antd-date-picker',
  'antd-time-picker',
  'antd-upload',
  'antd-card',
  'antd-table',
  'antd-list',
  'antd-tag',
  'antd-badge',
  'antd-avatar',
  'antd-alert',
  'antd-progress',
  'antd-spin',
  'antd-empty',
  'antd-divider',
  'antd-breadcrumb',
  'antd-tabs',
  'antd-pagination',
  'antd-steps',
  'antd-timeline',
  'antd-collapse',
  'antd-statistic',
  'antd-segmented',
  'antd-descriptions',
]

export const ELEMENT_TYPES: NodeType[] = [
  'el-button',
  'el-input',
  'el-textarea',
  'el-input-number',
  'el-select',
  'el-cascader',
  'el-switch',
  'el-slider',
  'el-rate',
  'el-checkbox',
  'el-radio',
  'el-date-picker',
  'el-time-picker',
  'el-upload',
  'el-card',
  'el-table',
  'el-tag',
  'el-badge',
  'el-avatar',
  'el-alert',
  'el-progress',
  'el-loading',
  'el-empty',
  'el-divider',
  'el-breadcrumb',
  'el-tabs',
  'el-pagination',
  'el-steps',
  'el-timeline',
  'el-collapse',
  'el-statistic',
  'el-segmented',
  'el-descriptions',
  'el-link',
  'el-text',
]

export function isAntdType(type: NodeType): boolean {
  return type.startsWith('antd-')
}

export function isElementType(type: NodeType): boolean {
  return type.startsWith('el-')
}

export function isLibraryComponent(type: NodeType): boolean {
  return isAntdType(type) || isElementType(type)
}

export function createNode(type: NodeType, overrides: Partial<UINode> = {}): UINode {
  const size = DEFAULT_SIZE[type] ?? (isLibraryComponent(type) ? defaultLibSize(type) : { width: 120, height: 40 })
  const libStyle = isLibraryComponent(type)
    ? { backgroundColor: 'transparent' }
    : (DEFAULT_STYLES[type] ?? { backgroundColor: 'transparent' })
  return {
    id: uuid(),
    type,
    name: TYPE_LABELS[type],
    x: 40,
    y: 40,
    width: size.width,
    height: size.height,
    style: { ...libStyle },
    props: { ...(DEFAULT_PROPS[type] ?? {}) },
    children: type === 'frame' ? [] : undefined,
    visible: true,
    locked: false,
    ...overrides,
  }
}

export function createDefaultDocument(name = '页面 1'): EditorDocument {
  const vp = findViewport(DEFAULT_VIEWPORT_ID)
  const root = createNode('frame', {
    name: '画布',
    x: 0,
    y: 0,
    width: vp.width,
    height: vp.height,
    style: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    children: [],
  })

  const meta: DocumentMeta = {
    id: uuid(),
    name,
    width: vp.width,
    height: vp.height,
    backgroundColor: '#0b0c10',
    viewportId: vp.id,
  }

  return { meta, root }
}

export function cloneNode(node: UINode): UINode {
  return {
    ...node,
    id: uuid(),
    style: { ...node.style },
    props: node.props ? { ...node.props } : undefined,
    children: node.children?.map(cloneNode),
  }
}

export function findNode(root: UINode, id: string): UINode | null {
  if (root.id === id) return root
  if (!root.children) return null
  for (const child of root.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

export function findParent(root: UINode, id: string): UINode | null {
  if (!root.children) return null
  for (const child of root.children) {
    if (child.id === id) return root
    const found = findParent(child, id)
    if (found) return found
  }
  return null
}

/** 节点相对画板的绝对坐标 */
export function getAbsolutePos(
  root: UINode,
  id: string,
): { x: number; y: number } | null {
  const path: UINode[] = []
  function walk(node: UINode, trail: UINode[]): boolean {
    if (node.id === id) {
      path.push(...trail, node)
      return true
    }
    for (const c of node.children ?? []) {
      if (walk(c, [...trail, node])) return true
    }
    return false
  }
  if (!walk(root, [])) return null
  let x = 0
  let y = 0
  for (let i = 1; i < path.length; i++) {
    x += path[i].x
    y += path[i].y
  }
  return { x, y }
}

/** ancestorId 是否为 nodeId 的祖先（含自身） */
export function isAncestorOf(root: UINode, ancestorId: string, nodeId: string): boolean {
  if (ancestorId === nodeId) return true
  let cur = findParent(root, nodeId)
  while (cur) {
    if (cur.id === ancestorId) return true
    cur = findParent(root, cur.id)
  }
  return false
}

/**
 * 将节点移动到新父节点下的指定位置，并换算相对坐标。
 * 禁止移动根节点，禁止拖入自身或子孙（防止环）。
 */
export function moveNodeInTree(
  root: UINode,
  nodeId: string,
  newParentId: string,
  index: number,
): UINode | null {
  if (nodeId === root.id) return null
  if (nodeId === newParentId) return null
  if (isAncestorOf(root, nodeId, newParentId)) return null

  const node = findNode(root, nodeId)
  const oldParent = findParent(root, nodeId)
  const newParent = findNode(root, newParentId)
  if (!node || !oldParent || !newParent) return null

  const abs = getAbsolutePos(root, nodeId)
  if (!abs) return null
  const parentAbs =
    newParentId === root.id ? { x: 0, y: 0 } : getAbsolutePos(root, newParentId)
  if (!parentAbs) return null

  const moved: UINode = {
    ...node,
    x: Math.round(abs.x - parentAbs.x),
    y: Math.round(abs.y - parentAbs.y),
  }

  // index 表示「节点已从原位置移除后」在新父 children 中的插入下标
  let next = removeNodeFromTree(root, nodeId)
  next = updateNodeInTree(next, newParentId, (p) => {
    const children = [...(p.children ?? [])]
    const to = Math.max(0, Math.min(index, children.length))
    children.splice(to, 0, moved)
    return { ...p, children }
  })
  return next
}

export function updateNodeInTree(
  root: UINode,
  id: string,
  updater: (node: UINode) => UINode,
): UINode {
  if (root.id === id) return updater(root)
  if (!root.children) return root
  return {
    ...root,
    children: root.children.map((c) => updateNodeInTree(c, id, updater)),
  }
}

export function removeNodeFromTree(root: UINode, id: string): UINode {
  if (!root.children) return root
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== id)
      .map((c) => removeNodeFromTree(c, id)),
  }
}

export function flattenNodes(root: UINode): UINode[] {
  const result: UINode[] = [root]
  if (root.children) {
    for (const child of root.children) {
      result.push(...flattenNodes(child))
    }
  }
  return result
}

export function parseOptions(raw?: string): string[] {
  if (!raw?.trim()) return []
  return raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
}
