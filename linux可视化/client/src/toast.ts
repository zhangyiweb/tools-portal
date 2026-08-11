import { createElement, type CSSProperties, type ReactNode } from 'react';
import { App } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';

const DURATION = 5;
const PLACEMENT = 'bottomRight' as const;

let notifyApi: NotificationInstance | null = null;

/** 挂在 AntApp 内，把带主题的 notification 注入给 toast */
export function ToastBridge() {
  const { notification } = App.useApp();
  notifyApi = notification;
  return null;
}

const wrapStyle: CSSProperties = {
  width: 400,
  maxWidth: 'min(400px, calc(100vw - 24px))',
};

const descriptionStyle: CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  maxHeight: 220,
  overflowY: 'auto',
  marginTop: 4,
  lineHeight: 1.5,
  fontSize: 13,
};

function descNode(content: string): ReactNode {
  return createElement('div', { style: descriptionStyle }, content);
}

function open(
  type: 'success' | 'error' | 'info' | 'warning',
  title: string,
  description?: string,
) {
  const api = notifyApi;
  if (!api) return;
  api[type]({
    title,
    description: description ? descNode(description) : undefined,
    duration: DURATION,
    placement: PLACEMENT,
    closable: true,
    style: wrapStyle,
  });
}

const titles = {
  success: '成功',
  error: '出错了',
  info: '提示',
  warning: '注意',
} as const;

/** 统一提示：右下角、可关闭、停留 5 秒；长文案自动换行并可滚动 */
export const toast = {
  success(content: string) {
    open('success', titles.success, content);
  },
  error(content: string) {
    open('error', titles.error, content);
  },
  info(content: string) {
    open('info', titles.info, content);
  },
  warn(content: string) {
    open('warning', titles.warning, content);
  },
  notify(title: string, description: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    open(type, title, description);
  },
};
