// frontend/src/utils/scrollLock.js
import { useEffect, useRef } from "react";

let activeLockCount = 0;
let previousBodyStyles = null;
let previousHtmlStyles = null;
let savedScrollY = 0;

/**
 * Acquire body scroll lock (safe for multiple concurrent overlays/modals).
 * Uses position: fixed with negative top to completely freeze background
 * on desktop, iOS Safari, and Android without losing visual scroll position.
 */
export function lockBodyScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  activeLockCount++;
  if (activeLockCount > 1) {
    // Already locked by another overlay
    return;
  }

  const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  savedScrollY = scrollY;

  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

  previousBodyStyles = {
    overflow: document.body.style.overflow,
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    paddingRight: document.body.style.paddingRight,
  };

  previousHtmlStyles = {
    overflow: document.documentElement.style.overflow,
  };

  // Prevent layout jump caused by scrollbar disappearing
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  // Complete background freeze
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.classList.add("modal-scroll-locked");
}

/**
 * Release body scroll lock and restore previous document scroll position.
 */
export function unlockBodyScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  activeLockCount = Math.max(0, activeLockCount - 1);
  if (activeLockCount > 0) {
    // Another overlay is still active
    return;
  }

  if (previousBodyStyles) {
    document.body.style.overflow = previousBodyStyles.overflow || "";
    document.body.style.position = previousBodyStyles.position || "";
    document.body.style.top = previousBodyStyles.top || "";
    document.body.style.left = previousBodyStyles.left || "";
    document.body.style.right = previousBodyStyles.right || "";
    document.body.style.width = previousBodyStyles.width || "";
    document.body.style.paddingRight = previousBodyStyles.paddingRight || "";
    previousBodyStyles = null;
  } else {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.paddingRight = "";
  }

  if (previousHtmlStyles) {
    document.documentElement.style.overflow = previousHtmlStyles.overflow || "";
    previousHtmlStyles = null;
  } else {
    document.documentElement.style.overflow = "";
  }

  document.body.classList.remove("modal-scroll-locked");

  // Restore previous scroll position seamlessly
  window.scrollTo(0, savedScrollY);
}

/**
 * React hook to lock body scroll while modal or drawer is open.
 */
export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

/**
 * Comprehensive modal UX hook:
 * - Locks body scroll while open
 * - Listens for Escape key to close
 * - Remembers & restores trigger focus
 * - Auto-focuses modal panel
 */
export function useModalAccessibility({ isOpen, onClose, modalRef }) {
  const triggerElementRef = useRef(null);

  // Lock body scroll
  useBodyScrollLock(isOpen);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;

    triggerElementRef.current = document.activeElement;

    // Small delay to allow element rendering before focusing
    const timer = setTimeout(() => {
      if (modalRef?.current) {
        // Focus close button or first focusable input
        const focusable = modalRef.current.querySelector(
          'button[aria-label="Close"], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus?.();
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
        triggerElementRef.current.focus();
      }
    };
  }, [isOpen, modalRef]);

  // Escape key support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
}
