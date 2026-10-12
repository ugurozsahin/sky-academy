// #1354: the app was hidden after a game-ending answer, in the moment before its results overlay exists. Pause
// refuses an ended game, so nothing froze the pending results beat and `showResults()` spoke (and chimed) while
// the app was in the background. Freeze the screen's beats now and thaw them when the tab is visible again.
export function freezeUntilVisible(holdTimers: (open: boolean) => void): void {
  holdTimers(true);
  const back = () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', back);
    holdTimers(false);
  };
  document.addEventListener('visibilitychange', back);   // a disposed screen's scope ignores the late holdTimers(false)
}
