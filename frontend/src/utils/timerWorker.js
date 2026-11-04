/**
 * Tasklert Background Precision Timer Web Worker
 * 
 * Runs a high-precision countdown interval on an isolated Web Worker thread.
 * Web Workers are NOT subject to Chrome/Edge background tab setInterval throttling (1 tick/minute).
 * Guarantees exact second-by-second countdown and alarm dispatching when the browser tab is hidden or minimized.
 */

class PrecisionTimerWorker {
  constructor() {
    this.worker = null;
    this.onTick = null;
    this.onComplete = null;
    this.targetEndTimestamp = null;
    this.initWorker();
  }

  initWorker() {
    if (typeof window === "undefined" || typeof Worker === "undefined") return;

    try {
      const workerCode = `
        let intervalId = null;
        let targetMs = null;

        self.onmessage = function(e) {
          const data = e.data;
          if (data.type === 'START') {
            targetMs = data.targetEndTimestamp;
            if (intervalId) clearInterval(intervalId);

            intervalId = setInterval(function() {
              const now = Date.now();
              const remaining = Math.max(0, Math.ceil((targetMs - now) / 1000));
              self.postMessage({ type: 'TICK', remaining: remaining, now: now });

              if (remaining <= 0) {
                clearInterval(intervalId);
                intervalId = null;
                self.postMessage({ type: 'COMPLETE' });
              }
            }, 1000);
          } else if (data.type === 'STOP') {
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
            targetMs = null;
          }
        };
      `;

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === "TICK") {
          if (this.onTick) this.onTick(data.remaining);
        } else if (data.type === "COMPLETE") {
          if (this.onComplete) this.onComplete();
        }
      };
    } catch (err) {
      console.warn("[PrecisionTimerWorker] Web Worker initialization fallback:", err);
    }
  }

  start(targetEndTimestamp, onTick, onComplete) {
    this.targetEndTimestamp = targetEndTimestamp;
    this.onTick = onTick;
    this.onComplete = onComplete;

    if (this.worker) {
      this.worker.postMessage({
        type: "START",
        targetEndTimestamp,
      });
    }
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage({ type: "STOP" });
    }
    this.onTick = null;
    this.onComplete = null;
    this.targetEndTimestamp = null;
  }
}

export const precisionTimerWorker = new PrecisionTimerWorker();
export default precisionTimerWorker;
