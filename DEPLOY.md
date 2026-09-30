# v0.7 배포 및 업데이트 순서

## 1. Apps Script는 Code.gs 하나만 교체

구글 스프레드시트에서 **확장 프로그램 → Apps Script**로 들어갑니다.

1. 기존 `Code.gs` 내용을 모두 지웁니다.
2. 이 패키지의 `apps-script-backend/Code.gs` 내용을 전체 붙여넣습니다.
3. 저장합니다.
4. 예전에 만든 `bridge.html` 파일이 있다면 **삭제해도 됩니다.** v0.7에서는 사용하지 않습니다.

Apps Script 프로젝트에는 기본적으로 다음만 있으면 됩니다.

- `Code.gs`
- `appsscript.json`(기본 설정 파일)

## 2. setupProject 실행

상단 함수 선택 메뉴에서 `setupProject`를 선택해 **1회 실행**합니다.

기존 학생/답변 데이터는 지우지 않고 필요한 시트를 확인·추가합니다.

- STUDENTS
- RESPONSES
- SUBMISSIONS
- GRADES
- SESSIONS (숨김)
- REGISTRATIONS (숨김)

## 3. GitHub Pages 주소를 Apps Script에 등록

Apps Script 왼쪽 **프로젝트 설정 → 스크립트 속성**에서 다음 속성을 추가합니다.

- 속성: `ALLOWED_ORIGIN`
- 값: GitHub Pages의 **origin만** 입력

예를 들어 학생용 주소가

```text
https://ygm9960-spec.github.io/royal-choice/
```

라면 입력값은

```text
https://ygm9960-spec.github.io
```

입니다. 뒤의 `/royal-choice/` 경로와 마지막 `/`는 넣지 않습니다.

아직 GitHub 주소를 정하지 않았다면 테스트 중에는 `*`로 둘 수 있지만, 실제 수행평가 전에는 정확한 GitHub origin으로 바꾸는 것을 권장합니다.

## 4. 교사 비밀번호 초기 설정

스크립트 속성에 잠시 다음 값을 추가합니다.

- 속성: `INITIAL_TEACHER_PASSWORD`
- 값: 사용할 교사 비밀번호

그 뒤 함수 목록에서 `initializeTeacherPassword`를 1회 실행합니다.
원문 비밀번호 속성은 실행 후 자동 삭제됩니다.

## 5. Apps Script 웹앱 배포

**배포 → 새 배포 → 유형 선택 → 웹 앱**

- 실행 사용자: **나**
- 액세스 권한: **모든 사용자**

배포 후 생성되는 `/exec` 주소를 복사합니다.

예:

```text
https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec
```

기존 배포를 업데이트할 때는 **배포 관리 → 수정 → 새 버전 → 배포**를 사용하면 기존 `/exec` 주소를 유지할 수 있습니다.

## 6. GitHub config.js 수정

`github-pages/config.js`를 열고 아래 값에 Apps Script `/exec` 주소를 넣습니다.

```javascript
window.ROYAL_CHOICE_CONFIG = {
  appsScriptUrl: 'https://script.google.com/macros/s/xxxxxxxxxxxxxxxx/exec'
};
```

## 7. GitHub Pages에 업로드

GitHub 저장소에 다음 파일/폴더를 올립니다.

- `index.html`
- `config.js`
- `assets/`

`Bridge.html`은 GitHub에도 Apps Script에도 올리지 않습니다.

## 8. 학생 명단 등록

웹앱 오른쪽 하단 숨김 영역을 5번 누르고 교사 비밀번호로 로그인합니다.
학생 명단을 아래처럼 붙여 넣습니다.

```text
1,1,홍길동
1,2,김학생
```

학생 비밀번호는 교사가 입력하지 않습니다.

## 9. 학생 최초 등록

학생은 다음 순서로 진행합니다.

1. `처음 접속인가요? 비밀번호 등록하기`
2. 반·번호·이름 입력
3. `등록 요청`
4. 교사가 관리 화면에서 `등록 승인`
5. 학생이 `승인 확인`
6. 학생 본인이 사용할 비밀번호 2회 입력
7. 수행평가 시작

## 배포 전 필수 테스트

- 학생 등록 요청 → 교사 승인 → 학생 비밀번호 설정
- 설정한 비밀번호로 재로그인
- 답변 자동저장
- 새로고침 후 답변 복구
- 인터넷 잠깐 끊은 뒤 재전송
- 교사용 메뉴 5회 탭 진입
- 비밀번호 초기화
- 재제출 허용
- 최종 제출 후 Google Sheets 기록 확인
