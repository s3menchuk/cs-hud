import { createHash } from 'node:crypto';

export function validatePlayerId(id){
  if(typeof id!=='string'||!/^\d{1,20}$/.test(id))throw new Error('Неверный Steam ID игрока.');
  return id;
}
export function decodeAvatar(data){
  if(typeof data!=='string')throw new Error('Выберите PNG, JPG или WebP.');
  const match=data.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/);
  if(!match)throw new Error('Выберите PNG, JPG или WebP.');
  if(match[2].length>700000)throw new Error('Аватарка должна быть меньше 500 КБ.');
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>500000)throw new Error('Аватарка должна быть меньше 500 КБ.');
  const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid)throw new Error('Не удалось прочитать изображение.');
  const extension=match[1]==='jpeg'?'jpg':match[1];
  const filename=`${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  return {bytes,filename,url:'/avatars/'+filename};
}
