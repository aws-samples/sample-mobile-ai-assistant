# CocoaPods Core compatibility copy

This directory contains the published CocoaPods Core 1.14.3 source. It allows
the application's existing CocoaPods 1.14.3 tooling to use the officially fixed
ActiveSupport 8.0 release for CVE-2026-126080.

Upstream provenance:

- Gem: <https://rubygems.org/downloads/cocoapods-core-1.14.3.gem>
- Gem SHA-256: `967f405a6c8b7feb7a050e5f4ea9dece67bdaf78a89a2b27a1a72e3e39fb1e13`
- Source: <https://github.com/CocoaPods/Core/tree/5f089021ded1ded919695d9f4392e83d9e9421a4>
- License: [MIT](LICENSE), retained from the published gem.

Every `lib/` file, `README.md`, and `LICENSE` is byte-for-byte identical to the
published gem. The gemspec comes from the pinned upstream source, with only
these requirements changed:

- ActiveSupport: `>= 5.0, < 8` → `>= 8.0.5.2, < 8.1`.
- Ruby: `>= 2.6` → `>= 3.2`, matching ActiveSupport 8.0.

No CocoaPods or ActiveSupport methods are monkey-patched. This is a locally
maintained compatibility change, not an upstream claim of ActiveSupport 8
support. The allowed ActiveSupport branch is deliberately narrow; do not widen
it without rerunning the security tests and an actual `bundle exec pod install`
on macOS.

To check the source against the published gem, download it, verify the SHA-256
above, unpack it with `gem unpack`, and compare the unpacked `lib/`, `README.md`,
and `LICENSE` with this directory.

Use `bundle exec` for CocoaPods commands so they load this dependency graph.
The iOS workflow installs the locked Ruby bundle and runs
`bundle exec ruby scripts/ruby-security.test.rb` before installing pods.

Remove this directory and its Gemfile entry when a published, compatible
CocoaPods/Core release supports an officially fixed ActiveSupport version.
Until then, maintainers must review updates to CocoaPods Core as well as
ActiveSupport; Bundler cannot update a path dependency from RubyGems.
