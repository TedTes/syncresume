import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";

export type ToastKind = "success" | "error" | "info";

type ToastInput = {
  title?: string;
  message: string;
  kind?: ToastKind;
  durationMs?: number;
};

type Toast = Required<Pick<ToastInput, "message" | "kind" | "durationMs">> & {
  id: string;
  title?: string;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  dismissToast: (toastId: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(0);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = `toast-${nextToastId.current++}`;
    const toast: Toast = {
      id,
      title: input.title,
      message: input.message,
      kind: input.kind ?? "info",
      durationMs: input.durationMs ?? 4200,
    };

    setToasts((current) => [...current, toast].slice(-4));
    return id;
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function useToastMessage(
  message: string | null | undefined,
  options: {
    kind?: ToastKind;
    title?: string;
    durationMs?: number;
    enabled?: boolean;
  } = {},
) {
  const { showToast } = useToast();
  const lastToastKeyRef = useRef("");
  const {
    kind = "info",
    title,
    durationMs,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled || !message) {
      lastToastKeyRef.current = "";
      return;
    }

    const toastKey = `${kind}:${title ?? ""}:${message}`;
    if (toastKey === lastToastKeyRef.current) return;

    lastToastKeyRef.current = toastKey;
    showToast({ kind, title, message, durationMs });
  }, [durationMs, enabled, kind, message, showToast, title]);
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (toastId: string) => void;
}) {
  useEffect(() => {
    if (toast.durationMs <= 0) return;

    const timeoutId = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [onDismiss, toast.durationMs, toast.id]);

  return (
    <div className={`toast-card ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      <div className="toast-content">
        {toast.title && <strong>{toast.title}</strong>}
        <span>{toast.message}</span>
      </div>
      <button
        className="toast-close"
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
