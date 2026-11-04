const { BrowserWindow, utilityProcess } = require('electron');
const path = require('node:path');

async function probeHud(port) {
  let response;
  try { response = await fetch(`http://127.0.0.1:${port}/api/state`, { signal: AbortSignal.timeout(1000) }); }
  catch { return false; }
  let payload;
  try { payload = await response.json(); } catch {}
  if (!response.ok || !Array.isArray(payload?.state?.players) || typeof payload?.settings?.leftName !== 'string') {
    throw new Error(`Порт ${port} занят другим приложением. Освободите его перед запуском оверлея.`);
  }
  return true;
}

async function ensureHudServer({ port = 3199, settingsFile } = {}) {
  if (await probeHud(port)) return { url: `http://127.0.0.1:${port}/overlay`, owned: false, stop() {} };
  const project = path.resolve(__dirname, '..');
  const child = utilityProcess.fork(path.join(project, 'server.mjs'), [], {
    cwd: project,
    env: { ...process.env, HUD_PORT: String(port), ...(settingsFile ? { HUD_SETTINGS_FILE: settingsFile } : {}) },
    serviceName: 'CS2 Broadcast Hud server',
    stdio: 'pipe',
  });
  let failure = '';
  child.stderr?.on('data', chunk => { failure = (failure + chunk).slice(-2000); });
  let exited = false;
  child.once('exit', () => { exited = true; });
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await probeHud(port)) return { url: `http://127.0.0.1:${port}/overlay`, owned: !exited, stop() { if (!exited) child.kill(); } };
      if (exited) throw new Error(failure || 'Сервер HUD завершился при запуске.');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Сервер HUD не ответил. Проверьте доступность локального порта.');
  } catch (error) { child.kill(); throw error; }
}

async function createOverlayWindow({ url, display, visible = true }) {
  const window = new BrowserWindow({
    ...display.bounds,
    title: 'CS2 Broadcast Hud — локальный оверлей',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  window.setMenu(null);
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setIgnoreMouseEvents(true, { forward: true });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, destination) => { if (destination !== url) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  try { await window.loadURL(url); }
  catch (error) { window.destroy(); throw error; }
  if (visible) window.showInactive();
  return window;
}

module.exports = { ensureHudServer, createOverlayWindow, probeHud };
