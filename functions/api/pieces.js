import {authorized,cleanText,error,json,ready,asPiece,storeFile,tagsFrom} from '../_lib/common.js';

export async function onRequestGet({env}) {
 if(!ready(env))return error('DB/R2 연결을 확인하세요.',503);
 try {
   const result=await env.DB.prepare('SELECT * FROM pieces ORDER BY created_at DESC').all();
   return json(result.results.map(asPiece));
 } catch(e) { return error('목록을 불러오지 못했습니다: '+String(e.message||e),500); }
}

export async function onRequestPost({request,env}) {
 if(!await authorized(request,env))return error('로그인 필요',401);
 if(!ready(env))return error('DB/R2 연결을 확인하세요.',503);
 const stored=[];
 try {
   const form=await request.formData();
   const title=cleanText(form.get('title'),90),description=cleanText(form.get('description'),2000);
   const category=cleanText(form.get('category'),40)||'기타',tags=tagsFrom(form.get('tags'));
   if(!title)return error('제목을 입력하세요.');
   const id=crypto.randomUUID(),values={};
   for(const [name,kind] of [['image','image'],['video','video'],['pcImage','pc-image'],['pcVideo','pc-video']]){
     values[name]=await storeFile(form.get(name),env,id,kind);
     if(values[name])stored.push(values[name]);
   }
   if(!stored.length)return error('이미지나 동영상을 하나 이상 선택하세요.');
   await env.DB.prepare('INSERT INTO pieces (id,title,description,category,tags,image_key,video_key,pc_image_key,pc_video_key) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(id,title,description,category,JSON.stringify(tags),values.image,values.video,values.pcImage,values.pcVideo).run();
   return json({ok:true,id},201);
 } catch(e) {
   await Promise.allSettled(stored.map(k=>env.MEDIA_BUCKET.delete(k)));
   return error('업로드 실패: '+String(e.message||e),400);
 }
}
