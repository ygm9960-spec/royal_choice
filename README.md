# 왕의 선택 v0.7 — Bridge.html 제거

학생 화면은 GitHub Pages, 로그인·저장·제출은 Google Apps Script, 데이터는 Google Sheets에 저장합니다.
학생은 Google 계정이 필요하지 않습니다.

## v0.7 핵심 변경

- `Bridge.html` 파일을 완전히 제거했습니다.
- Apps Script는 `Code.gs` 하나만 관리하면 됩니다.
- `Code.gs`의 `doGet()`이 GitHub Pages와 통신할 숨은 연결 페이지를 직접 생성합니다.
- GitHub의 `config.js`에는 Apps Script 웹앱 `/exec` 주소만 넣으면 됩니다.
- 기존 학생 직접 비밀번호 설정, 교사 승인, 자동저장, 39개 분기, 교사용 메뉴 기능은 그대로 유지합니다.

## 학생 로그인 방식

1. 교사는 `반,번호,이름` 명단만 등록합니다.
2. 학생이 처음 접속하여 `반 + 번호 + 이름`으로 등록 요청을 보냅니다.
3. 교사용 메뉴에서 해당 요청을 승인합니다.
4. 학생이 `승인 확인`을 누른 뒤 자기 비밀번호를 직접 2회 입력해 설정합니다.
5. 이후에는 `반 + 번호 + 본인이 만든 비밀번호`로 로그인합니다.

비밀번호 원문은 시트에 저장하지 않고 salt+hash만 저장합니다.

## 교사용 메뉴

학생 화면 오른쪽 하단의 거의 보이지 않는 숨김 영역을 1.8초 안에 5번 연속 탭하면 교사 로그인 창이 열립니다.
교사 비밀번호 인증 후 다음 기능을 사용할 수 있습니다.

- 학생 명단 등록
- 최초 등록 승인
- 학생 진행률/제출 상태 확인
- 학생 답변 열람
- 비밀번호 초기화
- 재제출 허용
- 25/20/15점 채점

## 파일 구조

- `github-pages/index.html`: 학생용 앱
- `github-pages/config.js`: Apps Script 웹앱 URL
- `github-pages/assets/`: 배경/인물 SVG
- `apps-script-backend/Code.gs`: 서버 로직 + GitHub 통신 페이지 생성
- `apps-script-backend/appsscript.json`: Apps Script 설정
- `student_accounts_template.csv`: 학생 명단 예시

**`Bridge.html`은 더 이상 없습니다.**
