import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { ToastBridge } from './toast';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#3ecf8e',
          colorInfo: '#3ecf8e',
          borderRadius: 8,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        },
      }}
    >
      <AntApp notification={{ placement: 'bottomRight', duration: 5, maxCount: 3 }}>
        <ToastBridge />
        <App />
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
