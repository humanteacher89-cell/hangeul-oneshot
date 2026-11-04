# 한글원샷 안드로이드 앱 (Trusted Web Activity)

공개 주소 웹앱을 Bubblewrap으로 감싼 앱입니다. 화면과 서버는 웹앱 그대로이므로, 화면을 고칠 때는 앱을 다시 빌드하지 않아도 됩니다. 앱 이름, 아이콘, 주소, 대상 API를 바꿀 때만 다시 빌드합니다.

| 파일 | 내용 |
|---|---|
| `twa-manifest.json` | 앱 설정 사본. 패키지 이름은 한번 올리면 바꿀 수 없음 |
| `play-console-입력.md` | Play Console에 옮겨 적는 값 |
| `store/` | 스토어 아이콘, 그래픽 이미지, 스크린샷 |
| `../.well-known/assetlinks.json` | 앱과 웹 주소 연결. 서명 지문이 바뀌면 함께 고침 |

## 저장소에 넣지 않는 것

- 서명 키와 비밀번호: 회사 폴더 `tools/secrets/hangeul-oneshot-upload.*`
- 빌드 폴더와 AAB: 회사 폴더 `tools/android/twa/hangeul-oneshot/`

**서명 키를 잃으면 업데이트가 막힙니다.** PC 밖에 따로 백업합니다. 잃었을 때는 Play App Signing의 upload 키 재설정을 요청합니다.

## 다시 빌드하기

PowerShell에서 회사 폴더 기준으로 실행합니다. Bubblewrap은 JDK 17을 요구하고, 프로젝트 경로에 한글이 없어야 합니다.

1. `twa-env.ps1`을 불러옵니다: `. tools\android\twa-env.ps1`
2. `tools\secrets\hangeul-oneshot-upload.env`의 두 값을 환경 변수로 넣습니다.
3. `tools\android\twa\hangeul-oneshot\twa-manifest.json`에서 `appVersionCode`를 1 올리고 `appVersionName`을 고칩니다.
4. 빌드 폴더를 PATH에 넣고 그 폴더에서 실행합니다: `bubblewrap update --skipVersionUpgrade`, `bubblewrap build --skipPwaValidation`
5. 나온 `app-release-bundle.aab`를 Play Console에 올리고, 설정이 바뀌었으면 이 폴더의 `twa-manifest.json` 사본도 맞춥니다.

대상 API는 Bubblewrap 1.27.0 기준 36입니다. Play 요건이 올라가면 Bubblewrap도 함께 올립니다.
