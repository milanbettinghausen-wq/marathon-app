// Start
refresh();
// Mitternacht und Rueckkehr in die App: Ansicht aktualisieren
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (!$('#sheet').classList.contains('open') && !G) {
      const T = iso(todayDate());
      if (ui.tab === 'today' && ui.sel < T && !ui.touched) ui.sel = T;
      refresh();
    }
  }
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
