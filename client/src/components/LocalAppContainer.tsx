import React from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 本地化替代 @lark-apaas/client-toolkit/components/AppContainer。
 * 只保留业务真正需要的外壳：QueryProvider + antd ConfigProvider(zh_CN) + App；
 * 丢掉平台侧的 AuthProvider / MiaodaInspector / IframeBridge / Watermark。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5_000,
    },
  },
});

export interface AppContainerProps {
  defaultTheme?: string;
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1e293b',
          borderRadius: 6,
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  </QueryClientProvider>
);

export default AppContainer;
