# 한글원샷 새 판 올리기·미리 보기(2026-10-30, 10-31 시험/공개 나눔). 저장소 화면 파일을 cloudflare/public/에 모으고 wrangler를 부른다.
#   python -X utf8 cloudflare/deploy.py build                  public/만 채움
#   python -X utf8 cloudflare/deploy.py dev [--port 8788]      내 컴퓨터에서 미리 보기(가짜 D1·KV, 가입 코드 TEST)
#   python -X utf8 cloudflare/deploy.py deploy                 시험 주소(wrangler.toml — 시험 전용 D1 hangeul-oneshot-test·KV)
#   python -X utf8 cloudflare/deploy.py deploy --prod          공개판(wrangler.prod.toml — 실제 D1 hangeul-oneshot·KV). 휴먼쌤 "올려" 뒤에만
#   python -X utf8 cloudflare/deploy.py migrate [--prod]       D1 표 고치기(migrate/2026…sql 차례대로, 이미 된 'add'는 넘어감). 공개판은 서버를 올리기 전에
# 공개판은 임시 폴더에 wrangler.prod.toml을 wrangler.toml로 두고 functions·server·public과 함께 올린다(--project humanssaem-hangeul-oneshot도 같은 뜻).
# wrangler: 환경 변수 WRANGLER_JS(wrangler.js 경로, NODE가 있으면 그 node로) → 위쪽 폴더 어딘가의 tools/cf-wrangler(포터블, 로그인 정보 config/ 포함) → npx wrangler.
# 비밀 CODE_PEPPER는 미리 보기에서는 .dev.vars(저장소에 안 올림), 두 Pages 프로젝트에는 `wrangler pages secret`(모두 같은 값).
import glob, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB = os.path.join(HERE, 'public')
SITE = ['index.html', 'config.js', 'sample-data.js', 'manifest.json', 'sw.js', 'icons', 'vendor']
PROD_PROJECT = 'humanssaem-hangeul-oneshot'


def portable():
    d = HERE
    while os.path.dirname(d) != d:
        d = os.path.dirname(d)
        js = os.path.join(d, 'tools', 'cf-wrangler', 'node_modules', 'wrangler', 'bin', 'wrangler.js')
        if os.path.exists(js):
            node = os.path.join(d, 'tools', 'node', 'node.exe' if os.name == 'nt' else 'node')
            os.environ.setdefault('XDG_CONFIG_HOME', os.path.join(d, 'tools', 'cf-wrangler', 'config'))
            os.environ.setdefault('WRANGLER_SEND_METRICS', 'false')
            return [node if os.path.exists(node) else 'node', js]
    return None


def wrangler(*args, cwd=HERE):
    js = os.environ.get('WRANGLER_JS')
    cmd = [os.environ.get('NODE', 'node'), js] if js else (portable() or ['npx', 'wrangler'])
    print('>', 'wrangler', *args, flush=True)
    return subprocess.call(cmd + list(args), cwd=cwd)


def conf(prod):
    return os.path.join(HERE, 'wrangler.prod.toml' if prod else 'wrangler.toml')


def db_name(prod):
    m = re.search(r'(?m)^database_name\s*=\s*"([^"]+)"', open(conf(prod), encoding='utf-8').read())
    return m.group(1)


def build():
    if os.path.isdir(PUB):
        shutil.rmtree(PUB)
    os.makedirs(PUB)
    for name in SITE:
        src = os.path.join(ROOT, name)
        (shutil.copytree if os.path.isdir(src) else shutil.copy2)(src, os.path.join(PUB, name))
    print('public/ 채움:', ', '.join(SITE))


def deploy_prod(args):
    tmp = tempfile.mkdtemp(prefix='oneshot-deploy-')
    try:
        for d in ('functions', 'server', 'public'):
            shutil.copytree(os.path.join(HERE, d), os.path.join(tmp, d))
        shutil.copy2(conf(True), os.path.join(tmp, 'wrangler.toml'))
        print('공개판(%s)에 올림 — 임시 폴더' % PROD_PROJECT, flush=True)
        return wrangler(*args, cwd=tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def migrate(prod, local=False):
    # 'add'(칸 더하기)는 이미 있으면 실패해도 된다. 나머지는 몇 번 돌려도 그대로인 SQL만 둔다
    db, where = db_name(prod), ('--local' if local else '--remote')
    cwd = HERE if local else tempfile.mkdtemp(prefix='oneshot-migrate-')
    try:
        for f in sorted(glob.glob(os.path.join(HERE, 'migrate', '2*.sql'))):
            rc = wrangler('d1', 'execute', db, where, '--file', f, '-y', cwd=cwd)
            if rc and '-add' not in os.path.basename(f):
                return rc
            if rc:
                print('  (이미 된 칸 더하기 — 넘어감)', flush=True)
        return 0
    finally:
        if cwd != HERE:
            shutil.rmtree(cwd, ignore_errors=True)


def opt(name, default=None):
    a = sys.argv
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else ''
    prod = '--prod' in sys.argv or opt('--project') == PROD_PROJECT
    if what == 'build':
        build()
    elif what == 'dev':
        build()
        if not os.path.exists(os.path.join(HERE, '.dev.vars')):
            sys.exit('.dev.vars가 없어요: CODE_PEPPER=<아무 긴 글자> 한 줄을 넣어 주세요')
        db = db_name(False)
        if wrangler('d1', 'execute', db, '--local', '--file', 'schema.sql') or wrangler('d1', 'execute', db, '--local', '--file', os.path.join('test', 'seed-local.sql')):
            sys.exit(1)
        if migrate(False, local=True):
            sys.exit(1)
        sys.exit(wrangler('pages', 'dev', 'public', '--port', opt('--port', '8788'), '--ip', '127.0.0.1'))
    elif what == 'deploy':
        build()
        args = ['pages', 'deploy', 'public', '--branch', 'main', '--commit-dirty=true']
        if opt('--project') and opt('--project') not in (PROD_PROJECT, 'humanssaem-hangeul-oneshot-v2'):
            sys.exit('모르는 프로젝트: ' + opt('--project'))
        sys.exit(deploy_prod(args) if prod else wrangler(*args))
    elif what == 'migrate':
        sys.exit(migrate(prod, local='--local' in sys.argv))
    else:
        sys.exit(__doc__ or '사용법은 파일 맨 위 주석')


if __name__ == '__main__':
    main()
