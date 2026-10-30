import {authorized,cleanText,error,json,ready,tagsFrom,validId} from '../../_lib/common.js';
export async function onRequestPatch({request,env,params}){
 if(!await authorized(request,env))return error('로그인 필요',401);
 if(!ready(env))return error('설정 오류',503);
 if(!validId(params.id))return error('잘못된 ID',400);
 try {const p=await request.json();const title=cleanText(p.title,90);if(!title)return error('제목을 입력하세요.');
 const row=await env.DB.prepare('SELECT id FROM pieces WHERE id=?').bind(params.id).first();if(!row)return error('수정할 작품이 없습니다.',404);
 await env.DB.prepare('UPDATE pieces SET title=?,description=?,category=?,tags=? WHERE id=?').bind(title,cleanText(p.description,2000),cleanText(p.category,40)||'기타',JSON.stringify(tagsFrom(p.tags)),params.id).run();return json({ok:true});
 }catch{return error('수정 실패',400)}
}
export async function onRequestDelete({request,env,params}){
 if(!await authorized(request,env))return error('로그인 필요',401);
 if(!ready(env))return error('설정 오류',503);
 if(!validId(params.id))return error('잘못된 ID',400);
 const row=await env.DB.prepare('SELECT image_key,video_key,pc_image_key,pc_video_key FROM pieces WHERE id=?').bind(params.id).first();if(!row)return error('삭제할 작품이 없습니다.',404);
 await env.DB.prepare('DELETE FROM pieces WHERE id=?').bind(params.id).run();
 for(const key of [row.image_key,row.video_key,row.pc_image_key,row.pc_video_key])if(key)await env.MEDIA_BUCKET.delete(key);
 return json({ok:true});
}
