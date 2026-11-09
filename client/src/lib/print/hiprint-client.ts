import { io, type Socket } from 'socket.io-client';

/**
 * electron-hiprint 客户端通道。
 *
 * 协议（以 electron-hiprint 官方说明为准）：
 *   socket.io-client 4.x 连接 http://localhost:17521
 *   连接成功后客户端主动推 clientInfo / printerList
 *   socket.emit("news", { html, templateId, printer, pageSize })
 *   socket.on("success" | "error", res => res.templateId)
 *
 * pageSize 为自定义纸张时单位是 1/1000 mm，例如 241×140mm → { width: 241000, height: 140000 }
 */

export interface PrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
}

export interface PrintClientState {
  connected: boolean;
  connecting: boolean;
  printers: PrinterInfo[];
  clientInfo?: Record<string, unknown>;
}

const DEFAULT_HOST = 'http://127.0.0.1:17521';

let socket: Socket | null = null;
let state: PrintClientState = { connected: false, connecting: false, printers: [] };

const subscribers = new Set<(s: PrintClientState) => void>();
const pending = new Map<string, { resolve: (v: PrintResult) => void; timer: number }>();

export interface PrintResult {
  ok: boolean;
  message?: string;
}

function emitState(): void {
  const snapshot: PrintClientState = {
    connected: state.connected,
    connecting: state.connecting,
    printers: state.printers,
    clientInfo: state.clientInfo,
  };
  subscribers.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* ignore */
    }
  });
}

export function subscribePrintState(fn: (s: PrintClientState) => void): () => void {
  subscribers.add(fn);
  fn({ ...state });
  return () => subscribers.delete(fn);
}

export function getPrintState(): PrintClientState {
  return { ...state, printers: [...state.printers] };
}

function normalizePrinters(list: unknown): PrinterInfo[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item: unknown) => {
      const raw = item as Record<string, unknown>;
      const name = String(raw.name || raw.displayName || '');
      if (!name) return null;
      return {
        name,
        displayName: raw.displayName ? String(raw.displayName) : undefined,
        isDefault: Boolean(raw.isDefault),
      } as PrinterInfo;
    })
    .filter((v): v is PrinterInfo => v !== null);
}

function bindSocket(s: Socket): void {
  s.on('connect', () => {
    state.connected = true;
    state.connecting = false;
    emitState();
    s.emit('getClientInfo');
    s.emit('refreshPrinterList');
  });

  s.on('disconnect', () => {
    state.connected = false;
    emitState();
  });

  s.on('connect_error', () => {
    state.connected = false;
    state.connecting = false;
    emitState();
  });

  s.on('clientInfo', (info: Record<string, unknown>) => {
    state.clientInfo = info;
    emitState();
  });

  s.on('printerList', (list: unknown) => {
    state.printers = normalizePrinters(list);
    emitState();
  });

  s.on('success', (res: { templateId?: string }) => {
    const key = String(res?.templateId || '');
    const task = pending.get(key);
    if (task) {
      window.clearTimeout(task.timer);
      pending.delete(key);
      task.resolve({ ok: true });
    }
  });

  s.on('error', (res: { templateId?: string; message?: string; msg?: string }) => {
    const key = String(res?.templateId || '');
    const task = pending.get(key);
    const message = String(res?.message || res?.msg || '打印失败');
    if (task) {
      window.clearTimeout(task.timer);
      pending.delete(key);
      task.resolve({ ok: false, message });
    }
  });
}

/** 建立（或复用）到本机打印客户端的连接 */
export function ensurePrintClient(): Socket {
  if (socket) {
    if (!socket.connected) {
      state.connecting = true;
      emitState();
      socket.connect();
    }
    return socket;
  }

  const configured = (window as unknown as { __HIPRINT_HOST__?: string }).__HIPRINT_HOST__;
  const host = configured || DEFAULT_HOST;

  state.connecting = true;
  emitState();

  socket = io(host, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    timeout: 5000,
    auth: { token: 'vue-plugin-hiprint' },
  });

  bindSocket(socket);
  return socket;
}

/** 等待连接就绪，超时返回 false */
export async function waitConnected(timeoutMs = 4000): Promise<boolean> {
  const s = ensurePrintClient();
  if (s.connected) return true;
  return new Promise<boolean>((resolve: (v: boolean) => void) => {
    const started = Date.now();
    const tick = (): void => {
      if (s.connected) {
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, 200);
    };
    tick();
  });
}

/** 唤起本机客户端（需要安装时以管理员身份运行才能注册 hiprint:// 协议） */
export function launchPrintClient(): void {
  try {
    window.open('hiprint://', '_blank');
  } catch {
    /* ignore */
  }
}

/** 下发一段 HTML 打印任务 */
export async function printHtml(
  html: string,
  options: { printer?: string; pageSize?: { width: number; height: number }; timeoutMs?: number } = {},
): Promise<PrintResult> {
  const ok = await waitConnected();
  if (!ok || !socket) {
    return { ok: false, message: '未连接到打印客户端，请先启动 electron-hiprint' };
  }

  const templateId = `jxc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { printer, pageSize, timeoutMs = 15000 } = options;

  return new Promise<PrintResult>((resolve: (v: PrintResult) => void) => {
    const timer = window.setTimeout(() => {
      pending.delete(templateId);
      resolve({ ok: false, message: '打印超时，未收到客户端回执' });
    }, timeoutMs);

    pending.set(templateId, { resolve, timer });

    socket!.emit('news', {
      html,
      templateId,
      printer: printer || '',
      pageSize,
      silent: true,
      printBackground: true,
      margins: { marginType: 'none' },
      scaleFactor: 100,
    });
  });
}
