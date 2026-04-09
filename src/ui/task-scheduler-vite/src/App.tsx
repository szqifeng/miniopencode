import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Dashboard from './pages/dashboard/index.tsx';
import './App.css';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#0f766e',
          colorInfo: '#0f766e',
          colorSuccess: '#15803d',
          colorWarning: '#b45309',
          colorError: '#b91c1c',
          borderRadius: 18,
          fontFamily:
            "'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Card: {
            borderRadiusLG: 24,
          },
          Button: {
            borderRadius: 999,
            controlHeight: 42,
          },
          Input: {
            borderRadius: 14,
          },
          Select: {
            borderRadius: 14,
          },
          Modal: {
            borderRadiusLG: 28,
          },
        },
      }}
    >
      <AntdApp>
        <Dashboard />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
