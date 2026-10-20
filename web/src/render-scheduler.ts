export interface RenderScheduler {
  schedule(): void;
  flush(): void;
}

const slowRenderMs = 24;
const slowDelayMs = 200;

// Renders once per frame while rendering is cheap. When a large document makes
// one render slower than a frame, it waits for a pause in typing instead.
export function createRenderScheduler(render: () => void): RenderScheduler {
  let cancel: (() => void) | null = null;
  let slow = false;

  const run = (): void => {
    cancel = null;
    const start = performance.now();
    render();
    slow = performance.now() - start > slowRenderMs;
  };

  return {
    schedule() {
      if (cancel && !slow) return;
      cancel?.();

      if (slow) {
        const id = window.setTimeout(run, slowDelayMs);
        cancel = () => window.clearTimeout(id);
      } else {
        const id = window.requestAnimationFrame(run);
        cancel = () => window.cancelAnimationFrame(id);
      }
    },
    flush() {
      if (!cancel) return;
      cancel();
      run();
    }
  };
}
