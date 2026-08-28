
// timer.js
// Owns: the round countdown only — starting, pausing, resuming, stopping,
// and reporting time remaining. Does NOT touch the DOM, and does NOT
// decide what happens when time runs out (that's main.js's job, via the
// onExpire callback) — same "engine, not UI" split as physics.js.
 
let intervalId = null;
let remainingSeconds = 0;
let onTickCallback = null;
let onExpireCallback = null;
let running = false;
 
// -----------------------------------------------------------------------
// A. Pure helper — turns raw seconds into "MM:SS" for display. Kept pure
// (no DOM, no module state) so it's trivially testable and reusable by
// whichever file ends up rendering the statTime HUD cell.
// -----------------------------------------------------------------------
function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
 
// -----------------------------------------------------------------------
// B. Start a new countdown. durationSeconds comes from round-config.js
// (buildTimeSeconds) — timer.js deliberately does NOT hardcode "40
// minutes" itself, same reason round-config.js exists at all: one
// source of truth for per-round numbers.
//
// onTick(remainingSeconds) fires once per second — UI code uses this to
// update the statTime HUD cell.
// onExpire() fires exactly once, when the countdown hits 0 — main.js
// will use this to auto-end the build phase.
// -----------------------------------------------------------------------
function startTimer(durationSeconds, onTick, onExpire) {
  stopTimer(); // clear any previous timer first — avoids double-counting
  remainingSeconds = durationSeconds;
  onTickCallback = onTick || null;
  onExpireCallback = onExpire || null;
  running = true;
  if (onTickCallback) onTickCallback(remainingSeconds);
  intervalId = setInterval(() => {
    remainingSeconds -= 1;
    if (onTickCallback) onTickCallback(remainingSeconds);
    if (remainingSeconds <= 0) {
      stopTimer();
      if (onExpireCallback) onExpireCallback();
    }
  }, 1000);
}
 
// -----------------------------------------------------------------------
// C. Pause/resume — freezes/unfreezes without losing remainingSeconds.
// Not wired to any button yet (none exists) — kept ready for when
// exam-day interruption handling is added.
// -----------------------------------------------------------------------
function pauseTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  running = false;
}
 
function resumeTimer() {
  if (running || remainingSeconds <= 0) return; // already running, or already expired
  running = true;
  intervalId = setInterval(() => {
    remainingSeconds -= 1;
    if (onTickCallback) onTickCallback(remainingSeconds);
    if (remainingSeconds <= 0) {
      stopTimer();
      if (onExpireCallback) onExpireCallback();
    }
  }, 1000);
}
 
// -----------------------------------------------------------------------
// D. Stop — fully clears the timer. Used both when a round ends early
// (player finishes before time's up) and internally by startTimer to
// avoid stacking multiple intervals.
// -----------------------------------------------------------------------
function stopTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  running = false;
}
 
// -----------------------------------------------------------------------
// E. Read-only accessors
// -----------------------------------------------------------------------
function getRemainingSeconds() {
  return remainingSeconds;
}
 
function isRunning() {
  return running;
}
 
// -----------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------
export {
  formatTime,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getRemainingSeconds,
  isRunning
};