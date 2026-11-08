// One action at a time. A second click while the first is still running, or within a short
// cool-down after it (Demo bets finish instantly, before the second click of a double click
// arrives), is ignored, so a double click can't place two bets or send two transactions.

export type Guard = {
  run: <T>(fn: () => Promise<T> | T) => Promise<T | undefined>;
  busy: () => boolean;
};

export function createGuard(onChange?: (busy: boolean) => void, cooldownMs = 400): Guard {
  let running = false;
  let until = 0;
  return {
    busy: () => running,
    async run(fn) {
      if (running || Date.now() < until) return undefined;
      running = true;
      onChange?.(true);
      try {
        return await fn();
      } finally {
        running = false;
        until = Date.now() + cooldownMs;
        onChange?.(false);
      }
    },
  };
}
