import {authorized,error,json} from '../_lib/common.js';
export async function onRequestPost({request,env}) {
 if(!env.ADMIN_PASSWORD)return error('Cloudflare에서 ADMIN_PASSWORD Secret을 먼저 설정하세요.',503);
 return await authorized(request,env)?json({ok:true}):error('관리자 비밀번호가 틀립니다.',401);
}
