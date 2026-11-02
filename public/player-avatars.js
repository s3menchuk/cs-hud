export function avatarURL(settings,id){
  const url=settings.playerAvatars?.[id]?.url;
  return typeof url==='string'&&/^\/avatars\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(url)?url:'';
}
export async function prepareAvatar(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5_000_000)throw new Error('avatarFileError');
  let bitmap;
  try{bitmap=await createImageBitmap(file);}catch{throw new Error('avatarDecodeError');}
  try{
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const context=canvas.getContext('2d'),size=Math.min(bitmap.width,bitmap.height);
    context.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,256,256);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));
    if(!blob)throw new Error('avatarDecodeError');
    return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('avatarDecodeError'));reader.readAsDataURL(blob);});
  }finally{bitmap.close();}
}
