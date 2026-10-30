# 한글원샷 새 판 올리기·미리 보기(2026-10-30). 저장소 화면 파일을 cloudflare/public/에 모으고 이 폴더에서 wrangler를 부른다.
#   python -X utf8 cloudflare/deploy.py build                     public/만 채움
#   python -X utf8 cloudflare/deploy.py dev [--port 8788]         내 컴퓨터에서 미리 보기(가짜 D1·KV, 가입 코드 TEST)
#   python -X utf8 cloudflare/deploy.py deploy [--project 이름]   public/ 채우고 Pages에 올림(이름을 안 주면 wrangler.toml의 시험 프로젝트)
# wrangler: 환경 변수 WRANGLER_JS(wrangler.js 경로, NODE가 있으면 그 node로) → 위쪽 폴더 어딘가의 tools/cf-wrangler(포터블, 로그인 정보 config/ 포함) → npx wrangler.
# 비밀 CODE_PEPPER는 미리 보기에서는 .dev.vars(저장소에 안 올림), 공개판에서는 `wrangler pages secret put CODE_PEPPER`.
import os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB = os.path.join(HERE, 'public')
SITE = ['index.html', 'config.js', 'sample-data.js', 'manifest.json', 'sw.js', 'icons']


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


def wrangler(*args):
    js = os.environ.get('WRANGLER_JS')
    cmd = [os.environ.get('NODE', 'node'), js] if js else (portable() or ['npx', 'wrangler'])
    print('>', 'wrangler', *args, flush=True)
    return subprocess.call(cmd + list(args), cwd=HERE)


def build():
    if os.path.isdir(PUB):
        shutil.rmtree(PUB)
    os.makedirs(PUB)
    for name in SITE:
        src = os.path.join(ROOT, name)
        (shutil.copytree if os.path.isdir(src) else shutil.copy2)(src, os.path.join(PUB, name))
    print('public/ 채움:', ', '.join(SITE))


def opt(name, default=None):
    a = sys.argv
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else ''
    if what == 'build':
        build()
    elif what == 'dev':
        build()
        if not os.path.exists(os.path.join(HERE, '.dev.vars')):
            sys.exit('.dev.vars가 없어요: CODE_PEPPER=<아무 긴 글자> 한 줄을 넣어 주세요')
        for f in ('schema.sql', os.path.join('test', 'seed-local.sql')):
            if wrangler('d1', 'execute', 'hangeul-oneshot', '--local', '--file', f):
                sys.exit(1)
        sys.exit(wrangler('pages', 'dev', 'public', '--port', opt('--port', '8788'), '--ip', '127.0.0.1'))
    elif what == 'deploy':
        build()
        args = ['pages', 'deploy', 'public', '--branch', 'main', '--commit-dirty=true']
        if opt('--project'):
            args += ['--project-name', opt('--project')]
        sys.exit(wrangler(*args))
    else:
        sys.exit(__doc__ or '사용법은 파일 맨 위 주석')


if __name__ == '__main__':
    main()
