import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { SysLogService } from './sys-log.service';

/**
 * 全局操作日志拦截器。
 *
 * 背景：库里 sys_log 表、/api/sys-logs 查询接口、前端「操作日志管理」页面都存在，
 * 但全项目没有任何一处往表里 insert，所以页面永远空白。
 * 这里按「写操作请求」统一落库（GET/HEAD/OPTIONS 不记，避免把查询刷满）：
 *   - 模块：按 URL 首段映射成中文业务名
 *   - 动作：按 方法 + 子路径 判定（审核/反审核/导入/新增/修改/删除/登录）
 *   - 详情：请求体压成一行，密码类字段打码，附 HTTP 状态与耗时
 * 写日志失败只告警，绝不影响业务响应。
 */

const MODULE_MAP: Array<[string, string]> = [
  ['/customers/statement', '客户对账单'],
  ['/customers', '客户'],
  ['/products/price-history', '商品历史价'],
  ['/products', '商品'],
  ['/suppliers', '供应商'],
  ['/sales-deliveries', '送货单'],
  ['/sales-returns', '销售退货'],
  ['/receipts', '收款单'],
  ['/purchase-ins', '采购入库'],
  ['/purchase-returns', '采购退货'],
  ['/payments', '付款单'],
  ['/stock-ins', '入库单'],
  ['/stock-outs', '出库单'],
  ['/material-requisitions', '领料单'],
  ['/material-returns', '退料单'],
  ['/finance-incomes', '其他收入'],
  ['/finance-expenses', '其他支出'],
  ['/employees', '员工'],
  ['/warehouses', '仓库'],
  ['/sys-users', '用户管理'],
  ['/sys-params', '系统参数'],
  ['/sys-logs', '操作日志'],
  ['/auth/change-password', '修改密码'],
  ['/auth/login', '登录'],
  ['/auth', '登录'],
];

function moduleOf(path: string): string {
  for (const [prefix, name] of MODULE_MAP) {
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) return name;
  }
  const seg = path.split('/').filter(Boolean)[1] ?? path.split('/').filter(Boolean)[0] ?? '';
  return seg || '其他';
}

function actionOf(path: string, method: string): string {
  if (/\/login$/.test(path)) return '登录';
  if (/\/change-password$/.test(path)) return '修改密码';
  if (/\/unaudit$/.test(path)) return '反审核';
  if (/\/audit$/.test(path)) return '审核';
  if (/\/import$/.test(path)) return '导入';
  if (/\/toggle$/.test(path) || /\/enable$/.test(path) || /\/disable$/.test(path)) return '状态变更';
  if (method === 'DELETE') return '删除';
  if (method === 'PUT' || method === 'PATCH') return '修改';
  if (method === 'POST') return '新增';
  return method;
}

function clientIp(req: Record<string, any>): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const raw = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.ip || req.socket?.remoteAddress || '';
  return String(raw).split(',')[0].trim().replace(/^::ffff:/, '').slice(0, 50);
}

function usernameOf(req: Record<string, any>): string {
  const header = req.headers?.['x-username'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw) {
    try {
      return decodeURIComponent(String(raw)).slice(0, 100);
    } catch {
      return String(raw).slice(0, 100);
    }
  }
  const bodyUser = req.body?.username;
  return typeof bodyUser === 'string' ? bodyUser.slice(0, 100) : '';
}

@Injectable()
export class SysLogInterceptor implements NestInterceptor {
  constructor(private readonly sysLogService: SysLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Record<string, any>>();
    const res = context.switchToHttp().getResponse<Record<string, any>>();
    const method = String(req.method ?? 'GET').toUpperCase();
    const path = String(req.originalUrl ?? req.url ?? '').split('?')[0];

    if (!path.startsWith('/api')) return next.handle();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next.handle();

    const startedAt = Date.now();
    const basePath = path.replace(/^\/api/, '') || '/';

    const persist = (status: number, payload: unknown, error?: unknown) => {
      const isLogin = /\/login$/.test(basePath);
      const ok = status < 400 && (payload as { success?: boolean } | undefined)?.success !== false;
      const action = isLogin ? (ok ? '登录' : '登录失败') : actionOf(basePath, method);
      const moduleName = moduleOf(basePath);

      const parts: string[] = [];
      if (isLogin) {
        const account = req.body?.username;
        parts.push(`账号=${typeof account === 'string' ? account : '-'}`);
        parts.push(`结果=${ok ? '成功' : '失败'}`);
        if (!ok) {
          const msg = (payload as { message?: string } | undefined)?.message;
          if (msg) parts.push(`原因=${msg}`);
        }
      } else {
        const summary = SysLogService.summarize(req.body);
        // 审核/删除这类请求 body 为空，摘要里没有对象标识；补上路径，
        // 让 detail 能定位到具体单据（如 /sales-deliveries/<id>/audit）
        if (summary) parts.push(summary);
        else parts.push(`路径=${path}`);
      }
      parts.push(`HTTP=${status}`, `耗时=${Date.now() - startedAt}ms`);
      if (error) {
        const msg = (error as { response?: { message?: string | string[] }; message?: string })?.response?.message;
        const text = Array.isArray(msg) ? msg.join(';') : msg || (error as Error)?.message;
        if (text) parts.push(`错误=${String(text).slice(0, 200)}`);
      }

      void this.sysLogService.write({
        username: usernameOf(req),
        action,
        module: moduleName,
        detail: parts.join(' ').slice(0, 2000),
        ip: clientIp(req),
      });
    };

    return next.handle().pipe(
      tap({
        next: (payload) => persist(Number(res?.statusCode ?? 200), payload),
        error: (error) => persist(Number(error?.status ?? error?.statusCode ?? 500), undefined, error),
      }),
    );
  }
}
