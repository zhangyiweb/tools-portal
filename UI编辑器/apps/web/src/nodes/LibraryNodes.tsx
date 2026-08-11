import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Cascader,
  Checkbox,
  Collapse,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Input,
  InputNumber,
  List,
  Pagination,
  Progress,
  Radio,
  Rate,
  Segmented,
  Select,
  Slider,
  Spin,
  Statistic,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Timeline,
  Upload,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UINode } from '../schema/types'
import { parseOptions } from '../schema/defaults'
import './LibraryNodes.css'

const TABLE_COLUMNS = [
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '年龄', dataIndex: 'age', key: 'age' },
  { title: '地址', dataIndex: 'address', key: 'address' },
]

const TABLE_DATA = [
  { key: '1', name: '张三', age: 28, address: '上海' },
  { key: '2', name: '李四', age: 32, address: '北京' },
]

export function AntdNodeContent({ node }: { node: UINode }) {
  const p = node.props ?? {}
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const opts = parseOptions(p.options)

  switch (node.type) {
    case 'antd-button':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Button
            type={mapAntdButtonType(p.variant)}
            size={p.size === 'large' || p.size === 'small' || p.size === 'middle' ? p.size : 'middle'}
            disabled={p.disabled}
            block
            style={{ height: '100%' }}
          >
            {p.text ?? '按钮'}
          </Button>
        </div>
      )
    case 'antd-input':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Input placeholder={p.placeholder} disabled={p.disabled} style={{ height: '100%' }} />
        </div>
      )
    case 'antd-textarea':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Input.TextArea placeholder={p.placeholder} disabled={p.disabled} style={{ height: '100%', resize: 'none' }} />
        </div>
      )
    case 'antd-input-number':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <InputNumber style={{ width: '100%', height: '100%' }} defaultValue={p.value ?? 1} disabled={p.disabled} />
        </div>
      )
    case 'antd-select':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Select
            placeholder={p.placeholder}
            disabled={p.disabled}
            style={{ width: '100%' }}
            options={(opts.length ? opts : ['选项一', '选项二']).map((o) => ({ value: o, label: o }))}
          />
        </div>
      )
    case 'antd-cascader':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Cascader
            placeholder={p.placeholder}
            style={{ width: '100%' }}
            options={[
              { value: 'zhejiang', label: '浙江', children: [{ value: 'hangzhou', label: '杭州' }] },
              { value: 'jiangsu', label: '江苏', children: [{ value: 'nanjing', label: '南京' }] },
            ]}
          />
        </div>
      )
    case 'antd-switch':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Switch checked={!!p.checked} disabled={p.disabled} />
        </div>
      )
    case 'antd-slider':
      return (
        <div className="lib-center lib-pad" onPointerDown={stop}>
          <Slider defaultValue={p.value ?? 40} style={{ width: '100%' }} />
        </div>
      )
    case 'antd-rate':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Rate defaultValue={p.value ?? 3} />
        </div>
      )
    case 'antd-checkbox':
      return (
        <div className="lib-center lib-start" onPointerDown={stop}>
          <Checkbox checked={!!p.checked} disabled={p.disabled}>{p.text ?? '复选框'}</Checkbox>
        </div>
      )
    case 'antd-radio':
      return (
        <div className="lib-center lib-start" onPointerDown={stop}>
          <Radio checked={!!p.checked} disabled={p.disabled}>{p.text ?? '单选框'}</Radio>
        </div>
      )
    case 'antd-date-picker':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <DatePicker placeholder={p.placeholder} style={{ width: '100%', height: '100%' }} />
        </div>
      )
    case 'antd-time-picker':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <TimePicker placeholder={p.placeholder} style={{ width: '100%', height: '100%' }} />
        </div>
      )
    case 'antd-upload':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Upload showUploadList={false}><Button icon={<UploadOutlined />}>{p.text ?? '点击上传'}</Button></Upload>
        </div>
      )
    case 'antd-card':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Card title={p.title ?? '卡片'} size="small" style={{ height: '100%', overflow: 'hidden' }}>
            {p.text ?? ''}
          </Card>
        </div>
      )
    case 'antd-table':
      return (
        <div className="lib-fill lib-scroll" onPointerDown={stop}>
          <Table size="small" pagination={false} columns={TABLE_COLUMNS} dataSource={TABLE_DATA} />
        </div>
      )
    case 'antd-list':
      return (
        <div className="lib-fill lib-scroll" onPointerDown={stop}>
          <List
            size="small"
            header={p.title}
            dataSource={opts.length ? opts : ['列表项一', '列表项二', '列表项三']}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </div>
      )
    case 'antd-tag':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Tag color={p.tagColor || 'blue'}>{p.text ?? '标签'}</Tag>
        </div>
      )
    case 'antd-badge':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Badge count={p.count ?? 5}><Avatar shape="square" size="large">{p.text?.[0] ?? '消'}</Avatar></Badge>
        </div>
      )
    case 'antd-avatar':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Avatar size="large">{p.text ?? '用'}</Avatar>
        </div>
      )
    case 'antd-alert':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Alert
            message={p.title ?? '提示'}
            description={p.text}
            type={mapAlertType(p.variant)}
            showIcon
            style={{ height: '100%' }}
          />
        </div>
      )
    case 'antd-progress':
      return (
        <div className="lib-center lib-pad" onPointerDown={stop}>
          <Progress percent={p.percent ?? 60} style={{ width: '100%' }} />
        </div>
      )
    case 'antd-spin':
      return (
        <div className="lib-center" onPointerDown={stop}><Spin /></div>
      )
    case 'antd-empty':
      return (
        <div className="lib-fill lib-center" onPointerDown={stop}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={p.text ?? '暂无数据'} />
        </div>
      )
    case 'antd-divider':
      return (
        <div className="lib-center lib-pad" onPointerDown={stop}>
          <Divider style={{ margin: 0, width: '100%' }}>{p.text}</Divider>
        </div>
      )
    case 'antd-breadcrumb':
      return (
        <div className="lib-center lib-start lib-pad" onPointerDown={stop}>
          <Breadcrumb
            items={(p.text ?? '首页 / 列表 / 详情').split(/\s*\/\s*/).map((t, i) => ({ title: t, key: i }))}
          />
        </div>
      )
    case 'antd-tabs':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Tabs
            size="small"
            items={(opts.length ? opts : ['概览', '详情', '设置']).map((t) => ({
              key: t,
              label: t,
              children: null,
            }))}
          />
        </div>
      )
    case 'antd-pagination':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Pagination size="small" total={50} defaultCurrent={p.value ?? 1} />
        </div>
      )
    case 'antd-steps':
      return (
        <div className="lib-fill lib-pad" onPointerDown={stop}>
          <Steps
            size="small"
            current={p.value ?? 1}
            items={(opts.length ? opts : ['填写信息', '确认提交', '完成']).map((t) => ({ title: t }))}
          />
        </div>
      )
    case 'antd-timeline':
      return (
        <div className="lib-fill lib-scroll lib-pad" onPointerDown={stop}>
          <Timeline
            items={(opts.length ? opts : ['创建项目', '提交审核', '发布上线']).map((t) => ({ children: t }))}
          />
        </div>
      )
    case 'antd-collapse':
      return (
        <div className="lib-fill" onPointerDown={stop}>
          <Collapse
            size="small"
            items={[{ key: '1', label: p.title ?? '折叠面板', children: <p>{p.text ?? ''}</p> }]}
          />
        </div>
      )
    case 'antd-statistic':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Statistic title={p.title ?? '统计'} value={p.value ?? 0} />
        </div>
      )
    case 'antd-segmented':
      return (
        <div className="lib-center" onPointerDown={stop}>
          <Segmented options={opts.length ? opts : ['日', '周', '月']} defaultValue={p.text} />
        </div>
      )
    case 'antd-descriptions':
      return (
        <div className="lib-fill lib-scroll" onPointerDown={stop}>
          <Descriptions size="small" column={1} title={p.title} bordered>
            {(p.text ?? '姓名:张三').split(/[,，]/).map((pair, i) => {
              const [label, value] = pair.split(/[:：]/)
              return <Descriptions.Item key={i} label={label}>{value}</Descriptions.Item>
            })}
          </Descriptions>
        </div>
      )
    default:
      return <div className="lib-placeholder">{p.text ?? node.name}</div>
  }
}

export function ElementNodeContent({ node }: { node: UINode }) {
  const p = node.props ?? {}
  const opts = parseOptions(p.options)

  switch (node.type) {
    case 'el-button':
      return <div className={`el-btn el-btn--${p.variant ?? 'primary'}`}>{p.text ?? '按钮'}</div>
    case 'el-input':
      return <div className="el-input">{p.placeholder ?? '请输入'}</div>
    case 'el-textarea':
      return <div className="el-input el-textarea">{p.placeholder ?? '请输入多行文本'}</div>
    case 'el-input-number':
      return (
        <div className="el-input el-number">
          <span>−</span>
          <span>{p.value ?? 1}</span>
          <span>＋</span>
        </div>
      )
    case 'el-select':
    case 'el-cascader':
      return (
        <div className="el-select">
          <span>{p.placeholder ?? '请选择'}</span>
          <span className="el-select__caret">▾</span>
        </div>
      )
    case 'el-switch':
      return (
        <div className={`el-switch${p.checked ? ' el-switch--on' : ''}`}>
          <span className="el-switch__core" />
        </div>
      )
    case 'el-slider':
      return (
        <div className="el-slider">
          <div className="el-slider__run" style={{ width: `${p.value ?? 40}%` }} />
          <div className="el-slider__thumb" style={{ left: `${p.value ?? 40}%` }} />
        </div>
      )
    case 'el-rate':
      return <div className="el-rate">{'★★★★★'.slice(0, p.value ?? 3)}{'☆☆☆☆☆'.slice(0, 5 - (p.value ?? 3))}</div>
    case 'el-checkbox':
      return (
        <label className="el-check">
          <span className={`el-check__box${p.checked ? ' is-checked' : ''}`} />
          {p.text ?? '复选框'}
        </label>
      )
    case 'el-radio':
      return (
        <label className="el-check">
          <span className={`el-radio__box${p.checked ? ' is-checked' : ''}`} />
          {p.text ?? '单选框'}
        </label>
      )
    case 'el-date-picker':
    case 'el-time-picker':
      return <div className="el-input">{p.placeholder ?? '选择日期'}</div>
    case 'el-upload':
      return <div className="el-btn el-btn--default">{p.text ?? '点击上传'}</div>
    case 'el-card':
      return (
        <div className="el-card">
          <div className="el-card__header">{p.title ?? '卡片标题'}</div>
          <div className="el-card__body">{p.text ?? ''}</div>
        </div>
      )
    case 'el-table':
      return (
        <div className="el-table">
          <div className="el-table__row el-table__head"><span>姓名</span><span>年龄</span><span>地址</span></div>
          <div className="el-table__row"><span>张三</span><span>28</span><span>上海</span></div>
          <div className="el-table__row"><span>李四</span><span>32</span><span>北京</span></div>
        </div>
      )
    case 'el-tag':
      return <span className={`el-tag el-tag--${p.tagColor || 'primary'}`}>{p.text ?? '标签'}</span>
    case 'el-badge':
      return (
        <div className="el-badge">
          <div className="el-avatar">{p.text?.[0] ?? '消'}</div>
          <span className="el-badge__count">{p.count ?? 5}</span>
        </div>
      )
    case 'el-avatar':
      return <div className="el-avatar">{p.text ?? '用'}</div>
    case 'el-alert':
      return (
        <div className={`el-alert el-alert--${p.variant ?? 'success'}`}>
          <strong>{p.title ?? '提示'}</strong>
          <span>{p.text ?? ''}</span>
        </div>
      )
    case 'el-progress':
      return (
        <div className="el-progress">
          <div className="el-progress__bar" style={{ width: `${p.percent ?? 60}%` }} />
          <span>{p.percent ?? 60}%</span>
        </div>
      )
    case 'el-loading':
      return <div className="el-loading" />
    case 'el-empty':
      return <div className="el-empty">{p.text ?? '暂无数据'}</div>
    case 'el-divider':
      return <div className="el-divider"><span>{p.text ?? '分割线'}</span></div>
    case 'el-breadcrumb':
      return <div className="el-breadcrumb">{p.text ?? '首页 / 列表 / 详情'}</div>
    case 'el-tabs':
      return (
        <div className="el-tabs">
          {(opts.length ? opts : ['概览', '详情', '设置']).map((t, i) => (
            <span key={t} className={i === 0 ? 'is-active' : ''}>{t}</span>
          ))}
        </div>
      )
    case 'el-pagination':
      return (
        <div className="el-pagination">
          <span>‹</span><span className="is-active">1</span><span>2</span><span>3</span><span>›</span>
        </div>
      )
    case 'el-steps':
      return (
        <div className="el-steps">
          {(opts.length ? opts : ['填写信息', '确认提交', '完成']).map((t, i) => (
            <div key={t} className={`el-step${i <= (p.value ?? 1) ? ' is-done' : ''}`}>
              <i>{i + 1}</i>
              <span>{t}</span>
            </div>
          ))}
        </div>
      )
    case 'el-timeline':
      return (
        <div className="el-timeline">
          {(opts.length ? opts : ['创建项目', '提交审核', '发布上线']).map((t) => (
            <div key={t} className="el-timeline__item">{t}</div>
          ))}
        </div>
      )
    case 'el-collapse':
      return (
        <div className="el-collapse">
          <div className="el-collapse__title">{p.title ?? '折叠面板'}</div>
          <div className="el-collapse__body">{p.text ?? ''}</div>
        </div>
      )
    case 'el-statistic':
      return (
        <div className="el-statistic">
          <div className="el-statistic__title">{p.title ?? '统计'}</div>
          <div className="el-statistic__value">{p.value ?? 0}</div>
        </div>
      )
    case 'el-segmented':
      return (
        <div className="el-segmented">
          {(opts.length ? opts : ['日', '周', '月']).map((t, i) => (
            <span key={t} className={i === 0 ? 'is-active' : ''}>{t}</span>
          ))}
        </div>
      )
    case 'el-descriptions':
      return (
        <div className="el-desc">
          <div className="el-desc__title">{p.title ?? '用户信息'}</div>
          {(p.text ?? '姓名:张三').split(/[,，]/).map((pair) => {
            const [label, value] = pair.split(/[:：]/)
            return (
              <div key={pair} className="el-desc__row">
                <span>{label}</span>
                <span>{value}</span>
              </div>
            )
          })}
        </div>
      )
    case 'el-link':
      return <a className="el-link">{p.text ?? '链接'}</a>
    case 'el-text':
      return <div className="el-text">{p.text ?? '文本'}</div>
    default:
      return <div className="lib-placeholder">{p.text ?? node.name}</div>
  }
}

function mapAntdButtonType(variant?: string): 'primary' | 'default' | 'dashed' | 'text' | 'link' {
  if (variant === 'primary' || variant === 'dashed' || variant === 'text' || variant === 'link') return variant
  return 'default'
}

function mapAlertType(variant?: string): 'success' | 'info' | 'warning' | 'error' {
  if (variant === 'success' || variant === 'info' || variant === 'warning') return variant
  if (variant === 'danger') return 'error'
  return 'info'
}
