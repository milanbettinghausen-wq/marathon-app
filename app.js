// Start
refresh();
stravaBoot();

// Zurueck in der App: Ansicht auffrischen und Strava abgleichen
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!$('#sheet').classList.contains('open') && !G) refresh();
  autoSync();
});
// Solange die App offen ist: alle 5 Minuten abgleichen, Zeitangabe mitlaufen lassen
setInterval(() => { if (document.visibilityState === 'visible') autoSync(); }, 5 * 60 * 1000);
setInterval(() => updateSyncUI(), 30 * 1000);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
