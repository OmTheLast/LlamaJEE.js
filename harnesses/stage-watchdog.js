// One stage owns one clock. A delayed browser timer must never extend expired work.
export function stageWatchdog({ deadlineMs, idleTimeoutMs, maxTokens, onTimeout, onProgress }) {
  const started = performance.now();
  const absoluteExpiry = deadlineMs === null ? Infinity : started + deadlineMs;
  let lastAdvance = started;
  let latest = null;
  let stopped = false;
  let timer;

  function check(now = performance.now()) {
    if (stopped) return;
    if (now >= absoluteExpiry) {
      stopped = true;
      onTimeout(idleTimeoutMs ? 'HARD_TIMEOUT' : 'DEADLINE',
        idleTimeoutMs ? 'Time limit reached for this stage.' : 'Stage deadline reached.');
    } else if (idleTimeoutMs && now - lastAdvance >= idleTimeoutMs) {
      stopped = true;
      onTimeout('STALL_TIMEOUT', 'The model stopped making progress.');
    }
  }

  function arm() {
    const next = idleTimeoutMs ? Math.min(absoluteExpiry, lastAdvance + idleTimeoutMs) : absoluteExpiry;
    timer = setTimeout(() => {
      check();
      if (!stopped) arm();
    }, Math.max(1, Math.ceil(next - performance.now())));
  }

  function progress({ phase, processed, total }) {
    const now = performance.now();
    check(now);
    if (stopped || !idleTimeoutMs) return;
    if (!['reading', 'writing'].includes(phase) || !Number.isSafeInteger(total) || total < 1 ||
        !Number.isSafeInteger(processed) || processed < 0 || processed > total) return;
    if (phase === 'writing' && total > maxTokens) return;
    if (latest?.phase === 'writing' && phase === 'reading') return;
    const previous = latest?.phase === phase ? latest : null;
    if (previous && (total !== previous.total || processed <= previous.processed)) return;
    // A phase announcement or an identical counter does not earn more time.
    if (processed > (previous?.processed ?? 0)) lastAdvance = now;
    latest = { phase, processed, total };
    onProgress(latest);
  }

  arm();
  return { check, progress, get latest() { return latest; }, close() { stopped = true; clearTimeout(timer); } };
}
