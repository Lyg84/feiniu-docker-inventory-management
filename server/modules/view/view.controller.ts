import { Controller, Get, Render } from '@nestjs/common';

@Controller()
export class ViewController {

  @Get(['/', '*'])
  @Render('index')
  async render(): Promise<{ __platform__: string }> {
    // 本地部署：平台信息由后端自己给出，不再依赖平台中间件注入 req.__platform_data__
    const platformData = {
      appId: process.env.APP_ID ?? 'jxc-local',
      appName: '进销存管理系统',
      env: process.env.NODE_ENV ?? 'production',
    };
    return {
      // 占位符仍保留，index.html 需要这个变量才能正常解析
      __platform__: JSON.stringify(platformData),
    };
  }
}
