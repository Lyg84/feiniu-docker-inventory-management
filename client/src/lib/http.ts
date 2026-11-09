import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/**
 * 后端请求实例。
 * 本软件自托管（NAS 上 NestJS 同时托管前端静态资源），接口全部走同源 /api，
 * 因此 baseURL 留空即可；withCredentials 用于携带会话 Cookie。
 *
 * 平台（@lark-apaas/fullstack-nestjs-core）对 /api/* 全量启用了 CSRF 校验：
 * 要求 cookie 里存在 suda-csrf-token，且请求头 x-suda-csrf-token 与之完全一致，
 * 否则一律 403（Forbidden，csrf token not found in cookie / header）。
 * 平台默认下发的同名 cookie 带 Secure 标记，用 http://内网IP 访问时浏览器会拒收，
 * 所以这里除了补请求头，还会把 window.csrfToken 回写成本域的普通 cookie，
 * 并在遇到 csrf 403 时刷新令牌重试一次。
 */

const CSRF_COOKIE = 'suda-csrf-token';
const CSRF_HEADER = 'x-suda-csrf-token';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const matched = document.cookie.split('; ').find((item) => item.split('=')[0] === name);
  if (!matched) return null;
  return decodeURIComponent(matched.split('=').slice(1).join('='));
}

function readPlatformToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = (window as unknown as { csrfToken?: string }).csrfToken;
  return token ? String(token) : null;
}

/** 保证 cookie 与请求头使用同一枚令牌；http 环境下补写非 Secure cookie。 */
function ensureCsrfToken(): string | null {
  const cookieToken = readCookie(CSRF_COOKIE);
  const platformToken = readPlatformToken();
  const token = cookieToken || platformToken;
  if (!token) return null;
  if (cookieToken !== token && typeof document !== 'undefined') {
    document.cookie = `${CSRF_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }
  return token;
}

/** 取当前登录用户，供后端写操作日志时记录操作人（后端无会话，靠这个头传递） */
function currentUsername(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('erp_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: string };
    return parsed?.username ? String(parsed.username) : null;
  } catch {
    return null;
  }
}

export const axiosForBackend: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

axiosForBackend.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = ensureCsrfToken();
  if (token) config.headers.set(CSRF_HEADER, token);
  const username = currentUsername();
  if (username) config.headers.set('x-username', encodeURIComponent(username));
  return config;
});

axiosForBackend.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as (InternalAxiosRequestConfig & { _csrfRetried?: boolean }) | undefined;
    const status = error?.response?.status;
    const body = error?.response?.data;
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? '');
    if (status === 403 && config && !config._csrfRetried && text.includes('csrf')) {
      config._csrfRetried = true;
      const token = ensureCsrfToken();
      if (token) {
        config.headers.set(CSRF_HEADER, token);
        return axiosForBackend.request(config);
      }
    }
    return Promise.reject(error);
  },
);

export const getAxiosForBackend = (): AxiosInstance => axiosForBackend;
