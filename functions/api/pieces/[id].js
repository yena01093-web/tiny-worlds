import {authorized,cleanText,error,json,ready,storeFile,tagsFrom,validId} from '../../_lib/common.js';

export async function onRequestPatch({request,env,params}) {
 if(!await authorized(request,env))return error('로그인 필요',401);
 if(!ready(env))return error('DB/R2 연결을 확인하세요.',503);
 const id=params.id;
 if(!validId(id))return error('잘못된 작품 번호',400);
 const old=await env.DB.prepare('SELECT * FROM pieces WHERE id=?').bind(id).first();
 if(!old)return error('수정할 작품이 없습니다.',404);
 const newlyStored=[],oldKeys=[];
 try {
   const isMultipart=(request.headers.get('content-type')||'').includes('multipart/form-data');
   const form=isMultipart?await request.formData():null;
   const payload=form?Object.fromEntries([...form.entries()].filter(([k])=>['title','description','category','tags'].includes(k))):await request.json();
   const title=cleanText(payload.title??old.title,90);
   if(!title)return error('제목을 입력하세요.');
   const description=cleanText(payload.description??old.description,2000);
   const category=cleanText(payload.category??old.category,40)||'기타';
   const tags=tagsFrom(payload.tags??JSON.parse(old.tags||'[]'));
   const values={image:old.image_key,video:old.video_key,pcImage:old.pc_image_key,pcVideo:old.pc_video_key};
   if(form){for(const [name,kind] of [['image','image'],['video','video'],['pcImage','pc-image'],['pcVideo','pc-video']]){
     const file=form.get(name);
     if(file&&typeof file==='object'&&file.size>0){
       // A replacement uses a unique key; if the database update fails, old files remain usable.
       const key=await storeFile(file,env,id,kind+'-'+crypto.randomUUID());
       if(key){newlyStored.push(key);if(values[name])oldKeys.push(values[name]);values[name]=key;}
     }
   }}
   await env.DB.prepare('UPDATE pieces SET title=?,description=?,category=?,tags=?,image_key=?,video_key=?,pc_image_key=?,pc_video_key=? WHERE id=?')
      .bind(title,description,category,JSON.stringify(tags),values.image,values.video,values.pcImage,values.pcVideo,id).run();
   await Promise.allSettled(oldKeys.map(k=>env.MEDIA_BUCKET.delete(k)));
   return json({ok:true});
 }catch(e){
   await Promise.allSettled(newlyStored.map(k=>env.MEDIA_BUCKET.delete(k)));
   return error('수정 실패: '+String(e.message||e),400);
 }
}

export async function onRequestDelete({request,env,params}) {
 if(!await authorized(request,env))return error('로그인 필요',401);
 if(!ready(env))return error('DB/R2 연결을 확인하세요.',503);
 const id=params.id;
 if(!validId(id))return error('잘못된 작품 번호',400);
 try{
   const row=await env.DB.prepare('SELECT image_key,video_key,pc_image_key,pc_video_key FROM pieces WHERE id=?').bind(id).first();
   if(!row)return error('삭제할 작품이 없습니다.',404);
   await env.DB.prepare('DELETE FROM pieces WHERE id=?').bind(id).run();
   const keys=[row.image_key,row.video_key,row.pc_image_key,row.pc_video_key].filter(Boolean);
   const status=await Promise.allSettled(keys.map(k=>env.MEDIA_BUCKET.delete(k)));
   return json({ok:true,orphanedFiles:status.filter(s=>s.status==='rejected').length});
 }catch(e){return error('삭제 실패: '+String(e.message||e),500)}
}
