import { toast } from "react-toastify";

/**
 * Tasklert Centralized Toast Manager
 * 
 * Guarantees:
 * 1. Mobile screen constraint: strictly max 1 visible toast card with smooth replacement.
 * 2. Desktop screen constraint: max 3 visible toasts.
 * 3. Automatic deduplication: identical messages / IDs never duplicate or stack.
 * 4. Consistent auto-dismiss duration (4000ms).
 * 5. Keyboard and screen reader accessible.
 * 6. Preserves persistent database notifications independently of toast dismissal.
 */

const MAX_DESKTOP_TOASTS = 3;
const MAX_MOBILE_TOASTS = 1;
const DEFAULT_AUTO_CLOSE = 4000;

// Track active toast IDs in chronological order
const activeToastIds = [];

const isMobileViewport = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 640;
};

const generateToastId = (type, message) => {
  const clean = String(message || "")
    .slice(0, 40)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");
  return `tl-${type}-${clean}`;
};

const enforceToastLimit = () => {
  const maxAllowed = isMobileViewport() ? MAX_MOBILE_TOASTS : MAX_DESKTOP_TOASTS;
  while (activeToastIds.length >= maxAllowed) {
    const oldestId = activeToastIds.shift();
    if (oldestId) {
      toast.dismiss(oldestId);
    }
  }
};

const dispatchToast = (type, message, options = {}) => {
  if (!message) return null;

  const id = options.toastId || generateToastId(type, message);

  // If a toast with this exact ID is already active, don't create duplicate
  if (toast.isActive(id)) {
    return id;
  }

  // Enforce mobile/desktop limits before triggering new toast
  enforceToastLimit();

  const toastOptions = {
    toastId: id,
    autoClose: options.autoClose ?? DEFAULT_AUTO_CLOSE,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: false,
    onClose: () => {
      const idx = activeToastIds.indexOf(id);
      if (idx !== -1) activeToastIds.splice(idx, 1);
      options.onClose?.();
    },
    ...options,
  };

  let toastRef = null;
  switch (type) {
    case "success":
      toastRef = toast.success(message, toastOptions);
      break;
    case "error":
      toastRef = toast.error(message, toastOptions);
      break;
    case "warning":
    case "warn":
      toastRef = toast.warn(message, toastOptions);
      break;
    case "info":
    default:
      toastRef = toast.info(message, toastOptions);
      break;
  }

  activeToastIds.push(id);
  return id;
};

export const notify = {
  success: (msg, opts) => dispatchToast("success", msg, opts),
  error: (msg, opts) => dispatchToast("error", msg, opts),
  info: (msg, opts) => dispatchToast("info", msg, opts),
  warning: (msg, opts) => dispatchToast("warning", msg, opts),
  warn: (msg, opts) => dispatchToast("warning", msg, opts),
  dismiss: (id) => {
    if (id) {
      toast.dismiss(id);
      const idx = activeToastIds.indexOf(id);
      if (idx !== -1) activeToastIds.splice(idx, 1);
    } else {
      toast.dismiss();
      activeToastIds.length = 0;
    }
  },
  clear: () => {
    toast.dismiss();
    activeToastIds.length = 0;
  },
};

export default notify;
