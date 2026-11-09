/* 轻量日志封装：统一前缀，避免生产环境刷屏 */

type LogArgs = unknown[];

function prefix(level: string): string {
  return `[jxc:${level}]`;
}

const isDev = Boolean(
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
);

export const logger = {
  debug: (...args: LogArgs): void => {
    if (isDev) console.debug(prefix('debug'), ...args);
  },
  info: (...args: LogArgs): void => {
    console.info(prefix('info'), ...args);
  },
  warn: (...args: LogArgs): void => {
    console.warn(prefix('warn'), ...args);
  },
  error: (...args: LogArgs): void => {
    console.error(prefix('error'), ...args);
  },
};

export default logger;
