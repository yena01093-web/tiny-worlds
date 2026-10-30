import {authorized,builtins,cleanText,error,json,ready,asPiece,storeFile,tagsFrom} from '../_lib/common.js';
export async function onRequestGet({env}) {
 if(!ready(env))return error('DB/R2 연결 확인이 필요합니다.',503);
 try {const r=await env.DB.prepare('SELECT * FROM pieces ORDER BY created_at DESC').all();return json([...r.results.map(asPiece),...builtins]);}
 catch {return error('D1 테이블이 없습니다. schema.sql을 Console에서 실행하세요.',503)}
}
export async function onRequestPost({request,env}) {
 if(!await authorized(request,env))return error('로그인 필요',401);
 if(!ready(env))return error('DB/R2 연결 확인이 필요합니다.',503);
 try {
 const len=Number(request.headers.get('content-length')||0);if(len>60*1024*1024)return error('파일 크기가 너무 큽니다.',413);
 const form=await request.formData();
 const title=cleanText(form.get('title'),90),description=cleanText(form.get('description'),2000),category=cleanText(form.get('category'),40)||'기타', tags=tagsFrom(form.get('tags'));
 if(!title)return error('제목을 입력하세요.');
 const image=form.get('image'),video=form.get('video'),pcImage=form.get('pcImage'),pcVideo=form.get('pcVideo');
 if(![image,video,pcImage,pcVideo].some(f=>f instanceof File&&f.size))return error('이미지 또는 영상을 선택하세요.');
 const id=crypto.randomUUID(),keys=[];
 try {
 const imageKey=await storeFile(image,env,id,'image');if(imageKey)keys.push(imageKey);
 const videoKey=await storeFile(video,env,id,'video');if(videoKey)keys.push(videoKey);
 const pcImageKey=await storeFile(pcImage,env,id,'pc-image');if(pcImageKey)keys.push(pcImageKey);
 const pcVideoKey=await storeFile(pcVideo,env,id,'pc-video');if(pcVideoKey)keys.push(pcVideoKey);
 await env.DB.prepare('INSERT INTO pieces(id,title,description,category,tags,image_key,video_key,pc_image_key,pc_video_key) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,title,description,category,JSON.stringify(tags),imageKey,videoKey,pcImageKey,pcVideoKey).run();
 return json({ok:true,id},201);
 }catch(e){await Promise.allSettled(keys.map(k=>env.MEDIA_BUCKET.delete(k)));throw e;}
 }catch(e){return error(e.message||'업로드 실패',400)}
}
