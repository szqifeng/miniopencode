import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Dashboard from './pages/dashboard';
import { setupMockServer } from './mock';
import './App.css';

setupMockServer();

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Dashboard />
    </ConfigProvider>
  );
}

export default App;