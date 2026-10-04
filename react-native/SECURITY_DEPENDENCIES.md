# Security dependency maintenance

Use Node.js 20.19.4 or newer. Build and lint CI use Node.js 22 and `npm ci` so the reviewed lockfile and `patch-package` patches are applied together.

## JavaScript dependencies

The September 2026 security update keeps React Native and React Navigation on their existing versions. Compatible fixes for `brace-expansion`, `browserslist`, `baseline-browser-mapping`, `nanoid`, `joi`, `js-yaml`, and `qs` are recorded in `package-lock.json`.

The following overrides need special care:

| Override                     | Reason                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@xmldom/xmldom` 0.9.12      | Fixes XML injection and resource-exhaustion issues; `speech-rule-engine` otherwise pins 0.9.10.                              |
| `decode-uri-component` 0.5.0 | Fixes excessive CPU usage on malformed percent-encoded input; `query-string` 7 otherwise requires the vulnerable 0.2 series. |
| Metro 0.83.8 family          | Removes the vulnerable `image-size` dependency while staying on the React Native 0.83-compatible Metro branch.               |

`decode-uri-component` 0.5.0 is an ES module. `patches/query-string+7.1.3.patch` adapts the CommonJS consumer to its default export. Do not remove this patch independently of the decoder override: installation and vulnerability scanning can pass while navigation query parsing fails at runtime.

Do not blindly replace the Metro override with `latest`. At the time of this update, `image-size` 2.0.2 was still vulnerable and newer Metro branches still depended on it.

## Swift dependencies

The Xcode project updates `aws-sdk-swift` to 1.5.79. The security fixes require at least:

- `swift-nio` 2.100.0
- `swift-nio-extras` 1.34.1
- `swift-nio-http2` 1.44.0

These NIO releases require Swift 6.1 or newer. Use a compatible Xcode toolchain when resolving and building the iOS project. Keep both the application workspace and project workspace `Package.resolved` files synchronized with a validated dependency graph; do not edit version numbers without updating their Git revisions and transitive dependencies.

## Verification

Validated on 2026-09-10 against baseline `a356f7a`:

- `npm ci` applies all nine patches, including the query-string compatibility patch.
- `npm audit` reports zero vulnerabilities. Trivy reports zero vulnerabilities in the five repository npm, Ruby, CocoaPods, and Swift lockfiles, including development dependencies.
- All seven security regression tests pass. The same suite against the original dependencies fails the malformed-input and XML-validation tests.
- ESLint, the repository format check, and formatting checks for the new test file pass.
- Production JavaScript bundles and assets build for Android and iOS.
- Android `assembleDebug` succeeds with Java 17, SDK 36, and NDK 27.1.12297006.
- SwiftPM resolves the AWS SDK dependency graph with 26 pins; both lockfiles match the checked-out Git revisions. A Linux Swift 6.2 smoke executable builds and exercises the Bedrock client configuration and streaming payload APIs without AWS API calls. `NIOHTTP1`, `NIOHTTP2`, and `NIOHTTPCompression` also compile.
- A complete iOS application build still requires macOS/Xcode; Linux Swift validation does not replace it. The pre-existing TypeScript error described below remains unchanged.

From `react-native/`:

```sh
npm ci
npm audit --audit-level=low
npm run test:security
npm run lint
npx prettier --check package.json scripts/security-dependencies.test.cjs
npx tsc --noEmit
```

The security regression tests exercise Unicode and malformed navigation query strings, bounded decoding time, XML serialization validation, and MathJax SVG rendering. They run with Node's built-in test runner and require no additional test dependencies.

Also generate production Metro bundles for both platforms and run Android/iOS native builds. A clean vulnerability scan does not establish runtime compatibility, and a JavaScript bundle is not a native build.

On macOS, resolve and build the actual workspace as well:

```sh
cd ios
bundle exec pod install
xcodebuild -resolvePackageDependencies -workspace AIAssistant.xcworkspace -scheme SwiftChat
xcodebuild -workspace AIAssistant.xcworkspace -scheme SwiftChat \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

At the update baseline (`a356f7a`), TypeScript reports an existing navigation type mismatch at `src/App.tsx:92`. Compare against that baseline before attributing it to dependency changes; do not suppress the error as part of a security dependency update.

Repository lockfile scans exclude installed `node_modules` and build outputs. An additional scan of installed vendor files finds CVE-2024-21907 in the Newtonsoft.Json dependency of `react-native-fs/windows/RNFS.Net46/packages.config`. This repository has no Windows app target; that vendor Windows configuration is not fixed or covered by the Android/iOS validation. Reassess it before adding Windows support.
