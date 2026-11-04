# 오늘의 할 일

할 일을 못함·진행중·완료로 관리하는 웹앱입니다. Supabase 이메일 회원가입·로그인을 지원합니다. 할 일 목록은 현재 브라우저에 저장되며, 계정별 클라우드 저장은 별도 기능입니다.

## Vercel 설정

이 저장소를 Vercel에 연결하고 Framework Preset은 Other, 루트 디렉터리는 저장소 루트로 설정합니다. 별도 빌드 명령은 필요하지 않습니다. `api/supabase-config.js`가 Vercel Function으로 배포되어 환경 변수를 읽습니다.

Vercel → 프로젝트 → Settings → Environment Variables에서 다음 공개 설정이 Production에 존재하는지 확인하세요.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_`로 시작하는 공개 키

Supabase 연동이 제공하는 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`도 지원합니다. Vite의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`도 지원합니다. 공개 키는 브라우저에 전달되는 값입니다. Secret key나 service_role 키는 사용하지 않습니다. 잘못된 종류의 키는 API가 거부합니다.

환경 변수 변경 후에는 Vercel에서 Redeploy하세요. `/api/supabase-config`가 200을 반환해야 로그인이 작동합니다. HTML 파일을 직접 열거나 GitHub Pages로 열면 Vercel Function을 사용할 수 없습니다. 로컬 서버 개발 시에는 Vercel CLI의 `vercel dev`를 사용할 수 있습니다.

## Supabase 설정

1. Authentication에서 Email 제공자가 활성화되어 있는지 확인합니다.
2. Authentication → URL Configuration의 Site URL을 실제 Vercel 웹앱 주소로 설정합니다.
3. Redirect URLs에 같은 웹앱 주소(마지막 `/` 포함)를 허용합니다. Preview를 사용할 경우 필요한 Preview 주소도 명시적으로 추가합니다.
4. 이메일 확인을 사용하는 경우 회원가입 후 확인 메일의 링크를 누릅니다. 기본 메일 서비스의 제한 또는 발송 대상 제한이 발생하면 Supabase의 SMTP 설정을 확인합니다.

## 동작 확인

- 상단 로그인 버튼으로 팝업 열기, 회원가입/로그인 전환, Escape 또는 닫기 버튼으로 닫기
- 이메일과 비밀번호로 회원가입: 확인이 필요한 경우 메일 확인 안내
- 로그인 후 이메일과 로그아웃 표시, 새로고침 시 세션 복원
- 로그아웃 후 로그인 버튼 복원, 잘못된 비밀번호 또는 연결 오류 메시지
- 기존 할 일 추가·상태 변경·삭제 기능 유지

실제 회원가입·메일 발송 검증에는 배포 환경 변수와 Supabase 설정이 필요합니다.
