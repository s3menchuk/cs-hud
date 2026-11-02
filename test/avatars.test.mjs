import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlayerId, decodeAvatar } from '../avatars.mjs';
import { avatarURL } from '../public/player-avatars.js';
import { displaySettings } from '../public/teams.js';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
test('Avatar upload validates IDs, image types, signatures and sizes',()=>{
  assert.equal(validatePlayerId('76561198041683378'),'76561198041683378');
  assert.equal(validatePlayerId('0'),'0');
  for(const id of ['../file','__proto__','name',123,''])assert.throws(()=>validatePlayerId(id));
  const result=decodeAvatar(png);assert.match(result.url,/^\/avatars\/[a-f0-9]{64}\.png$/);
  assert.equal(result.filename,decodeAvatar(png).filename);
  assert.throws(()=>decodeAvatar('data:image/svg+xml;base64,PHN2Zy8+'));
  assert.throws(()=>decodeAvatar(png.replace('image/png','image/jpeg')));
  assert.throws(()=>decodeAvatar('data:image/png;base64,'+Buffer.alloc(500001).toString('base64')));
});
test('Avatars follow Steam ID across side swaps and ignore external image URLs',()=>{
  const url=decodeAvatar(png).url;
  const settings={leftSide:'CT',playerAvatars:{'123':{url,name:'Player'}}};
  assert.equal(avatarURL(settings,'123'),url);assert.equal(avatarURL(displaySettings(settings,'T'),'123'),url);
  assert.equal(avatarURL(settings,'456'),'');
  assert.equal(avatarURL({playerAvatars:{'123':{url:'https://example.com/photo.png'}}},'123'),'');
});
