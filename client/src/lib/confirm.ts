/**
 * 确认对话框：返回 Promise<boolean>。
 * 不依赖具体 UI 库，直接用 DOM 画一个轻量模态框，避免各页面各写一套。
 */
export function showConfirm(message: string, options?: { title?: string; okText?: string; cancelText?: string }): Promise<boolean> {
  if (typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  const { title = '确认操作', okText = '确定', cancelText = '取消' } = options || {};

  return new Promise<boolean>((resolve: (v: boolean) => void) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:11000;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.2);min-width:320px;max-width:90vw;padding:18px 20px;';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:14px;font-weight:600;color:#111827;margin-bottom:8px;';
    titleEl.textContent = title;

    const msgEl = document.createElement('div');
    msgEl.style.cssText =
      'font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;margin-bottom:16px;';
    msgEl.textContent = message;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';

    const btnBase =
      'height:30px;padding:0 14px;border-radius:6px;font-size:13px;cursor:pointer;border:1px solid #d1d5db;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = cancelText;
    cancelBtn.style.cssText = btnBase + 'background:#fff;color:#374151;';

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = okText;
    okBtn.style.cssText =
      btnBase + 'background:#2563eb;border-color:#2563eb;color:#fff;font-weight:500;';

    const cleanup = (result: boolean): void => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(result);
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cleanup(false);
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        cleanup(true);
      }
    };

    cancelBtn.addEventListener('click', () => cleanup(false));
    okBtn.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === overlay) cleanup(false);
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(titleEl);
    box.appendChild(msgEl);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown, true);
    okBtn.focus();
  });
}

export default showConfirm;
