/**
 * 한글원샷 — 구글 앱스 스크립트(시트에 붙는 작은 서버)
 *
 * 설치(휴먼쌤이 한 번):
 *  1. 구글시트를 만들고 확장 프로그램 → Apps Script → 이 파일 내용을 붙여 넣고 저장.
 *  2. 함수 setup 을 한 번 실행(탭 '자료'·'주제'·'교사'·'설정'이 없으면 머리글과 함께 만든다. 권한 허용 창이 뜬다).
 *  3. 배포 → 새 배포 → 유형 '웹 앱' → 실행 사용자 '나' → 액세스 권한 '모든 사용자' → 배포 → 나온 주소(…/exec)를
 *     페이지의 config.js API_URL에 넣는다. 코드를 고치면 '배포 관리'에서 새 버전으로 다시 배포해야 반영된다.
 *  4. '교사' 탭에 교사 이름·코드를 적는다(코드는 숫자 4~8자리 등 아무 글자. 비활성은 활성 칸에 N).
 *     학교 칸은 올리기 화면에서 처음 골라져 있을 학교일 뿐이라 비워도 된다(교사가 올릴 때 config.js SCHOOLS 17곳 중에서 고른다).
 *
 * 하는 일: GET ?action=data → 자료·주제·설정 JSON(공개 N 제외). POST {action:'login'|'upload'|'hide', code, ...} → 교사 코드 확인 뒤 처리.
 * 시트는 아무와도 공유하지 않는다(스크립트가 '나'로 실행되어 읽고 쓴다). 교사·학습자는 페이지만 본다.
 */

var SHEETS = {
  자료: ['id', '묶음', '주제', '레벨', '제목', '유형', '링크', '설명', '시간', '학교', '올린이', '올린날짜', '공개'],
  주제: ['주제', '프랑스어', '묶음', '순서', '아이콘'],
  교사: ['이름', '학교', '코드', '활성'],
  설정: ['키', '값']
};
// '주제' 탭의 아이콘 칸: 이모지 하나(예: 👨‍👩‍👧) 또는 글자. 비우면 페이지가 주제 이름으로 고른다.
var KEYS = { 자료: ['id', 'group', 'topic', 'level', 'title', 'type', 'url', 'desc', 'minutes', 'school', 'by', 'date', 'pub'], 주제: ['topic', 'fr', 'group', 'order', 'icon'] };

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); }
    if (sh.getLastRow() === 0) { sh.appendRow(SHEETS[name]); sh.setFrozenRows(1); }
  });
  // 교사 코드 칸은 글자로 둔다(숫자로 두면 0123이 123으로 바뀌어 로그인이 안 된다).
  ss.getSheetByName('교사').getRange('C:C').setNumberFormat('@');
  var st = ss.getSheetByName('설정');
  if (st.getLastRow() < 2) { st.appendRow(['title', '한글원샷']); st.appendRow(['subtitle', '프랑스 한글학교 레벨별 자료']); st.appendRow(['notice', '']); }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rows(name, keys) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, keys.length).getValues();
  return v.map(function (r) { var o = {}; keys.forEach(function (k, i) { o[k] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'Europe/Paris', 'yyyy-MM-dd') : r[i]; }); return o; })
          .filter(function (o) { return Object.keys(o).some(function (k) { return String(o[k]).trim() !== ''; }); });
}

function settings() {
  var o = {}; rows('설정', ['key', 'value']).forEach(function (r) { if (r.key) o[String(r.key).trim()] = String(r.value); }); return o;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'data';
  if (action !== 'data') return json({ ok: false, error: 'unknown' });
  var mats = rows('자료', KEYS.자료).filter(function (m) { return String(m.pub).trim().toUpperCase() !== 'N'; });
  return json({ ok: true, settings: settings(), topics: rows('주제', KEYS.주제), materials: mats, updatedAt: new Date().toISOString() });
}

function findTeacher(code) {
  code = String(code || '').trim(); if (!code) return null;
  var t = rows('교사', ['name', 'school', 'code', 'active']).filter(function (r) { return String(r.code).trim() === code && String(r.active).trim().toUpperCase() !== 'N'; })[0];
  return t ? { name: String(t.name).trim(), school: String(t.school).trim() } : null;
}

function doPost(e) {
  var b; try { b = JSON.parse(e.postData.contents); } catch (ex) { return json({ ok: false, error: 'bad_json' }); }
  var tc = findTeacher(b.code);
  if (!tc) return json({ ok: false, error: 'bad_code' });
  if (b.action === 'login') return json({ ok: true, teacher: tc });

  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('자료');
    if (b.action === 'upload') {
      var m = b.material || {};
      if (!m.title || !m.topic || !m.level || !/^https?:\/\//i.test(String(m.url || ''))) return json({ ok: false, error: 'missing' });
      var id = 'm' + Date.now().toString(36);
      sh.appendRow([id, m.group || '', m.topic, m.level, String(m.title).slice(0, 60), m.type || '', m.url, String(m.desc || '').slice(0, 80),
        Number(m.minutes) || '', String(m.school || tc.school || '').slice(0, 60), tc.name, Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'), '']);
      return json({ ok: true, id: id });
    }
    if (b.action === 'hide') {
      var v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 13).getValues();
      for (var i = 0; i < v.length; i++) {
        if (String(v[i][0]) === String(b.id)) {
          if (String(v[i][10]).trim() !== tc.name) return json({ ok: false, error: 'not_owner' });  // 자기가 올린 것만 숨긴다
          sh.getRange(i + 2, 13).setValue('N'); return json({ ok: true });
        }
      }
      return json({ ok: false, error: 'not_found' });
    }
    return json({ ok: false, error: 'unknown' });
  } finally { lock.releaseLock(); }
}
