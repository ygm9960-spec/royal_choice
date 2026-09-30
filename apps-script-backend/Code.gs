const RC = {
  SHEETS: {
    STUDENTS: 'STUDENTS',
    RESPONSES: 'RESPONSES',
    SUBMISSIONS: 'SUBMISSIONS',
    GRADES: 'GRADES',
    SESSIONS: 'SESSIONS',
    REGISTRATIONS: 'REGISTRATIONS'
  },
  SESSION_HOURS: 4,
  LOGIN_FAIL_LIMIT: 7,
  LOGIN_FAIL_TTL: 300
};

function doGet() {
  const allowedOrigin = PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGIN') || '*';
  return HtmlService.createHtmlOutput(buildBackendGatewayHtml_(allowedOrigin))
    .setTitle('왕의 선택 저장 연결')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 별도 HTML 파일 없이 Code.gs 자체가 GitHub Pages와 google.script.run 사이의
 * 숨은 통신 페이지를 생성합니다. 학생에게는 이 화면이 보이지 않습니다.
 */
function buildBackendGatewayHtml_(allowedOrigin) {
  const originJson = JSON.stringify(String(allowedOrigin || '*'));
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow">
  <style>html,body{margin:0;width:1px;height:1px;overflow:hidden;background:transparent}</style>
</head>
<body>
<script>
const ALLOWED_ORIGIN = ${originJson};
const METHODS = new Set([
  'studentLogin','requestStudentRegistration','getStudentRegistrationStatus','setInitialStudentPassword',
  'logout','saveStudentState','getStudentState','submitFinal',
  'teacherLogin','teacherBulkUpsertStudents','teacherApproveRegistration','teacherResetStudentPassword','teacherSetStudentPassword',
  'teacherGetDashboard','teacherGetStudentRecord','teacherSaveGrade','teacherAllowResubmit'
]);
function allowed(origin){ return ALLOWED_ORIGIN === '*' || origin === ALLOWED_ORIGIN; }
function reply(origin,payload){ window.parent.postMessage(payload, ALLOWED_ORIGIN === '*' ? origin : ALLOWED_ORIGIN); }
function invoke(method,args,onSuccess,onFailure){
  const r=google.script.run.withSuccessHandler(onSuccess).withFailureHandler(onFailure);
  switch(method){
    case 'studentLogin': return r.studentLogin(...args);
    case 'requestStudentRegistration': return r.requestStudentRegistration(...args);
    case 'getStudentRegistrationStatus': return r.getStudentRegistrationStatus(...args);
    case 'setInitialStudentPassword': return r.setInitialStudentPassword(...args);
    case 'logout': return r.logout(...args);
    case 'saveStudentState': return r.saveStudentState(...args);
    case 'getStudentState': return r.getStudentState(...args);
    case 'submitFinal': return r.submitFinal(...args);
    case 'teacherLogin': return r.teacherLogin(...args);
    case 'teacherBulkUpsertStudents': return r.teacherBulkUpsertStudents(...args);
    case 'teacherApproveRegistration': return r.teacherApproveRegistration(...args);
    case 'teacherResetStudentPassword': return r.teacherResetStudentPassword(...args);
    case 'teacherSetStudentPassword': return r.teacherSetStudentPassword(...args);
    case 'teacherGetDashboard': return r.teacherGetDashboard(...args);
    case 'teacherGetStudentRecord': return r.teacherGetStudentRecord(...args);
    case 'teacherSaveGrade': return r.teacherSaveGrade(...args);
    case 'teacherAllowResubmit': return r.teacherAllowResubmit(...args);
    default: throw new Error('허용되지 않은 요청입니다.');
  }
}
window.addEventListener('message',(event)=>{
  if(!allowed(event.origin)) return;
  const m=event.data||{};
  if(m.type!=='RC_CALL'||!m.id||!METHODS.has(m.method)) return;
  try{
    invoke(m.method,Array.isArray(m.args)?m.args:[],
      value=>reply(event.origin,{type:'RC_RESULT',id:m.id,ok:true,value}),
      err=>reply(event.origin,{type:'RC_RESULT',id:m.id,ok:false,error:(err&&err.message)||String(err)})
    );
  }catch(err){ reply(event.origin,{type:'RC_RESULT',id:m.id,ok:false,error:err.message||String(err)}); }
});
window.parent.postMessage({type:'RC_BACKEND_READY'}, ALLOWED_ORIGIN==='*'?'*':ALLOWED_ORIGIN);
<\/script>
</body>
</html>`;
}

/** 최초 1회 실행: 시트와 서버 비밀키를 준비합니다. */
function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('이 Apps Script는 구글 스프레드시트에 연결하여 실행하세요.');
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PROJECT_SECRET')) props.setProperty('PROJECT_SECRET', Utilities.getUuid() + Utilities.getUuid());

  ensureSheet_(ss, RC.SHEETS.STUDENTS, ['studentId','classNo','number','name','passwordSalt','passwordHash','active','passwordVersion','updatedAt']);
  ensureSheet_(ss, RC.SHEETS.RESPONSES, ['studentId','classNo','number','name','status','progress','screenKey','stateJson','updatedAt']);
  ensureSheet_(ss, RC.SHEETS.SUBMISSIONS, ['submissionId','studentId','classNo','number','name','submittedAt','stateJson']);
  ensureSheet_(ss, RC.SHEETS.GRADES, ['studentId','classNo','number','name','situation','logic','perspectives','judgment','total','comment','gradedAt']);
  const sessionSheet = ensureSheet_(ss, RC.SHEETS.SESSIONS, ['tokenHash','studentId','role','expiresAt','createdAt','passwordVersion']);
  const regSheet = ensureSheet_(ss, RC.SHEETS.REGISTRATIONS, ['requestId','requestTokenHash','studentId','status','requestedAt','approvedAt','completedAt']);
  sessionSheet.hideSheet();
  regSheet.hideSheet();
  return '초기화 완료';
}

/**
 * Project Settings > Script Properties에 INITIAL_TEACHER_PASSWORD를 잠시 추가한 뒤 실행합니다.
 * 실행이 끝나면 원문 비밀번호 속성은 자동 삭제됩니다.
 */
function initializeTeacherPassword() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('INITIAL_TEACHER_PASSWORD');
  if (!raw || raw.length < 4) throw new Error('Script Properties에 INITIAL_TEACHER_PASSWORD를 먼저 설정하세요.');
  if (!props.getProperty('PROJECT_SECRET')) props.setProperty('PROJECT_SECRET', Utilities.getUuid() + Utilities.getUuid());
  const salt = Utilities.getUuid();
  props.setProperty('TEACHER_SALT', salt);
  props.setProperty('TEACHER_HASH', hashCredential_(salt, raw));
  props.deleteProperty('INITIAL_TEACHER_PASSWORD');
  return '교사 비밀번호 설정 완료. 원문 속성은 삭제되었습니다.';
}

function studentLogin(classNo, number, password) {
  classNo = String(classNo || '').trim();
  number = String(number || '').trim();
  password = String(password || '');
  if (!classNo || !number || !password) throw new Error('반, 번호, 비밀번호를 모두 입력하세요.');

  const rateKey = 'fail:' + classNo + ':' + number;
  const cache = CacheService.getScriptCache();
  const failCount = Number(cache.get(rateKey) || 0);
  if (failCount >= RC.LOGIN_FAIL_LIMIT) throw new Error('로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.');

  const row = findStudentByClassNumber_(classNo, number);
  if (!row || String(row.active).toUpperCase() === 'FALSE') {
    cache.put(rateKey, String(failCount + 1), RC.LOGIN_FAIL_TTL);
    throw new Error('계정을 확인할 수 없습니다. 선생님께 문의하세요.');
  }
  if (!String(row.passwordHash || '')) {
    throw new Error('아직 비밀번호가 설정되지 않았습니다. 처음 등록 메뉴를 이용하세요.');
  }
  if (hashCredential_(row.passwordSalt, password) !== row.passwordHash) {
    cache.put(rateKey, String(failCount + 1), RC.LOGIN_FAIL_TTL);
    throw new Error('비밀번호가 맞지 않습니다.');
  }
  cache.remove(rateKey);

  const token = createSession_(row.studentId, 'student', Number(row.passwordVersion || 1));
  const saved = getResponseByStudent_(row.studentId);
  return {
    token: token,
    student: { studentId: row.studentId, classNo: row.classNo, number: row.number, name: row.name },
    savedStateJson: saved ? saved.stateJson : '',
    status: saved ? saved.status : 'DRAFT'
  };
}

/**
 * 학생 최초 등록 요청.
 * 교사가 미리 등록해 둔 반/번호/이름과 정확히 일치해야 하며,
 * 승인 전에는 비밀번호를 설정할 수 없습니다.
 */
function requestStudentRegistration(classNo, number, name) {
  classNo = String(classNo || '').trim();
  number = String(number || '').trim();
  name = String(name || '').trim();
  if (!classNo || !number || !name) throw new Error('반, 번호, 이름을 모두 입력하세요.');

  const student = findStudentByClassNumber_(classNo, number);
  if (!student || String(student.active).toUpperCase() === 'FALSE' || String(student.name).trim() !== name) {
    throw new Error('학생 명단과 일치하지 않습니다. 반, 번호, 이름을 확인하세요.');
  }
  if (String(student.passwordHash || '')) {
    return { status: 'ACTIVE', message: '이미 비밀번호 설정이 완료된 계정입니다. 로그인 메뉴를 이용하세요.' };
  }

  const requestId = 'REG-' + Utilities.getUuid().slice(0, 8);
  const requestToken = Utilities.getUuid() + Utilities.getUuid();
  const now = new Date().toISOString();
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.REGISTRATIONS);

  expireOpenRegistrationRequests_(student.studentId);
  sheet.appendRow([requestId, tokenHash_(requestToken), student.studentId, 'PENDING', now, '', '']);

  return {
    status: 'PENDING',
    requestId: requestId,
    requestToken: requestToken,
    student: { studentId: student.studentId, classNo: student.classNo, number: student.number, name: student.name }
  };
}

function getStudentRegistrationStatus(requestToken) {
  const reg = findRegistrationByToken_(requestToken);
  if (!reg) throw new Error('등록 요청을 찾을 수 없습니다. 처음 등록을 다시 요청하세요.');
  const student = findStudentById_(reg.studentId);
  if (!student) throw new Error('학생 계정을 찾을 수 없습니다.');
  return {
    status: String(reg.status || ''),
    requestId: reg.requestId,
    student: { studentId: student.studentId, classNo: student.classNo, number: student.number, name: student.name }
  };
}

function setInitialStudentPassword(requestToken, newPassword) {
  newPassword = String(newPassword || '');
  if (newPassword.length < 4) throw new Error('비밀번호는 4자 이상으로 설정하세요.');

  const reg = findRegistrationByToken_(requestToken);
  if (!reg) throw new Error('등록 요청을 찾을 수 없습니다.');
  if (String(reg.status) !== 'APPROVED') {
    if (String(reg.status) === 'PENDING') throw new Error('아직 교사 승인 전입니다.');
    if (String(reg.status) === 'COMPLETED') throw new Error('이미 비밀번호 설정이 완료되었습니다. 로그인하세요.');
    throw new Error('현재 요청으로는 비밀번호를 설정할 수 없습니다.');
  }

  const student = findStudentById_(reg.studentId);
  if (!student) throw new Error('학생 계정을 찾을 수 없습니다.');

  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.STUDENTS);
  const salt = Utilities.getUuid();
  const hash = hashCredential_(salt, newPassword);
  const version = Number(student.passwordVersion || 0) + 1;
  const record = [student.studentId, student.classNo, student.number, student.name, salt, hash, true, version, new Date().toISOString()];
  upsertRowByKey_(sheet, 1, student.studentId, record);
  deleteStudentSessions_(student.studentId);
  markRegistration_(reg.requestId, 'COMPLETED', { completedAt: new Date().toISOString() });

  const token = createSession_(student.studentId, 'student', version);
  const saved = getResponseByStudent_(student.studentId);
  return {
    token: token,
    student: { studentId: student.studentId, classNo: student.classNo, number: student.number, name: student.name },
    savedStateJson: saved ? saved.stateJson : '',
    status: saved ? saved.status : 'DRAFT'
  };
}

function teacherLogin(password) {
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('TEACHER_SALT');
  const hash = props.getProperty('TEACHER_HASH');
  if (!salt || !hash) throw new Error('교사 비밀번호가 초기화되지 않았습니다.');
  if (hashCredential_(salt, String(password || '')) !== hash) throw new Error('교사 비밀번호가 맞지 않습니다.');
  return { token: createSession_('TEACHER', 'teacher', 1) };
}

function logout(token) {
  if (!token) return true;
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(RC.SHEETS.SESSIONS);
  const values = sheet.getDataRange().getValues();
  const th = tokenHash_(token);
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][0] === th) sheet.deleteRow(i + 1);
  }
  return true;
}

function saveStudentState(token, stateJson) {
  const session = validateSession_(token, 'student');
  const student = findStudentById_(session.studentId);
  if (!student) throw new Error('학생 계정이 없습니다.');
  const state = safeParse_(stateJson);
  const progress = computeProgress_(state);
  const screenKey = state && state.screen ? String(state.screen.mode || '') : '';
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    upsertResponse_(student, 'DRAFT', progress, screenKey, stateJson);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, savedAt: new Date().toISOString(), progress: progress };
}

function getStudentState(token) {
  const session = validateSession_(token, 'student');
  const row = getResponseByStudent_(session.studentId);
  return row ? { stateJson: row.stateJson, status: row.status, updatedAt: row.updatedAt } : { stateJson: '', status: 'DRAFT' };
}

function submitFinal(token, stateJson) {
  const session = validateSession_(token, 'student');
  const student = findStudentById_(session.studentId);
  const state = safeParse_(stateJson);
  const validation = validateFinalState_(state);
  if (!validation.ok) throw new Error(validation.message);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const existing = getSubmissionByStudent_(student.studentId);
    if (existing) {
      upsertResponse_(student, 'SUBMITTED', 100, 'complete', stateJson);
      return { ok: true, submissionId: existing.submissionId, submittedAt: existing.submittedAt, alreadySubmitted: true };
    }
    const submissionId = 'RC-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8);
    const submittedAt = new Date().toISOString();
    const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.SUBMISSIONS);
    sheet.appendRow([submissionId, student.studentId, student.classNo, student.number, student.name, submittedAt, stateJson]);
    upsertResponse_(student, 'SUBMITTED', 100, 'complete', stateJson);
    ensureGradeRow_(student);
    return { ok: true, submissionId: submissionId, submittedAt: submittedAt, alreadySubmitted: false };
  } finally {
    lock.releaseLock();
  }
}

function teacherBulkUpsertStudents(token, rows) {
  validateSession_(token, 'teacher');
  if (!Array.isArray(rows) || !rows.length) throw new Error('등록할 학생 정보가 없습니다.');
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(RC.SHEETS.STUDENTS);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  let count = 0;
  try {
    rows.forEach(function(r) {
      const classNo = String(r.classNo || '').trim();
      const number = String(r.number || '').trim();
      const name = String(r.name || '').trim();
      if (!classNo || !number || !name) throw new Error('반, 번호, 이름을 확인하세요: ' + JSON.stringify(r));
      const studentId = makeStudentId_(classNo, number);
      const existing = findStudentById_(studentId);
      const record = existing
        ? [studentId, classNo, number, name, existing.passwordSalt || '', existing.passwordHash || '', true, Number(existing.passwordVersion || 0), new Date().toISOString()]
        : [studentId, classNo, number, name, '', '', true, 0, new Date().toISOString()];
      upsertRowByKey_(sheet, 1, studentId, record);
      count++;
    });
  } finally {
    lock.releaseLock();
  }
  return { ok: true, count: count };
}

function teacherApproveRegistration(token, requestId) {
  validateSession_(token, 'teacher');
  const reg = findRegistrationById_(requestId);
  if (!reg) throw new Error('등록 요청을 찾을 수 없습니다.');
  if (String(reg.status) !== 'PENDING') throw new Error('승인 대기 중인 요청이 아닙니다.');
  markRegistration_(requestId, 'APPROVED', { approvedAt: new Date().toISOString() });
  return { ok: true };
}

/**
 * 비밀번호를 잊은 학생을 위한 초기화.
 * 같은 기기에 남아 있는 최근 등록 토큰이 있으면 즉시 새 비밀번호를 설정할 수 있고,
 * 그렇지 않으면 학생이 새 등록 요청을 보내고 교사가 한 번 더 승인하면 됩니다.
 */
function teacherResetStudentPassword(token, studentId) {
  validateSession_(token, 'teacher');
  const student = findStudentById_(studentId);
  if (!student) throw new Error('학생을 찾을 수 없습니다.');

  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.STUDENTS);
  const version = Number(student.passwordVersion || 0) + 1;
  const record = [student.studentId, student.classNo, student.number, student.name, '', '', true, version, new Date().toISOString()];
  upsertRowByKey_(sheet, 1, student.studentId, record);
  deleteStudentSessions_(student.studentId);

  const latest = getLatestRegistrationForStudent_(student.studentId);
  if (latest && String(latest.status) === 'COMPLETED') {
    markRegistration_(latest.requestId, 'APPROVED', { approvedAt: new Date().toISOString(), completedAt: '' });
  }
  return { ok: true };
}

// 이전 버전 호환용. 교사용 화면에서는 사용하지 않습니다.
function teacherSetStudentPassword(token, studentId, newPassword) {
  validateSession_(token, 'teacher');
  throw new Error('v0.6부터 학생이 직접 비밀번호를 설정합니다. 비밀번호 초기화를 사용하세요.');
}

function teacherAllowResubmit(token, studentId) {
  validateSession_(token, 'teacher');
  const student = findStudentById_(studentId);
  if (!student) throw new Error('학생을 찾을 수 없습니다.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    deleteRowsByKey_(getSpreadsheet_().getSheetByName(RC.SHEETS.SUBMISSIONS), 2, studentId);
    deleteRowsByKey_(getSpreadsheet_().getSheetByName(RC.SHEETS.GRADES), 1, studentId);

    const response = getResponseByStudent_(studentId);
    let state = response && response.stateJson ? safeParse_(response.stateJson) : {};
    state.submitted = false;
    state.receipt = null;
    state.screen = { mode: 'epilogue' };
    state.meta = state.meta || {};
    state.meta.updatedAt = Date.now();
    const stateJson = JSON.stringify(state);
    upsertResponse_(student, 'DRAFT', Math.min(99, computeProgress_(state)), 'epilogue', stateJson);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function teacherGetDashboard(token) {
  validateSession_(token, 'teacher');
  const students = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.STUDENTS)).map(function(r) {
    const response = getResponseByStudent_(r.studentId);
    const submission = getSubmissionByStudent_(r.studentId);
    const grade = getGradeByStudent_(r.studentId);
    const reg = getLatestRegistrationForStudent_(r.studentId);
    const registrationStatus = String(r.passwordHash || '') ? 'ACTIVE' : (reg ? String(reg.status || 'UNREGISTERED') : 'UNREGISTERED');
    return {
      studentId: r.studentId, classNo: r.classNo, number: r.number, name: r.name,
      active: r.active, registrationStatus: registrationStatus,
      registrationRequestId: reg ? reg.requestId : '',
      registrationRequestedAt: reg ? reg.requestedAt : '',
      status: submission ? 'SUBMITTED' : (response ? response.status : 'NOT_STARTED'),
      progress: response ? response.progress : 0, updatedAt: response ? response.updatedAt : '',
      submissionId: submission ? submission.submissionId : '', submittedAt: submission ? submission.submittedAt : '',
      grade: grade || null
    };
  });
  students.sort(function(a,b){ return Number(a.classNo)-Number(b.classNo) || Number(a.number)-Number(b.number); });
  return { students: students };
}

function teacherGetStudentRecord(token, studentId) {
  validateSession_(token, 'teacher');
  const student = findStudentById_(studentId);
  if (!student) throw new Error('학생을 찾을 수 없습니다.');
  const submission = getSubmissionByStudent_(studentId);
  const response = getResponseByStudent_(studentId);
  const grade = getGradeByStudent_(studentId);
  return {
    student: { studentId: student.studentId, classNo: student.classNo, number: student.number, name: student.name },
    stateJson: submission ? submission.stateJson : (response ? response.stateJson : ''),
    grade: grade || null,
    submittedAt: submission ? submission.submittedAt : ''
  };
}

function teacherSaveGrade(token, studentId, grade) {
  validateSession_(token, 'teacher');
  const student = findStudentById_(studentId);
  if (!student) throw new Error('학생을 찾을 수 없습니다.');
  const allowed = [15,20,25];
  const s = Number(grade.situation), l = Number(grade.logic), p = Number(grade.perspectives), j = Number(grade.judgment);
  if ([s,l,p,j].some(function(v){ return allowed.indexOf(v) < 0; })) throw new Error('점수는 15, 20, 25 중에서 선택하세요.');
  const total = s+l+p+j;
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.GRADES);
  const record = [student.studentId, student.classNo, student.number, student.name, s,l,p,j,total,String(grade.comment || ''),new Date().toISOString()];
  upsertRowByKey_(sheet, 1, student.studentId, record);
  return { ok: true, total: total };
}

function findRegistrationById_(requestId) {
  const rows = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.REGISTRATIONS));
  return rows.find(function(r){ return String(r.requestId) === String(requestId); }) || null;
}

function findRegistrationByToken_(requestToken) {
  if (!requestToken) return null;
  const th = tokenHash_(requestToken);
  const rows = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.REGISTRATIONS));
  return rows.find(function(r){ return String(r.requestTokenHash) === String(th); }) || null;
}

function getLatestRegistrationForStudent_(studentId) {
  const rows = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.REGISTRATIONS))
    .filter(function(r){ return String(r.studentId) === String(studentId); });
  if (!rows.length) return null;
  rows.sort(function(a,b){ return new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime(); });
  return rows[0];
}

function expireOpenRegistrationRequests_(studentId) {
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.REGISTRATIONS);
  if (!sheet || sheet.getLastRow() < 2) return;
  const rows = readObjects_(sheet);
  rows.forEach(function(r){
    if (String(r.studentId) === String(studentId) && ['PENDING','APPROVED'].indexOf(String(r.status)) >= 0) {
      markRegistration_(r.requestId, 'EXPIRED', {});
    }
  });
}

function markRegistration_(requestId, status, patch) {
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.REGISTRATIONS);
  const values = sheet.getDataRange().getValues();
  for (let i=1;i<values.length;i++) {
    if (String(values[i][0]) === String(requestId)) {
      values[i][3] = status;
      if (patch && Object.prototype.hasOwnProperty.call(patch,'approvedAt')) values[i][5] = patch.approvedAt;
      if (patch && Object.prototype.hasOwnProperty.call(patch,'completedAt')) values[i][6] = patch.completedAt;
      sheet.getRange(i+1,1,1,values[i].length).setValues([values[i]]);
      return true;
    }
  }
  return false;
}

// ---------- helpers ----------
function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('연결된 스프레드시트를 찾을 수 없습니다.');
  return ss;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  const current = sheet.getRange(1,1,1,headers.length).getValues()[0];
  if (current.join('|') !== headers.join('|')) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function safeParse_(json) {
  try { return JSON.parse(String(json || '{}')); } catch(e) { throw new Error('저장 데이터 형식이 올바르지 않습니다.'); }
}

function hashCredential_(salt, password) {
  const secret = PropertiesService.getScriptProperties().getProperty('PROJECT_SECRET') || '';
  const bytes = Utilities.computeHmacSha256Signature(String(salt) + '|' + String(password), secret, Utilities.Charset.UTF_8);
  return bytesToHex_(bytes);
}

function tokenHash_(token) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8);
  return bytesToHex_(bytes);
}

function bytesToHex_(bytes) {
  return bytes.map(function(b) { const v = (b < 0 ? b + 256 : b); return ('0' + v.toString(16)).slice(-2); }).join('');
}

function makeStudentId_(classNo, number) {
  return 'C' + String(classNo).replace(/\D/g,'') + '-N' + ('00' + String(number).replace(/\D/g,'')).slice(-2);
}

function readObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(function(r){ return r.some(function(v){ return v !== ''; }); }).map(function(r){
    const o={}; headers.forEach(function(h,i){ o[h]=r[i]; }); return o;
  });
}

function findStudentByClassNumber_(classNo, number) { return findStudentById_(makeStudentId_(classNo, number)); }
function findStudentById_(studentId) {
  const rows = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.STUDENTS));
  return rows.find(function(r){ return String(r.studentId) === String(studentId); }) || null;
}
function getResponseByStudent_(studentId) {
  const rows = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.RESPONSES));
  return rows.find(function(r){ return String(r.studentId) === String(studentId); }) || null;
}
function getSubmissionByStudent_(studentId) {
  const rows = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.SUBMISSIONS));
  return rows.find(function(r){ return String(r.studentId) === String(studentId); }) || null;
}
function getGradeByStudent_(studentId) {
  const rows = readObjects_(getSpreadsheet_().getSheetByName(RC.SHEETS.GRADES));
  return rows.find(function(r){ return String(r.studentId) === String(studentId); }) || null;
}

function createSession_(studentId, role, passwordVersion) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const now = new Date();
  const expires = new Date(now.getTime() + RC.SESSION_HOURS * 3600000);
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.SESSIONS);
  sheet.appendRow([tokenHash_(token), studentId, role, expires.toISOString(), now.toISOString(), passwordVersion || 1]);
  return token;
}

function validateSession_(token, expectedRole) {
  if (!token) throw new Error('로그인이 필요합니다.');
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.SESSIONS);
  const rows = readObjects_(sheet);
  const th = tokenHash_(token);
  const now = Date.now();
  const row = rows.find(function(r){ return r.tokenHash === th; });
  if (!row || row.role !== expectedRole || new Date(row.expiresAt).getTime() < now) throw new Error('로그인 시간이 만료되었습니다. 다시 로그인하세요.');
  if (expectedRole === 'student') {
    const student = findStudentById_(row.studentId);
    if (!student || Number(student.passwordVersion || 1) !== Number(row.passwordVersion || 1)) throw new Error('비밀번호가 변경되어 다시 로그인해야 합니다.');
  }
  return row;
}

function deleteStudentSessions_(studentId) {
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.SESSIONS);
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) if (String(values[i][1]) === String(studentId)) sheet.deleteRow(i + 1);
}

function deleteRowsByKey_(sheet, keyCol1Based, key) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const values = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][keyCol1Based - 1]) === String(key)) {
      sheet.deleteRow(i + 1);
      count++;
    }
  }
  return count;
}

function upsertRowByKey_(sheet, keyCol1Based, key, record) {
  const values = sheet.getDataRange().getValues();
  for (let i=1; i<values.length; i++) {
    if (String(values[i][keyCol1Based-1]) === String(key)) {
      sheet.getRange(i+1,1,1,record.length).setValues([record]);
      return i+1;
    }
  }
  sheet.appendRow(record); return sheet.getLastRow();
}

function upsertResponse_(student, status, progress, screenKey, stateJson) {
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.RESPONSES);
  const record = [student.studentId, student.classNo, student.number, student.name, status, progress, screenKey, stateJson, new Date().toISOString()];
  upsertRowByKey_(sheet, 1, student.studentId, record);
}

function ensureGradeRow_(student) {
  const sheet = getSpreadsheet_().getSheetByName(RC.SHEETS.GRADES);
  if (!getGradeByStudent_(student.studentId)) sheet.appendRow([student.studentId,student.classNo,student.number,student.name,'','','','','','','']);
}

function computeProgress_(state) {
  if (!state) return 0;
  if (state.submitted) return 100;
  const decisions = state.decisions || {};
  const locked = ['D1','D2','D3'].filter(function(id){ return decisions[id] && decisions[id].locked; }).length;
  let p = locked * 20;
  if (state.screen && state.screen.mode === 'epilogue') p = Math.max(p, 65);
  if (state.screen && state.screen.mode === 'final') p = 70 + Math.min(4, Number(state.screen.index || 0)) * 6;
  if (state.screen && state.screen.mode === 'submit') p = 96;
  return Math.min(99, p);
}

function validateFinalState_(state) {
  if (!state || !state.decisions) return {ok:false,message:'수행평가 기록이 없습니다.'};
  const ids=['D1','D2','D3'];
  const used=[];
  for (let i=0;i<ids.length;i++) {
    const d=state.decisions[ids[i]];
    if (!d || !d.locked || !d.policyId || !d.responseId || !String(d.reason||'').trim() || !String(d.prediction||'').trim()) return {ok:false,message:'세 번의 결정 기록을 모두 완료하세요.'};
    if (!Array.isArray(d.perspectives) || d.perspectives.length!==2) return {ok:false,message:'각 결정에서 두 집단의 평가를 작성하세요.'};
    d.perspectives.forEach(function(p){ if(!p.id || !String(p.text||'').trim()) throw new Error('집단별 평가를 모두 작성하세요.'); used.push(p.id); });
  }
  if (new Set(used).size !== 6) return {ok:false,message:'여섯 집단을 중복 없이 한 번씩 사용해야 합니다.'};
  if (!Array.isArray(state.finalAnswers) || state.finalAnswers.length!==4 || state.finalAnswers.some(function(v){return !String(v||'').trim();})) return {ok:false,message:'최종 평가 네 문항을 모두 작성하세요.'};
  return {ok:true};
}
