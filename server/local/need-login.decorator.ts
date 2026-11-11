import { SetMetadata } from '@nestjs/common';

export const NEED_LOGIN_KEY = 'NEED_LOGIN';

/**
 * 本地化替代 @lark-apaas/fullstack-nestjs-core 的 NeedLogin。
 * 保持原有装饰器调用形式 @NeedLogin()，元数据留给后续接入自定义守卫时使用。
 */
export const NeedLogin = (): MethodDecorator & ClassDecorator =>
  SetMetadata(NEED_LOGIN_KEY, true);
