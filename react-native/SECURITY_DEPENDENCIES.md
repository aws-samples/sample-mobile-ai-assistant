# Security dependency maintenance

Use Node.js 20.19.4 or newer. Build and lint CI use Node.js 22 and `npm ci` so the reviewed lockfile and `patch-package` patches are applied together.

## JavaScript dependencies

The September 2026 security update keeps React Native and React Navigation on their existing versions. Compatible fixes for `brace-expansion`, `browserslist`, `baseline-browser-mapping`, `nanoid`, `joi`, `js-yaml`, and `qs` are recorded in `package-lock.json`.

The following overrides need special care:

| Override                     | Reason                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@xmldom/xmldom` 0.9.12      | Fixes XML injection and resource-exhaustion issues; `speech-rule-engine` otherwise pins 0.9.10.                              |
| Metro 0.83.8 family          | Removes the vulnerable `image-size` dependency while staying on the React Native 0.83-compatible Metro branch.               |

Do not blindly replace the Metro override with `latest`. At the time of this update, `image-size` 2.0.2 was still vulnerable and newer Metro branches still depended on it.

### October 2026 update

`package-lock.json` records compatible fixes for `brace-expansion` (1.1.21 / 2.1.7), `compression` 1.8.2, `joi` 17.13.8 and `shell-quote` 1.12.0.

| Override                                           | Reason                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@istanbuljs/load-nyc-config` → `js-yaml` `^4.3.2` | Removes `js-yaml` 3 → `argparse` 1 → `sprintf-js`, which has no patched release for GHSA-hp3w-g68c-fv3c. The package only calls `yaml.load()`, which js-yaml 4 keeps (safe by default). |

### November 2026 update

`package-lock.json` records fixes for `body-parser` 2.4.0, `fast-xml-parser` 5.12.0, `joi` 17.13.9, `launch-editor` 2.14.2, `qs` 6.17.1 and `zod` 4.6.7. React Native stays on 0.83.9.

React Navigation core 7.24.0 no longer depends on `query-string` or `decode-uri-component`, eliminating the vulnerable decoder from the dependency graph. The obsolete decoder override and `query-string` patch are removed together. Navigation regression tests now exercise `getStateFromPath` and `getPathFromState`, including malformed percent-encoded input.

`@typescript-eslint/typescript-estree` uses a scoped override to `minimatch` `^11.0.8` to address [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Its caller uses the supported `minimatch()` API. The override leaves the unaffected minimatch 3 consumers on their existing major version and requires Node.js 20 or at least 22.

The previous `braces` exception is removed because [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was withdrawn on 2026-10-23.

### Unpatched advisories (`audit-allowlist.json`)

CI runs `npm run audit:check` instead of `npm audit --audit-level=low`. It fails on every advisory of any severity, except entries in `audit-allowlist.json`. An entry is allowed only when no patched release exists. Each entry records the package and the reason, and has a `reviewBy` date. After that date the check fails again until the entry is re-assessed. Remove an entry as soon as a fix is published; the check prints a note when an entry is no longer reported.

| Advisory            | Package         | Why it is allowlisted                                                                                                                                                                                                                                                        |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | `deepmerge` 4.3.1 | No patched release as of 2026-11-11. React Native CLI and Jest use it to merge developer-controlled project configuration; it is not an application runtime dependency. Do not merge untrusted configuration. Review again by 2026-12-11. |

## Ruby / CocoaPods: CVE-2026-126080

[GHSA-8474-xrp6-wh69](https://github.com/advisories/GHSA-8474-xrp6-wh69) affected the previously locked `activesupport` 7.2.3.1. When `safe_constantize` handled a `LoadError`, an untrusted constant name could control a regular expression and potentially crash the Ruby process. The bundle now uses the official fixed release **8.0.5.2**, which compares the constant name as a literal string.

As of 2026-11-11, upstream CocoaPods Core still requires ActiveSupport `< 8`, including the [latest published 1.17.0](https://rubygems.org/gems/cocoapods-core/versions/1.17.0). To resolve that dependency conflict, the project keeps CocoaPods 1.14.3 and uses a local copy of its Core gem. All runtime source files are unchanged; only its gemspec requirements permit the patched ActiveSupport 8.0 branch and require Ruby 3.2 or newer. The source checksum, license, verification procedure, and removal criteria are recorded in [vendor/cocoapods-core/PATCHES.md](vendor/cocoapods-core/PATCHES.md).

Use Ruby 3.2 or newer, run `bundle install` from `react-native/`, and run CocoaPods through `bundle exec pod ...`. The iOS CI workflow enforces the locked bundle and runs the Ruby security and compatibility tests before installing pods. A globally installed `pod` command uses a separate gem environment and is not covered by this fix.

`scripts/ruby-security.test.rb` checks literal `LoadError` matching, invalid regexp characters, normal constant resolution, the `String#safe_constantize` entry point, and CocoaPods podspec/lockfile round trips. No application monkey patch or advisory suppression is used. The existing Dependabot alert can close after the updated lockfile reaches the default branch and GitHub rescans it.

## Swift dependencies

The Xcode project updates `aws-sdk-swift` to 1.5.79. The security fixes require at least:

- `swift-nio` 2.100.0
- `swift-nio-extras` 1.34.1
- `swift-nio-http2` 1.44.0

These NIO releases require Swift 6.1 or newer. Use a compatible Xcode toolchain when resolving and building the iOS project. Keep both the application workspace and project workspace `Package.resolved` files synchronized with a validated dependency graph; do not edit version numbers without updating their Git revisions and transitive dependencies.

## Verification

Validated on 2026-11-11 against baseline `2d6429d`:

- `npm ci` applies all eight remaining patches.
- `npm audit` reports no critical, high, or moderate vulnerabilities. The only remaining advisory is the low-severity `deepmerge` issue above (nine affected dependency nodes); `npm run audit:check` passes with its dated exception.
- All 13 security and audit-check tests, ESLint, and formatting checks pass.
- The TypeScript parser's project-service path matching works with the minimatch 11 override.
- Production JavaScript bundles and assets build for Android and iOS.
- Android `assembleDebug` succeeds with Java 17, SDK 36, and NDK 27.1.12297006. A native iOS build still requires macOS/Xcode.
- `tsc --noEmit` reports the same `src/App.tsx:92` navigation type error on both the baseline and updated dependency graphs; the diagnostic output is identical.

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
npm run audit:check
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
