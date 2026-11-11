import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';

/**
 * 本地化替代 @lark-apaas/fullstack-nestjs-core 的 configureApp。
 * 保留业务实际依赖的行为：body 解析、cookie 解析、全局前缀、受信代理；
 * 去掉平台专有的 logger、public assets 中间件、OpenAPI devtools。
 */
export async function configureApp(
  app: NestExpressApplication,
  _options: { disableSwagger?: boolean } = {},
): Promise<void> {
  const bodyLimit = process.env.BODY_SIZE_LIMIT ?? '10mb';

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ limit: bodyLimit, extended: true }));
  app.use(cookieParser());

  const globalPrefix = process.env.CLIENT_BASE_PATH ?? '';
  app.setGlobalPrefix(globalPrefix);
  app.set('trust proxy', true);
}
