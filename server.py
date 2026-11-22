"""Tiny Worlds local self-hosted gallery + administration, standard library only."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from email.parser import BytesParser
from email import policy
from pathlib import Path
from urllib.parse import urlparse, unquote
import os, json, uuid, hmac, re, threading, mimetypes

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
UPLOADS = ROOT / 'uploads'
DB = ROOT / 'gallery.json'
UPLOADS.mkdir(exist_ok=True)
ASSETS.mkdir(exist_ok=True)
HOST = os.getenv('TW_HOST', '127.0.0.1')
PORT = int(os.getenv('TW_PORT', '8765'))
PASSWORD = os.getenv('TW_ADMIN_PASSWORD', '')
LOCK = threading.RLock()
MAX_BYTES = 35 * 1024 * 1024
DEFAULT = [
    dict(id='hamster', title='쿠키 부스러기 속 햄스터', en='Cookie Crumb Hamsters', description='쿠키 조각 사이에서 뒹구는 작고 귀여운 햄스터들의 세상.', category='동물', tags=['햄스터','쿠키','미니어처','동물'], image='assets/hamster.jpg', downloads=0),
    dict(id='bunny', title='초콜릿 비스킷 토끼', en='Chocolate Biscuit Bunnies', description='달콤한 초콜릿 비스킷을 갉아 먹는 사랑스러운 토끼들.', category='디저트', tags=['토끼','초콜릿','디저트','귀여움'], image='assets/bunny.jpg', downloads=0),
    dict(id='piglet', title='솜사탕 구름의 아기 돼지', en='Cotton Candy Piglet', description='폭신한 솜사탕 구름을 먹는 아기 돼지의 판타지 세계.', category='판타지', tags=['돼지','솜사탕','판타지','동물'], image='assets/piglet.jpg', downloads=0)
]
if not DB.exists():
    DB.write_text(json.dumps(DEFAULT, ensure_ascii=False, indent=2), encoding='utf8')

def load():
    return json.loads(DB.read_text(encoding='utf8'))

def save(items):
    tmp = DB.with_suffix('.tmp')
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf8')
    tmp.replace(DB)

def public_piece(piece):
    # Keep older video files untouched on disk but exclude them from the public gallery.
    return {key: value for key, value in piece.items() if key not in ('video', 'pcVideo')}

def valid_file(data, extension):
    if extension in ('jpg','jpeg'): return data.startswith(b'\xff\xd8\xff')
    if extension == 'png': return data.startswith(b'\x89PNG\r\n\x1a\n')
    if extension == 'webp': return data[0:4] == b'RIFF' and data[8:12] == b'WEBP'
    return False

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def send_json(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode('utf8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers(); self.wfile.write(raw)
    def authorized(self):
        provided = self.headers.get('X-Admin-Password','')
        return bool(PASSWORD) and hmac.compare_digest(provided, PASSWORD)
    def needs_auth(self):
        if not self.authorized():
            self.send_json(403, {'error':'관리자 비밀번호가 올바르지 않습니다.'}); return True
        return False
    def get_body(self):
        try: length = int(self.headers.get('Content-Length','0'))
        except ValueError: length = 0
        if length <= 0 or length > MAX_BYTES:
            self.send_json(413, {'error':'사진 합계 용량 제한은 35MB입니다.'}); return None
        return self.rfile.read(length)
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/pieces':
            with LOCK: self.send_json(200, [public_piece(p) for p in load()])
            return
        if path.startswith('/download/'):
            match = re.fullmatch(r'/download/([\w-]+)/(image|pc-image)',path)
            if not match: self.send_error(404); return
            with LOCK:
                pieces = load(); piece = next((p for p in pieces if p['id'] == match[1]),None)
                field = 'pcImage' if match[2] == 'pc-image' else 'image'
                if not piece or not piece.get(field): self.send_error(404); return
                relative = piece[field]
                filepath = (ROOT / relative).resolve()
                if not filepath.is_relative_to(ASSETS.resolve()) and not filepath.is_relative_to(UPLOADS.resolve()):
                    self.send_error(403); return
                if not filepath.is_file(): self.send_error(404); return
                piece['downloads'] = piece.get('downloads',0)+1
                save(pieces)
            raw = filepath.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type',mimetypes.guess_type(filepath)[0] or 'application/octet-stream')
            self.send_header('Content-Disposition',f'attachment; filename="{piece["id"]}-{match[2]}{filepath.suffix}"')
            self.send_header('Content-Length',str(len(raw)))
            self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers(); self.wfile.write(raw); return
        if path in ('/gallery.json','/server.py','/README.txt') or path.startswith('/.') or path.lower().endswith(('.mp4','.webm')):
            self.send_error(403); return
        super().do_GET()
    def do_POST(self):
        path = urlparse(self.path).path
        if path == '/api/login':
            if self.needs_auth(): return
            self.send_json(200,{'ok':True}); return
        if path != '/api/pieces': self.send_error(404); return
        if self.needs_auth(): return
        body = self.get_body()
        if body is None: return
        content_type = self.headers.get('Content-Type','')
        if not content_type.startswith('multipart/form-data;'):
            self.send_json(400,{'error':'multipart 업로드만 허용됩니다.'}); return
        try:
            msg = BytesParser(policy=policy.default).parsebytes(b'Content-Type: '+content_type.encode()+b'\r\nMIME-Version: 1.0\r\n\r\n'+body)
            fields = {part.get_param('name',header='content-disposition'):part for part in msg.iter_parts()}
            title = fields['title'].get_content().strip()[:90]
            if not title: raise ValueError('제목을 입력하세요.')
            category = fields['category'].get_content().strip()[:40] or '기타'
            desc = fields.get('description').get_content().strip()[:400] if fields.get('description') else ''
            tags_text = fields.get('tags').get_content().strip()[:200] if fields.get('tags') else ''
            datafields = []
            if any(fields.get(name) and fields[name].get_filename() for name in ('video','pcVideo')):
                raise ValueError('동영상은 등록할 수 없습니다.')
            for field, extensions in [('image',{'jpg','jpeg','png','webp'}),('pcImage',{'jpg','jpeg','png','webp'})]:
                part = fields.get(field)
                if not part or not part.get_filename(): continue
                ext = Path(part.get_filename()).suffix.lstrip('.').lower()
                data = part.get_payload(decode=True)
                if ext not in extensions or not valid_file(data,ext) or len(data)>15*1024*1024: raise ValueError(f'{field} 사진 형식이나 용량을 확인하세요. (최대 15MB)')
                datafields.append((field,ext,data))
            if not datafields: raise ValueError('사진을 하나 이상 올려주세요.')
            uid = uuid.uuid4().hex[:12]
            item = dict(id=uid,title=title,en='',description=desc,category=category,tags=[s.strip() for s in tags_text.split(',') if s.strip()][:12],image='',pcImage='',downloads=0)
            for field,ext,data in datafields:
                filename=f'{uid}-{field}.{ext}'
                (UPLOADS/filename).write_bytes(data)
                item[field]='uploads/'+filename
            with LOCK:
                items=load(); items.insert(0,item); save(items)
            self.send_json(201,item)
        except (ValueError,KeyError) as exc:
            self.send_json(400,{'error':str(exc)})
        except Exception:
            self.send_json(400,{'error':'업로드 형식을 확인해주세요.'})
    def do_PATCH(self):
        match=re.fullmatch(r'/api/pieces/([\w-]+)',urlparse(self.path).path)
        if not match: self.send_error(404); return
        if self.needs_auth(): return
        body=self.get_body()
        if body is None: return
        new_files=[]
        try:
            content_type=self.headers.get('Content-Type','')
            if content_type.startswith('multipart/form-data;'):
                msg=BytesParser(policy=policy.default).parsebytes(b'Content-Type: '+content_type.encode()+b'\r\nMIME-Version: 1.0\r\n\r\n'+body)
                fields={part.get_param('name',header='content-disposition'):part for part in msg.iter_parts()}
                if any(fields.get(name) and fields[name].get_filename() for name in ('video','pcVideo')):
                    raise ValueError('동영상은 등록할 수 없습니다.')
                payload={name:part.get_content() for name,part in fields.items() if name in ('title','description','category','tags')}
                uploads={}
                for name in ('image','pcImage'):
                    part=fields.get(name)
                    if not part or not part.get_filename(): continue
                    ext=Path(part.get_filename()).suffix.lstrip('.').lower()
                    data=part.get_payload(decode=True)
                    if ext not in ('jpg','jpeg','png','webp') or not valid_file(data,ext) or len(data)>15*1024*1024:
                        raise ValueError('JPG, PNG, WebP 사진(15MB 이하)만 올릴 수 있습니다.')
                    filepath=UPLOADS/f'{match[1]}-{name}-{uuid.uuid4().hex[:8]}.{ext}'
                    filepath.write_bytes(data)
                    new_files.append(filepath)
                    uploads[name]='uploads/'+filepath.name
            else:
                payload=json.loads(body)
                uploads={}
            with LOCK:
                items=load(); item=next((x for x in items if x['id']==match[1]),None)
                if not item: self.send_json(404,{'error':'작품 없음'}); return
                for k in ('title','description','category'):
                    if k in payload and isinstance(payload[k],str): item[k]=payload[k].strip()[:400 if k=='description' else 90]
                if isinstance(payload.get('tags'),list): item['tags']=[str(t)[:40] for t in payload['tags'][:12]]
                elif isinstance(payload.get('tags'),str): item['tags']=[t.strip()[:40] for t in payload['tags'].split(',') if t.strip()][:12]
                if not item['title']: raise ValueError('제목이 필요합니다.')
                item.update(uploads)
                save(items)
            self.send_json(200,public_piece(item))
        except (ValueError,KeyError,TypeError):
            for filepath in new_files: filepath.unlink(missing_ok=True)
            self.send_json(400,{'error':'사진 형식이나 입력 내용을 확인해주세요.'})
    def do_DELETE(self):
        match=re.fullmatch(r'/api/pieces/([\w-]+)',urlparse(self.path).path)
        if not match: self.send_error(404); return
        if self.needs_auth(): return
        with LOCK:
            items=load(); item=next((x for x in items if x['id']==match[1]),None)
            if not item: self.send_json(404,{'error':'작품 없음'}); return
            save([x for x in items if x['id']!=match[1]])
            for field in ('image','pcImage','video','pcVideo'):
                p=(ROOT/item.get(field,'')).resolve()
                if p.is_relative_to(UPLOADS.resolve()) and p.is_file(): p.unlink()
        self.send_json(200,{'ok':True})
    def log_message(self,fmt,*args):
        if not self.path.startswith('/api/'): super().log_message(fmt,*args)

if __name__=='__main__':
    if not PASSWORD:
        print('설정 필요: TW_ADMIN_PASSWORD 환경변수로 관리자 비밀번호를 먼저 지정하세요.')
        raise SystemExit(1)
    print(f'Tiny Worlds: http://{HOST}:{PORT}  (Ctrl+C 종료)')
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
