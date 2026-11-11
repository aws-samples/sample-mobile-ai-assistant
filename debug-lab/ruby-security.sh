#!/usr/bin/env bash
set -euo pipefail

output_dir=$1
mkdir -p "$output_dir"
sw_vers | tee "$output_dir/macos.txt"
xcodebuild -version | tee "$output_dir/xcode.txt"
cd react-native
ruby --version | tee "$output_dir/ruby.txt"
bundle exec ruby -e 'require "cocoapods"; puts "CocoaPods: #{Pod::VERSION}"; puts "ActiveSupport: #{ActiveSupport.version}"; puts "Core: #{Gem.loaded_specs["cocoapods-core"].full_gem_path}"' | tee "$output_dir/gems.txt"
bundle exec ruby scripts/ruby-security.test.rb | tee "$output_dir/security-tests.txt"
cd ios
bundle exec pod install 2>&1 | tee "$output_dir/pod-install.txt"
xcodebuild -list -workspace AIAssistant.xcworkspace 2>&1 | tee "$output_dir/workspace.txt"
git diff -- Podfile.lock > "$output_dir/podfile-lock.diff"
