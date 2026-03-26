import { useToastStore } from './Toast.store';
import './Toast.css';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (!toasts.length) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="toast__msg">{t.message}</span>
          <button className="toast__close" onClick={() => removeToast(t.id)} aria-label="Закрыть">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
