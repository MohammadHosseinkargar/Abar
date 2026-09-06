// Type augmentation for browser globals injected at runtime

interface Window {
  // Google Analytics 4 — may be undefined if blocked by an ad-blocker
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
}
