const { app, screen, nativeImage } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { ensureHudServer, createOverlayWindow, probeHud } = require('./runtime.cjs');

const cache = path.resolve(__dirname, '../node_modules/.cache');
fs.mkdirSync(cache, { recursive: true });
const directory = fs.mkdtempSync(path.join(cache, 'cs2-broadcast-hud-test-'));
app.setPath('userData', path.join(directory, 'profile'));
let server, window;
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  try {
    server = await ensureHudServer({ port: 32198, settingsFile: path.join(directory, 'settings.json') });
    assert.equal(server.owned, true, 'Test port 32198 must be free');
    const reuse = await ensureHudServer({ port: 32198 });
    assert.equal(reuse.owned, false);
    reuse.stop();
    assert.equal(await probeHud(32198), true, 'An existing server must survive stop() on a non-owner');
    const display = { ...screen.getPrimaryDisplay(), bounds: { x: 0, y: 0, width: 960, height: 540 } };
    window = await createOverlayWindow({ url: server.url, display, visible: false });
    assert.equal(window.isFocusable(), false);
    assert.equal(window.isAlwaysOnTop(), true);
    assert.equal(window.isResizable(), false);
    assert.equal(window.isVisible(), false);
    assert.deepEqual(window.getBounds(), display.bounds);
    assert.equal(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).isEmpty(), false);
    const view = await window.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
      let attempts=0;const timer=setInterval(()=>{
        if(document.querySelectorAll('.player').length===10){clearInterval(timer);resolve({
          html:getComputedStyle(document.documentElement).backgroundColor,
          body:getComputedStyle(document.body).backgroundColor,
          scenery:getComputedStyle(document.querySelector('.preview-scenery')).display,
          markers:document.querySelectorAll('.radar-player').length,
          node:typeof require,
          scale:document.getElementById('hud').style.transform
        });}else if(++attempts>250){clearInterval(timer);reject(new Error('HUD did not render'));}
      },20);
    })`);
    assert.equal(view.html, 'rgba(0, 0, 0, 0)');
    assert.equal(view.body, 'rgba(0, 0, 0, 0)');
    assert.equal(view.scenery, 'none');
    assert.equal(view.markers, 10);
    assert.equal(view.node, 'undefined');
    assert.equal(view.scale, 'scale(0.5)');
    if (process.platform === 'win32') {
      const handle = window.getNativeWindowHandle();
      const hwnd = handle.length === 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString();
      const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class HudWindowStyle { [DllImport("user32.dll", EntryPoint="GetWindowLongW")] public static extern int GetWindowLong(IntPtr hwnd, int index); }'
[HudWindowStyle]::GetWindowLong([IntPtr]::new([Int64]::Parse('${hwnd}')), -20)`;
      const style = Number(execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true }).trim()) >>> 0;
      assert.ok(style & 0x20, 'WS_EX_TRANSPARENT: mouse input passes through');
      assert.ok(style & 0x08000000, 'WS_EX_NOACTIVATE: overlay cannot steal keyboard focus');
      console.log(`Native Windows styles verified: 0x${style.toString(16)}`);
    }
    window.destroy();
    server.stop();
    for (let attempt = 0; attempt < 20 && await probeHud(32198); attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(await probeHud(32198), false, 'Owned server stops with the overlay');
    console.log('PASS: native overlay, transparency, click-through, no focus, HUD rendering, isolated renderer, server reuse and cleanup.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    if (window && !window.isDestroyed()) window.destroy();
    server?.stop();
    app.exit(1);
  }
});
