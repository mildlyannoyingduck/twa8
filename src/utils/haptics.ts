function safeVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore when WebView or desktop browser restricts vibration
  }
}

export const haptics = {
  tick: () => safeVibrate(6),
  tap: () => safeVibrate(10),
  success: () => safeVibrate([10, 26, 14]),
  lock: () => safeVibrate([14, 28, 22]),
};
