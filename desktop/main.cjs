const { app, Menu, Tray, nativeImage, screen, globalShortcut, shell, dialog } = require('electron');
const path = require('node:path');
const { ensureHudServer, createOverlayWindow } = require('./runtime.cjs');

app.setName('CS2 Broadcast Hud');
app.setPath('userData', path.join(app.getPath('appData'), 'CS2 Broadcast Hud'));
let window, tray, server, displayId, quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window && !window.isDestroyed()) window.showInactive(); });
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Не удалось открыть CS2 Broadcast Hud', error.message);
    app.quit();
  });
}

function toggle() {
  if (!window || window.isDestroyed()) return;
  if (window.isVisible()) window.hide(); else window.showInactive();
  updateMenu();
}
function moveToDisplay(display) {
  if (!window || window.isDestroyed()) return;
  displayId = display.id;
  window.setBounds(display.bounds);
  window.setAlwaysOnTop(true, 'screen-saver');
  updateMenu();
}
function nextDisplay() {
  const displays = screen.getAllDisplays();
  const current = displays.findIndex(display => display.id === displayId);
  moveToDisplay(displays[(current + 1) % displays.length]);
}
function updateMenu() {
  if (!tray || !window || window.isDestroyed()) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'CS2 Broadcast Hud', enabled: false },
    { type: 'separator' },
    { label: window.isVisible() ? 'Скрыть HUD' : 'Показать HUD', accelerator: 'Ctrl+Shift+H', click: toggle },
    { label: 'Обновить HUD', accelerator: 'Ctrl+Shift+R', click: () => window.webContents.reloadIgnoringCache() },
    { label: 'Монитор', submenu: screen.getAllDisplays().map((display, index) => ({
      label: `${index + 1}. ${display.label || 'Экран'} — ${display.size.width} × ${display.size.height}`,
      type: 'radio', checked: display.id === displayId, click: () => moveToDisplay(display),
    })) },
    { label: 'Открыть панель управления', click: () => shell.openExternal('http://127.0.0.1:3199/') },
    { type: 'separator' },
    { label: 'Закрыть оверлей', accelerator: 'Ctrl+Shift+Q', click: () => app.quit() },
  ]));
}
async function start() {
  server = await ensureHudServer();
  if (quitting) { server.stop(); return; }
  const display = screen.getPrimaryDisplay();
  displayId = display.id;
  window = await createOverlayWindow({ url: server.url, display });
  if (quitting) { window.destroy(); return; }
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')));
  tray.setToolTip('CS2 Broadcast Hud · Ctrl+Shift+H: скрыть · Ctrl+Shift+Q: закрыть');
  tray.on('double-click', toggle);
  updateMenu();
  for (const [keys, callback] of [
    ['Control+Shift+H', toggle],
    ['Control+Shift+R', () => window.webContents.reloadIgnoringCache()],
    ['Control+Shift+M', nextDisplay],
    ['Control+Shift+Q', () => app.quit()],
  ]) {
    if (!globalShortcut.register(keys, callback)) console.warn(`Горячая клавиша ${keys} занята. Используйте меню CS2 Broadcast Hud в трее.`);
  }
  const refreshDisplays = () => moveToDisplay(screen.getAllDisplays().find(d => d.id === displayId) || screen.getPrimaryDisplay());
  screen.on('display-added', refreshDisplays);
  screen.on('display-removed', refreshDisplays);
  screen.on('display-metrics-changed', refreshDisplays);
  console.log('CS2 Broadcast Hud запущен. Ctrl+Shift+H — скрыть/показать; Ctrl+Shift+M — монитор; Ctrl+Shift+Q — закрыть.');
}
app.on('before-quit', () => { quitting = true; globalShortcut.unregisterAll(); tray?.destroy(); server?.stop(); });
app.on('window-all-closed', () => app.quit());
process.on('SIGINT', () => app.quit());
process.on('SIGTERM', () => app.quit());
