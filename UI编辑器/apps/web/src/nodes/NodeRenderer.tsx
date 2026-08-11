import type { UINode } from '../schema/types'
import { isAntdType, isElementType } from '../schema/defaults'
import { nodeBoxStyle } from '../schema/styleUtils'
import { useEditorStore } from '../store/editorStore'
import { AntdNodeContent, ElementNodeContent } from './LibraryNodes'
import './NodeRenderer.css'

interface Props {
  node: UINode
  isRoot?: boolean
}

export function NodeRenderer({ node, isRoot = false }: Props) {
  const selectedId = useEditorStore((s) => s.selectedId)
  const selected = selectedId === node.id

  const box = nodeBoxStyle(node, isRoot)
  const className = [
    'ui-node',
    `ui-node--${node.type}`,
    selected ? 'ui-node--selected' : '',
    isRoot ? 'ui-node--root' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} style={box} data-node-id={node.id}>
      {renderContent(node)}
      {node.children?.map((child) => (
        <NodeRenderer key={child.id} node={child} />
      ))}
    </div>
  )
}

function renderContent(node: UINode) {
  if (isAntdType(node.type)) return <AntdNodeContent node={node} />
  if (isElementType(node.type)) return <ElementNodeContent node={node} />

  switch (node.type) {
    case 'text':
      return <div className="ui-node__text">{node.props?.text ?? ''}</div>
    case 'rect':
      return null
    case 'button':
      return <div className="ui-node__button">{node.props?.text ?? '按钮'}</div>
    case 'input':
      return <div className="ui-node__input">{node.props?.placeholder ?? '请输入…'}</div>
    case 'image':
      return node.props?.src ? (
        <img
          className="ui-node__img"
          src={node.props.src}
          alt={node.props.alt ?? ''}
          draggable={false}
          style={{
            objectFit: node.style.objectFit ?? 'cover',
            objectPosition: node.style.objectPosition ?? 'center',
          }}
        />
      ) : (
        <div className="ui-node__img-placeholder">图片</div>
      )
    default:
      return null
  }
}
