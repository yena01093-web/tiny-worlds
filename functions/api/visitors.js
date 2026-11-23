/** Tiny Worlds visitor counter: unique browsers for today (Asia/Seoul) and all time.
 * D1 binding name: DB (already bound to tiny-worlds-db).
 * Creates only tw_visitor_* tables. Existing gallery tables are untouched.
 * Visitor keys are random non-identifying cookie tokens; IPs are not stored.
 */
const responseHeaders = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const response = (data, status=200, extra={}) => new Response(JSON.stringify(data),{status,headers:{...responseHeaders,...extra}});

function koreaDay() {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=type=>parts.find(part=>part.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

async function ensureTables(db){
  await db.prepare('CREATE TABLE IF NOT EXISTS tw_visitor_unique (visitor_id TEXT PRIMARY KEY, first_day TEXT NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS tw_visitor_daily (visitor_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (visitor_id,day))').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS tw_visitor_daily_day ON tw_visitor_daily(day)').run();
}
async function getStats(db,day){
  const results=await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM tw_visitor_daily WHERE day=?').bind(day),
    db.prepare('SELECT COUNT(*) AS n FROM tw_visitor_unique')
  ]);
  return {today:Number(results[0]?.results?.[0]?.n||0),total:Number(results[1]?.results?.[0]?.n||0),timezone:'Asia/Seoul'};
}
function readVisitorCookie(request){
  const line=request.headers.get('Cookie')||'';
  const match=line.match(/(?:^|;\s*)__Host-tw_visitor=([a-f0-9-]{36})(?=;|$)/i);
  return match && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(match[1])?match[1]:null;
}
export async function onRequestGet({env}){
  if(!env.DB)return response({error:'D1 DB binding is missing'},503);
  try{
    await ensureTables(env.DB);
    return response(await getStats(env.DB,koreaDay()));
  }catch(e){console.error('visitor read:',e);return response({error:'방문자 집계를 확인할 수 없습니다.'},503);}
}
export async function onRequestPost({request,env}){
  if(!env.DB)return response({error:'D1 DB binding is missing'},503);
  const origin=request.headers.get('Origin');
  if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return response({error:'Origin not allowed'},403)}catch{return response({error:'Invalid origin'},403)}}
  if(request.headers.get('Sec-Fetch-Site')==='cross-site')return response({error:'Cross-site requests not allowed'},403);
  try{
    await ensureTables(env.DB);
    const day=koreaDay();
    const existing=readVisitorCookie(request);
    const visitorId=existing||crypto.randomUUID();
    // Uniqueness constraints prevent repeat reloads from inflating a browser's daily/total counts.
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO tw_visitor_unique (visitor_id,first_day) VALUES (?,?)').bind(visitorId,day),
      env.DB.prepare('INSERT OR IGNORE INTO tw_visitor_daily (visitor_id,day) VALUES (?,?)').bind(visitorId,day)
    ]);
    const stats=await getStats(env.DB,day);
    const extras=existing?{}:{'Set-Cookie':`__Host-tw_visitor=${visitorId}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000`};
    return response(stats,200,extras);
  }catch(e){console.error('visitor post:',e);return response({error:'방문자 집계를 기록할 수 없습니다.'},503);}
}
