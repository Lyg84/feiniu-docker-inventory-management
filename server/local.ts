/**
 * 服务端本地桥接层。
 *
 * 平台模板里原本由 CLI 生成的 `server/local.ts` 在本机工作副本中缺失（原文件是云占位符），
 * 这里按实际用法补回：仅重导出数据库注入令牌与 Drizzle 类型，避免各 service 各自 import 平台包。
 */
export { DRIZZLE_DATABASE } from '@lark-apaas/fullstack-nestjs-core';
export type { PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
