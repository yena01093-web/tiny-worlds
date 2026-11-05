export const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export const json = (data, status=200) => Response.json(data, { status, headers });
export const error = (message, status=400) => json({error:message},status);
export function ready(env) {return !!(env.DB && env.MEDIA_BUCKET);}
export async function authorized(request, env) {
  const expected = env.ADMIN_PASSWORD;
  const actual = request.headers.get('X-Admin-Password');
  if(!expected || !actual) return false;
  const enc=new TextEncoder();
  const [a,b] = await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(expected)),crypto.subtle.digest('SHA-256',enc.encode(actual))]);
  const aa=new Uint8Array(a),bb=new Uint8Array(b); let difference=0;
  for(let i=0;i<aa.length;i++) difference|=aa[i]^bb[i];
  return difference===0;
}
export function asPiece(row) {
  return {id:row.id,title:row.title,en:'',description:row.description||'',category:row.category||'기타',tags:JSON.parse(row.tags||'[]'),image:row.image_key?`/media/${encodeURIComponent(row.id)}/image`:null,video:row.video_key?`/media/${encodeURIComponent(row.id)}/video`:null,pcImage:row.pc_image_key?`/media/${encodeURIComponent(row.id)}/pc-image`:null,pcVideo:row.pc_video_key?`/media/${encodeURIComponent(row.id)}/pc-video`:null,downloads:row.downloads||0};
}
export const builtins=[];
export function validId(id){return typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id);}
export function cleanText(x,limit=500){return String(x??'').trim().slice(0,limit);}
export function tagsFrom(value){ if(Array.isArray(value))return value.map(x=>cleanText(x,40)).filter(Boolean).slice(0,12);return cleanText(value,500).split(',').map(x=>x.trim().slice(0,40)).filter(Boolean).slice(0,12); }
export async function storeFile(file, env, id,kind) {
 if(!(file instanceof File) || !file.size)return null;
 const isImage=kind.includes('image');
 const types=isImage?['image/jpeg','image/png','image/webp']:['video/mp4','video/webm'];
 const max=isImage?15*1024*1024:40*1024*1024;
 if(!types.includes(file.type))throw Error(`지원하지 않는 ${kind} 형식입니다.`);
 if(file.size>max)throw Error(`${kind} 크기가 제한을 넘었습니다. (이미지 15MB, 영상 40MB)`);
 const peek=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const jpg=peek[0]===255&&peek[1]===216&&peek[2]===255;
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>peek[i]===v);
 const webp=String.fromCharCode(...peek.slice(0,4))==='RIFF'&&String.fromCharCode(...peek.slice(8,12))==='WEBP';
 const mp4=String.fromCharCode(...peek.slice(4,8))==='ftyp';
 const webm=[26,69,223,163].every((v,i)=>peek[i]===v);
 const valid={'image/jpeg':jpg,'image/png':png,'image/webp':webp,'video/mp4':mp4,'video/webm':webm}[file.type];
 if(!valid)throw Error(`파일 내용이 확장자/MIME 타입과 일치하지 않습니다: ${kind}`);
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[file.type];
 const key=`art/${id}/${kind}.${ext}`;
 await env.MEDIA_BUCKET.put(key,file.stream(),{httpMetadata:{contentType:file.type}});
 return key;
}
export async function serveFile(context, download=false){
 const {env,params}=context;const id=params.id, kind=params.kind;
 if(!validId(id)||!['image','video','pc-image','pc-video'].includes(kind))return error('찾을 수 없습니다.',404);
 if(!ready(env))return error('서버 설정이 필요합니다.',503);
 const row=await env.DB.prepare('SELECT title,image_key,video_key,pc_image_key,pc_video_key FROM pieces WHERE id=?').bind(id).first();
 if(!row)return error('찾을 수 없습니다.',404);
 const key=({'image':row.image_key,'video':row.video_key,'pc-image':row.pc_image_key,'pc-video':row.pc_video_key})[kind];
 if(!key)return error('파일이 없습니다.',404);
 const object=await env.MEDIA_BUCKET.get(key);
 if(!object)return error('파일이 없습니다.',404);
 const mime=object.httpMetadata?.contentType || (kind.includes('image')?'image/jpeg':'video/mp4');
 const h=new Headers({'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300'});
 if(download){h.set('Content-Disposition',`attachment; filename="tinyworlds-${id}.${mime==='image/png'?'png':mime==='image/webp'?'webp':mime==='video/webm'?'webm':kind.includes('image')?'jpg':'mp4'}"`);h.set('Cache-Control','no-store');context.waitUntil(env.DB.prepare('UPDATE pieces SET downloads = downloads + 1 WHERE id=?').bind(id).run());}
 return new Response(object.body,{headers:h});
}
