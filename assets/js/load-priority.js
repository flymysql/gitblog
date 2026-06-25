// ============================================================================
// 资源加载优先级：统计类请求优先于图片懒加载
// ============================================================================

let holdCount = 0;
const waiters = [];

export function holdLazyImages() {
  holdCount += 1;
}

export function releaseLazyImages() {
  holdCount = Math.max(0, holdCount - 1);
  if (holdCount === 0) {
    const fns = waiters.splice(0);
    fns.forEach(fn => fn());
  }
}

export function isLazyImagesHeld() {
  return holdCount > 0;
}

export function runWhenLazyImagesAllowed(fn) {
  if (holdCount === 0) {
    fn();
    return;
  }
  waiters.push(fn);
}
