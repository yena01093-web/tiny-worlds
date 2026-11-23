Tiny Worlds — 사진 전용 무료 배경화면 사이트

시작하기 (Windows)
1. Python 3 설치 (설치 시 Add Python to PATH 선택)
2. 이 폴더에서 start-windows.bat 실행
3. 표시되는 안내에 따라 관리자 비밀번호 입력
4. 브라우저에서 http://127.0.0.1:8765 접속
5. 상단 '관리자' 클릭 후 같은 비밀번호로 로그인
6. 휴대폰용 세로 사진 또는 PC용 가로 사진(JPG/PNG/WebP)을 업로드하면 갤러리에 자동 등록됩니다.

Mac/Linux: 터미널에서 TW_ADMIN_PASSWORD 환경변수를 정한 뒤 python3 server.py 실행.

저장 구조
- gallery.json: 작품 제목·카테고리·태그·다운로드 횟수
- uploads/: 업로드한 실제 이미지 파일(이전 동영상은 삭제하지 않고 보존)
- assets/: 초기 햄스터/토끼/돼지 원본

중요
- index.html을 직접 더블클릭하면 갤러리 미리보기는 되지만 업로드는 안 됩니다.
  업로드하려면 반드시 server.py를 실행하여 http://127.0.0.1:8765 로 접속하세요.
- 현재 서버는 본인 PC(로컬)에서 사용하도록 기본 설정되어 있습니다.
- 서버가 켜져 있는 동안 같은 사이트에서 수정/삭제와 다운로드 집계를 할 수 있습니다.
- gallery.json과 uploads/ 폴더를 정기적으로 백업하세요.
- 인터넷 공개 사이트는 별도 호스팅, HTTPS, 파일 저장소와 보안 강화를 거친 뒤 운영하세요.
- 사진 업로드는 한 파일당 15MB, 한 요청당 총 35MB까지 지원합니다. 영상 업로드와 재생은 제공하지 않습니다.
- 이전에 업로드한 영상 파일은 자동 삭제되지 않으며, 새 갤러리에서는 표시되지 않습니다.
- PC/모바일 별도 원본 리사이징, 계정/결제는 추후 개발 항목입니다.

2026-11-23 업데이트: 유튜브 채널 바로가기 3개 추가
- MaltiGo Travel: https://www.youtube.com/@MaltiGoTravel
- Giant Hand Art: https://www.youtube.com/@GiantHandArt
- Susanghan Store: https://www.youtube.com/@SusanghanStore
- 사이트에 영상은 표시하거나 업로드하지 않고, 버튼 클릭 시 유튜브 사이트로 이동합니다.


[추가 업데이트: 4K Ultra HD 강조]
- 메인 화면에 4K Ultra HD / 고화질 배경화면 문구를 강조했습니다.
- 각 사진은 브라우저에서 실제 이미지 픽셀 크기를 읽습니다.
- 가로 3840×2160 또는 세로 2160×3840 이상인 파일에만 4K Ultra HD 배지가 표시됩니다.
- 낮은 해상도 사진은 고화질/실제 해상도로 표시되며 4K라고 광고하지 않습니다.
- 사진 원본은 수정, 확대/업스케일 또는 삭제되지 않습니다.
- 외부 유튜브 채널 3개 링크와 사진만 업로드하는 기능도 그대로 유지됩니다.
- 공개 사이트는 아직 갱신되지 않았습니다. GitHub의 tiny-worlds 저장소에 파일을 올리고 배포를 확인해야 합니다.


[NEW] 오늘/전체 방문자 자동 집계
- Cloudflare Pages Functions: functions/api/visitors.js (새 파일)
- D1 기존 연결 이름 DB / tiny-worlds-db 그대로 사용. R2 추가 설정 불필요.
- 사이트 접속 시 오늘 방문자 / 전체 방문자가 자동 표시됩니다.
- 엔드포인트에서 tw_visitor_unique, tw_visitor_daily 테이블 및 인덱스를 자동으로 생성합니다.
- 한국 시간(Asia/Seoul) 기준 날짜, 브라우저별 1일 1회/누적 1회 집계입니다.
- 익명 랜덤 식별 쿠키 사용, IP 주소/이름을 저장하지 않습니다. 쿠키 차단이나 삭제로 중복 집계될 수 있습니다.
- 과거 방문자를 소급해서 계산할 수 없으며 배포 후 집계를 시작합니다.
- 정상 배포 후 https://tiny-worlds.pages.dev/api/visitors 로 접속해 JSON(today,total)을 확인할 수 있습니다.
- 주의: 파일 두 개만 복사할 경우 index.html + functions/api/visitors.js 모두 업로드해야 표시됩니다.
- GitHub 저장소에 파일을 추가/교체한 다음 Cloudflare Pages production 배포 성공을 확인하세요.
