import {authorized,error,json} from '../_lib/common.js';

export async function onRequestPost({request,env}) {
  if(!env.ADMIN_PASSWORD)
    return error('관리자 비밀번호 설정이 필요합니다.',503);

  return await authorized(request,env)
    ? json({ok:true})
    : error('관리자 비밀번호가 틀립니다.',401);
}
