import { useState } from 'react'
import type { StyleProps, UINode } from '../schema/types'
import { findNode } from '../schema/defaults'
import { useEditorStore } from '../store/editorStore'
import { uploadProjectAssets } from '../api/projects'
import './RightPanel.css'

type RightTab = 'props' | 'lanhu' | 'ref'

const SAMPLE = `width: 120px;
height: 40px;
background: #1677FF;
border-radius: 8px;
font-size: 14px;
font-weight: 500;
color: #FFFFFF;
text-align: center;
line-height: 20px;`

const SHADOW_PRESETS: { label: string; value: string }[] = [
  { label: '无', value: '' },
  { label: '轻', value: '0 1px 3px rgba(0,0,0,0.12)' },
  { label: '中', value: '0 4px 12px rgba(0,0,0,0.16)' },
  { label: '重', value: '0 8px 24px rgba(0,0,0,0.24)' },
  { label: '内阴影', value: 'inset 0 1px 3px rgba(0,0,0,0.2)' },
]

export function RightPanel() {
  const doc = useEditorStore((s) => s.doc)
  const selectedId = useEditorStore((s) => s.selectedId)
  const updateNode = useEditorStore((s) => s.updateNode)
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle)
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps)
  const applyLanhuCss = useEditorStore((s) => s.applyLanhuCss)
  const refLayer = useEditorStore((s) => s.refLayer)
  const setRefLayer = useEditorStore((s) => s.setRefLayer)
  const updateRefLayer = useEditorStore((s) => s.updateRefLayer)
  const projectId = useEditorStore((s) => s.projectId)
  const setAssets = useEditorStore((s) => s.setAssets)
  const [tab, setTab] = useState<RightTab>('props')
  const [cssText, setCssText] = useState('')
  const [cssMsg, setCssMsg] = useState<string | null>(null)
  const [bgUploading, setBgUploading] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)

  const node = selectedId ? findNode(doc.root, selectedId) : null

  const onRefUpload = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRefLayer({
        src: String(reader.result),
        opacity: 0.45,
        visible: true,
        offsetX: 0,
        offsetY: 0,
      })
    }
    reader.readAsDataURL(file)
  }

  const onApplyCss = () => {
    const result = applyLanhuCss(cssText)
    setCssMsg(result.message)
  }

  const setStyle = (patch: Partial<StyleProps>) => {
    if (!node) return
    updateNodeStyle(node.id, patch)
  }

  return (
    <aside className="right-panel">
      <div className="side-tabs side-tabs--3" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === 'props' ? 'is-active' : ''}
          aria-selected={tab === 'props'}
          onClick={() => setTab('props')}
        >
          属性
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'lanhu' ? 'is-active' : ''}
          aria-selected={tab === 'lanhu'}
          onClick={() => setTab('lanhu')}
        >
          蓝湖CSS
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'ref' ? 'is-active' : ''}
          aria-selected={tab === 'ref'}
          onClick={() => setTab('ref')}
        >
          参考层
        </button>
      </div>

      <div className="right-panel__scroll thin-scroll">
        {tab === 'props' ? (
          !node ? (
            <p className="panel-empty">选择画布上的元素进行编辑</p>
          ) : (
            <div className="prop-form">
              <Section title="基础">
                <label className="prop-field">
                  <span>名称</span>
                  <input
                    value={node.name}
                    onChange={(e) => updateNode(node.id, { name: e.target.value })}
                  />
                </label>
                <div className="prop-row">
                  <NumField
                    label="X"
                    value={node.x}
                    onChange={(v) => updateNode(node.id, { x: v })}
                  />
                  <NumField
                    label="Y"
                    value={node.y}
                    onChange={(v) => updateNode(node.id, { y: v })}
                  />
                </div>
                <div className="prop-row">
                  <NumField
                    label="宽"
                    value={node.width}
                    onChange={(v) => updateNode(node.id, { width: v })}
                  />
                  <NumField
                    label="高"
                    value={node.height}
                    onChange={(v) => updateNode(node.id, { height: v })}
                  />
                </div>
                <label className="prop-field">
                  <span>透明度 {Math.round((node.style.opacity ?? 1) * 100)}%</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={node.style.opacity ?? 1}
                    onChange={(e) => setStyle({ opacity: Number(e.target.value) })}
                  />
                </label>
                <NumField
                  label="层级 z-index"
                  value={node.style.zIndex ?? 0}
                  onChange={(v) => setStyle({ zIndex: v })}
                />
                <label className="prop-check">
                  <input
                    type="checkbox"
                    checked={node.visible !== false}
                    onChange={(e) => updateNode(node.id, { visible: e.target.checked })}
                  />
                  显示
                </label>
                <label className="prop-check">
                  <input
                    type="checkbox"
                    checked={!!node.locked}
                    onChange={(e) => updateNode(node.id, { locked: e.target.checked })}
                  />
                  锁定
                </label>
              </Section>

              <ContentProps node={node} />

              <Section title="背景">
                <ColorField
                  label="背景色"
                  value={node.style.backgroundColor}
                  allowTransparent
                  onChange={(v) => setStyle({ backgroundColor: v })}
                />
                <label className="prop-field">
                  <span>背景图 URL</span>
                  <input
                    placeholder="https://… 或 /api/files/…"
                    value={node.style.backgroundImage ?? ''}
                    onChange={(e) =>
                      setStyle({ backgroundImage: e.target.value || undefined })
                    }
                  />
                </label>
                <label className="prop-field">
                  <span>上传背景图</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={bgUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const applyUrl = (url: string) =>
                        setStyle({
                          backgroundImage: url,
                          backgroundSize: node.style.backgroundSize ?? 'cover',
                          backgroundPosition: node.style.backgroundPosition ?? 'center',
                          backgroundRepeat: node.style.backgroundRepeat ?? 'no-repeat',
                        })
                      if (projectId) {
                        setBgUploading(true)
                        void uploadProjectAssets(projectId, [file])
                          .then((result) => {
                            setAssets(result.assets)
                            const url = result.added[0]?.url
                            if (url) applyUrl(url)
                          })
                          .finally(() => {
                            setBgUploading(false)
                            e.target.value = ''
                          })
                      } else {
                        const reader = new FileReader()
                        reader.onload = () => applyUrl(String(reader.result))
                        reader.readAsDataURL(file)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
                {node.style.backgroundImage ? (
                  <>
                    <label className="prop-field">
                      <span>背景图铺满</span>
                      <select
                        value={node.style.backgroundSize ?? 'cover'}
                        onChange={(e) => setStyle({ backgroundSize: e.target.value })}
                      >
                        <option value="cover">cover 裁剪铺满</option>
                        <option value="contain">contain 完整显示</option>
                        <option value="100% 100%">拉伸铺满</option>
                        <option value="auto">auto 原始尺寸</option>
                      </select>
                    </label>
                    <label className="prop-field">
                      <span>背景图位置</span>
                      <select
                        value={node.style.backgroundPosition ?? 'center'}
                        onChange={(e) => setStyle({ backgroundPosition: e.target.value })}
                      >
                        <option value="center">居中</option>
                        <option value="top">顶部</option>
                        <option value="bottom">底部</option>
                        <option value="left">左侧</option>
                        <option value="right">右侧</option>
                        <option value="left top">左上</option>
                        <option value="right top">右上</option>
                        <option value="left bottom">左下</option>
                        <option value="right bottom">右下</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="prop-clear-btn"
                      onClick={() =>
                        setStyle({
                          backgroundImage: undefined,
                          backgroundSize: undefined,
                          backgroundPosition: undefined,
                          backgroundRepeat: undefined,
                        })
                      }
                    >
                      清除背景图
                    </button>
                  </>
                ) : null}
                <label className="prop-field">
                  <span>背景（渐变/完整 CSS）</span>
                  <input
                    placeholder="linear-gradient(...)"
                    value={node.style.background ?? ''}
                    onChange={(e) =>
                      setStyle({ background: e.target.value || undefined })
                    }
                  />
                </label>
              </Section>

              <Section title="边框">
                <div className="prop-row">
                  <NumField
                    label="边框宽度"
                    value={node.style.borderWidth ?? 0}
                    onChange={(v) => setStyle({ borderWidth: v })}
                  />
                  <label className="prop-field">
                    <span>边框样式</span>
                    <select
                      value={node.style.borderStyle ?? (node.style.borderWidth ? 'solid' : 'none')}
                      onChange={(e) => setStyle({ borderStyle: e.target.value })}
                    >
                      <option value="none">none</option>
                      <option value="solid">solid</option>
                      <option value="dashed">dashed</option>
                      <option value="dotted">dotted</option>
                      <option value="double">double</option>
                    </select>
                  </label>
                </div>
                <ColorField
                  label="边框颜色"
                  value={node.style.borderColor}
                  onChange={(v) => setStyle({ borderColor: v })}
                />
                <NumField
                  label="圆角"
                  value={node.style.borderRadius ?? 0}
                  onChange={(v) => setStyle({ borderRadius: v })}
                />
              </Section>

              <Section title="阴影">
                <label className="prop-field">
                  <span>预设</span>
                  <select
                    value={
                      SHADOW_PRESETS.find((p) => p.value === (node.style.boxShadow ?? ''))
                        ?.value ?? '__custom__'
                    }
                    onChange={(e) => {
                      if (e.target.value === '__custom__') return
                      setStyle({ boxShadow: e.target.value || undefined })
                    }}
                  >
                    {SHADOW_PRESETS.map((p) => (
                      <option key={p.label} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                    <option value="__custom__">自定义</option>
                  </select>
                </label>
                <label className="prop-field">
                  <span>box-shadow</span>
                  <input
                    placeholder="0 4px 12px rgba(0,0,0,0.16)"
                    value={node.style.boxShadow ?? ''}
                    onChange={(e) =>
                      setStyle({ boxShadow: e.target.value || undefined })
                    }
                  />
                </label>
              </Section>

              <Section title="间距 / 溢出">
                <div className="prop-row">
                  <NumField
                    label="内边距 padding"
                    value={node.style.padding ?? 0}
                    onChange={(v) => setStyle({ padding: v })}
                  />
                  <NumField
                    label="外边距 margin"
                    value={node.style.margin ?? 0}
                    onChange={(v) => setStyle({ margin: v })}
                  />
                </div>
                <label className="prop-field">
                  <span>溢出 overflow</span>
                  <select
                    value={node.style.overflow ?? 'visible'}
                    onChange={(e) =>
                      setStyle({
                        overflow: e.target.value === 'visible' ? undefined : e.target.value,
                      })
                    }
                  >
                    <option value="visible">visible</option>
                    <option value="hidden">hidden</option>
                    <option value="auto">auto</option>
                    <option value="scroll">scroll</option>
                  </select>
                </label>
              </Section>

              {showTextStyle(node) ? (
                <Section title="文字">
                  <ColorField
                    label="文字色"
                    value={node.style.color}
                    onChange={(v) => setStyle({ color: v })}
                  />
                  <div className="prop-row">
                    <NumField
                      label="字号"
                      value={Number(node.style.fontSize ?? 14)}
                      onChange={(v) => setStyle({ fontSize: v })}
                    />
                    <label className="prop-field">
                      <span>字重</span>
                      <select
                        value={String(node.style.fontWeight ?? 400)}
                        onChange={(e) =>
                          setStyle({
                            fontWeight: Number.isFinite(Number(e.target.value))
                              ? Number(e.target.value)
                              : e.target.value,
                          })
                        }
                      >
                        <option value="300">细 300</option>
                        <option value="400">常规 400</option>
                        <option value="500">中等 500</option>
                        <option value="600">半粗 600</option>
                        <option value="700">粗体 700</option>
                      </select>
                    </label>
                  </div>
                  <label className="prop-field">
                    <span>字体</span>
                    <input
                      value={node.style.fontFamily ?? ''}
                      placeholder="system-ui, sans-serif"
                      onChange={(e) =>
                        setStyle({ fontFamily: e.target.value || undefined })
                      }
                    />
                  </label>
                  <div className="prop-row">
                    <NumField
                      label="行高"
                      value={
                        typeof node.style.lineHeight === 'number'
                          ? node.style.lineHeight
                          : Number(node.style.lineHeight) || 20
                      }
                      onChange={(v) => setStyle({ lineHeight: v })}
                    />
                    <NumField
                      label="字距"
                      value={node.style.letterSpacing ?? 0}
                      onChange={(v) => setStyle({ letterSpacing: v })}
                    />
                  </div>
                  <label className="prop-field">
                    <span>对齐</span>
                    <select
                      value={node.style.textAlign ?? 'left'}
                      onChange={(e) =>
                        setStyle({
                          textAlign: e.target.value as StyleProps['textAlign'],
                        })
                      }
                    >
                      <option value="left">左对齐</option>
                      <option value="center">居中</option>
                      <option value="right">右对齐</option>
                    </select>
                  </label>
                </Section>
              ) : null}

              {node.type === 'image' ? (
                <Section title="图片">
                  <label className="prop-field">
                    <span>图片 URL</span>
                    <input
                      value={node.props?.src ?? ''}
                      onChange={(e) => updateNodeProps(node.id, { src: e.target.value })}
                    />
                  </label>
                  <label className="prop-field">
                    <span>本地上传</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!projectId || imgUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file || !projectId) return
                        setImgUploading(true)
                        void uploadProjectAssets(projectId, [file])
                          .then((result) => {
                            setAssets(result.assets)
                            const url = result.added[0]?.url
                            if (url) updateNodeProps(node.id, { src: url })
                          })
                          .finally(() => {
                            setImgUploading(false)
                            e.target.value = ''
                          })
                      }}
                    />
                    {!projectId ? (
                      <span className="prop-hint">需在项目中打开后才能上传到后台</span>
                    ) : imgUploading ? (
                      <span className="prop-hint">上传中…</span>
                    ) : null}
                  </label>
                  <label className="prop-field">
                    <span>替代文本 alt</span>
                    <input
                      value={node.props?.alt ?? ''}
                      onChange={(e) => updateNodeProps(node.id, { alt: e.target.value })}
                    />
                  </label>
                  <label className="prop-field">
                    <span>铺满方式 object-fit</span>
                    <select
                      value={node.style.objectFit ?? 'cover'}
                      onChange={(e) =>
                        setStyle({
                          objectFit: e.target.value as StyleProps['objectFit'],
                        })
                      }
                    >
                      <option value="cover">cover 裁剪铺满</option>
                      <option value="contain">contain 完整显示</option>
                      <option value="fill">fill 拉伸铺满</option>
                      <option value="none">none 原始尺寸</option>
                      <option value="scale-down">scale-down 缩小适应</option>
                    </select>
                  </label>
                  <label className="prop-field">
                    <span>定位 object-position</span>
                    <select
                      value={node.style.objectPosition ?? 'center'}
                      onChange={(e) => setStyle({ objectPosition: e.target.value })}
                    >
                      <option value="center">居中</option>
                      <option value="top">顶部</option>
                      <option value="bottom">底部</option>
                      <option value="left">左侧</option>
                      <option value="right">右侧</option>
                      <option value="left top">左上</option>
                      <option value="right top">右上</option>
                      <option value="left bottom">左下</option>
                      <option value="right bottom">右下</option>
                    </select>
                  </label>
                  <label className="prop-field">
                    <span>自定义定位</span>
                    <input
                      placeholder="50% 50%"
                      value={node.style.objectPosition ?? ''}
                      onChange={(e) =>
                        setStyle({ objectPosition: e.target.value || undefined })
                      }
                    />
                  </label>
                </Section>
              ) : null}
            </div>
          )
        ) : tab === 'lanhu' ? (
          <div className="prop-form">
            <p className="panel-hint">
              在蓝湖选中图层，复制右侧 CSS 代码粘贴到下方，将样式应用到当前选中元素。
            </p>
            {!node ? (
              <p className="panel-empty">请先在画布上选中一个元素</p>
            ) : (
              <p className="panel-hint">
                当前目标：<strong>{node.name}</strong>（{node.type}）
              </p>
            )}
            <label className="prop-field">
              <span>蓝湖 CSS</span>
              <textarea
                className="lanhu-css-input"
                rows={14}
                placeholder={SAMPLE}
                value={cssText}
                onChange={(e) => {
                  setCssText(e.target.value)
                  setCssMsg(null)
                }}
              />
            </label>
            <div className="lanhu-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setCssText(SAMPLE)
                  setCssMsg(null)
                }}
              >
                填入示例
              </button>
              <button
                type="button"
                className="btn-apply"
                disabled={!cssText.trim() || !node}
                onClick={onApplyCss}
              >
                应用到选中元素
              </button>
            </div>
            {cssMsg ? (
              <p
                className={`lanhu-msg${
                  cssMsg.includes('未') || cssMsg.includes('请先') ? ' is-error' : ' is-ok'
                }`}
              >
                {cssMsg}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="prop-form">
            <p className="panel-hint">上传蓝湖切图或设计截图，半透明叠加对照</p>
            <label className="prop-field">
              <span>上传图片</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onRefUpload(e.target.files?.[0] ?? null)}
              />
            </label>
            {refLayer ? (
              <>
                <label className="prop-check">
                  <input
                    type="checkbox"
                    checked={refLayer.visible}
                    onChange={(e) => updateRefLayer({ visible: e.target.checked })}
                  />
                  显示参考层
                </label>
                <label className="prop-field">
                  <span>透明度 {Math.round(refLayer.opacity * 100)}%</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={refLayer.opacity}
                    onChange={(e) => updateRefLayer({ opacity: Number(e.target.value) })}
                  />
                </label>
                <button type="button" className="btn-secondary" onClick={() => setRefLayer(null)}>
                  清除参考层
                </button>
              </>
            ) : (
              <p className="panel-empty">尚未上传参考图</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="prop-section">
      <h3 className="prop-section__title">{title}</h3>
      <div className="prop-section__body">{children}</div>
    </section>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="prop-field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
  allowTransparent = false,
}: {
  label: string
  value?: string
  onChange: (v: string | undefined) => void
  allowTransparent?: boolean
}) {
  const transparent = !value || value === 'transparent'
  return (
    <div className="prop-color">
      <label className="prop-field">
        <span>{label}</span>
        <input
          type="color"
          disabled={transparent && allowTransparent}
          value={normalizeColor(value) || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {allowTransparent ? (
        <label className="prop-check">
          <input
            type="checkbox"
            checked={transparent}
            onChange={(e) => onChange(e.target.checked ? 'transparent' : '#ffffff')}
          />
          透明
        </label>
      ) : null}
    </div>
  )
}

function ContentProps({ node }: { node: UINode }) {
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps)
  const hasText =
    node.type === 'text' ||
    node.type === 'button' ||
    node.type.includes('button') ||
    node.type.includes('tag') ||
    node.type.includes('checkbox') ||
    node.type.includes('radio') ||
    node.type.includes('card') ||
    node.type.includes('link') ||
    node.type === 'el-text'

  const hasPlaceholder =
    node.type === 'input' ||
    node.type.includes('input') ||
    node.type.includes('select') ||
    node.type.includes('date') ||
    node.type.includes('textarea')

  if (
    !hasText &&
    !hasPlaceholder &&
    !node.type.includes('select') &&
    !node.type.includes('card') &&
    !node.type.includes('table') &&
    !node.type.includes('button') &&
    !node.type.includes('switch') &&
    !node.type.includes('checkbox') &&
    !node.type.includes('radio')
  ) {
    return null
  }

  return (
    <Section title="内容">
      {hasText ? (
        <label className="prop-field">
          <span>文案</span>
          <textarea
            rows={3}
            value={node.props?.text ?? ''}
            onChange={(e) => updateNodeProps(node.id, { text: e.target.value })}
          />
        </label>
      ) : null}

      {hasPlaceholder ? (
        <label className="prop-field">
          <span>占位符</span>
          <input
            value={node.props?.placeholder ?? ''}
            onChange={(e) => updateNodeProps(node.id, { placeholder: e.target.value })}
          />
        </label>
      ) : null}

      {node.type.includes('select') ? (
        <label className="prop-field">
          <span>选项（逗号分隔）</span>
          <input
            value={node.props?.options ?? ''}
            onChange={(e) => updateNodeProps(node.id, { options: e.target.value })}
          />
        </label>
      ) : null}

      {(node.type.includes('card') || node.type.includes('table')) && (
        <label className="prop-field">
          <span>标题</span>
          <input
            value={node.props?.title ?? ''}
            onChange={(e) => updateNodeProps(node.id, { title: e.target.value })}
          />
        </label>
      )}

      {node.type.includes('button') ? (
        <label className="prop-field">
          <span>类型 variant</span>
          <select
            value={node.props?.variant ?? 'primary'}
            onChange={(e) =>
              updateNodeProps(node.id, {
                variant: e.target.value as NonNullable<typeof node.props>['variant'],
              })
            }
          >
            <option value="primary">primary</option>
            <option value="default">default</option>
            <option value="dashed">dashed</option>
            <option value="text">text</option>
            <option value="link">link</option>
            <option value="success">success</option>
            <option value="warning">warning</option>
            <option value="danger">danger</option>
            <option value="info">info</option>
          </select>
        </label>
      ) : null}

      {(node.type.includes('switch') ||
        node.type.includes('checkbox') ||
        node.type.includes('radio')) && (
        <label className="prop-check">
          <input
            type="checkbox"
            checked={!!node.props?.checked}
            onChange={(e) => updateNodeProps(node.id, { checked: e.target.checked })}
          />
          选中状态
        </label>
      )}
    </Section>
  )
}

function showTextStyle(node: UINode) {
  return (
    node.type === 'text' ||
    node.type === 'button' ||
    node.type === 'input' ||
    node.type.includes('button') ||
    node.type.includes('tag') ||
    node.type.includes('link') ||
    node.type === 'el-text' ||
    node.type.includes('input') ||
    node.type.includes('select')
  )
}

function normalizeColor(c?: string): string {
  if (!c || c === 'transparent') return ''
  if (c.startsWith('#') && (c.length === 7 || c.length === 4))
    return c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c
  return '#ffffff'
}
