import React from 'react';
import { Button, Result } from 'antd';

/**
 * 本地化替代 @lark-apaas/client-toolkit 的 ErrorRender / NotFoundRender。
 * 生产环境不输出堆栈，只给出可操作的重试/返回入口。
 */
export interface ErrorRenderProps {
  error: Error;
  resetErrorBoundary?: () => void;
}

export const ErrorRender: React.FC<ErrorRenderProps> = ({ error, resetErrorBoundary }) => (
  <Result
    status="error"
    title="页面出错了"
    subTitle={process.env.NODE_ENV === 'production' ? '请刷新页面重试' : error?.message}
    extra={
      resetErrorBoundary
        ? [
            <Button type="primary" key="retry" onClick={resetErrorBoundary}>
              重新加载
            </Button>,
          ]
        : undefined
    }
  />
);

export const NotFoundRender: React.FC = () => (
  <Result
    status="404"
    title="404"
    subTitle="页面不存在或已被移除"
    extra={
      <Button type="primary" onClick={() => (window.location.href = '/')}>
        返回首页
      </Button>
    }
  />
);

export default ErrorRender;
