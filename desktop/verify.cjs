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
    for (const [width,height] of [[1440,1080],[1280,1024]]) {
      window.setContentSize(width,height);
      await window.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const edges=await window.webContents.executeJavaScript(`(()=>{
        const left=document.querySelector('.team-column.left').getBoundingClientRect();
        const right=document.querySelector('.team-column.right').getBoundingClientRect();
        const radar=document.querySelector('.radar').getBoundingClientRect();
        const score=document.querySelector('.scoreboard').getBoundingClientRect();
        return {width:innerWidth,height:innerHeight,left:left.left,right:innerWidth-right.right,bottom:innerHeight-left.bottom,radarLeft:radar.left,radarTop:radar.top,scoreCenter:score.x+score.width/2};
      })()`);
      const margin=8*Math.min(edges.width/1920,edges.height/1080);
      for (const key of ['left','right','bottom','radarLeft','radarTop'])assert.ok(Math.abs(edges[key]-margin)<.1,`${width}x${height} ${key}: ${edges[key]}`);
      assert.ok(Math.abs(edges.scoreCenter-edges.width/2)<.1);
      if(width===1440)fs.writeFileSync(path.join(cache,'hud-4x3-review.png'),(await window.webContents.capturePage()).toPNG());
      console.log(`Aspect ratio ${width}x${height}: screen edges and centering verified`);
    }
    const customEdges=await window.webContents.executeJavaScript(`(async()=>{
      const {defaultLayout,applyLayout}=await import('/layout.js');
      const layout=defaultLayout();
      Object.assign(layout.elements.leftRoster,{x:20,y:100,scale:.8});
      Object.assign(layout.elements.rightRoster,{x:1920-20-333*.8,y:300,scale:.8});
      applyLayout(document.getElementById('hud'),layout);
      return ['left','right'].map(side=>{
        const rect=document.querySelector('.team-column.'+side).getBoundingClientRect();
        return {side:side==='left'?rect.left:innerWidth-rect.right,bottom:innerHeight-rect.bottom};
      });
    })()`);
    for(const edges of customEdges)assert.ok(Math.abs(edges.side-edges.bottom)<.1,JSON.stringify(edges));
    const fullDisplay=screen.getPrimaryDisplay();
    const fullWindow=await createOverlayWindow({url:server.url,display:fullDisplay,visible:false});
    try {
      assert.deepEqual(fullWindow.getBounds(),fullDisplay.bounds,'Overlay must cover the full monitor, including the taskbar area');
      assert.deepEqual(fullWindow.getContentSize(),[fullDisplay.bounds.width,fullDisplay.bounds.height]);
      const size=await fullWindow.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})');
      assert.deepEqual(size,{width:fullDisplay.bounds.width,height:fullDisplay.bounds.height});
      console.log('Full monitor verified:',fullDisplay.bounds,'taskbar work area:',fullDisplay.workArea);
    } finally {fullWindow.destroy();}
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
