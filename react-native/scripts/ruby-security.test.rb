require 'minitest/autorun'
require 'minitest/mock'
require 'cocoapods'
require 'tmpdir'

class ActiveSupportSecurityTest < Minitest::Test
  def with_load_error(message)
    error = LoadError.new(message)
    ActiveSupport::Inflector.stub(:constantize, ->(_) { raise error }) { yield error }
  end

  def test_constant_lookup_still_works
    assert_equal String, '::String'.safe_constantize
    assert_nil 'MissingSecurityFixture::Nested'.safe_constantize
  end

  def test_load_error_name_is_literal
    %w[Example.Channel Example.Channel::Nested].each do |name|
      with_load_error('Unable to autoload constant ExampleXChannel') do |error|
        assert_same error, assert_raises(LoadError) { name.safe_constantize }
      end
    end
  end

  def test_literal_matching_error_returns_nil
    with_load_error('Unable to autoload constant Example.Channel') do
      assert_nil 'Example.Channel::Nested'.safe_constantize
      assert_nil '::Example.Channel::Nested'.safe_constantize
    end
  end

  def test_invalid_regexp_characters_are_not_compiled
    with_load_error('Unable to autoload constant Example[Channel') do
      assert_nil 'Example[Channel::Nested'.safe_constantize
    end
  end

  def test_unrelated_load_errors_are_not_swallowed
    with_load_error('cannot load such file -- missing_dependency') do |error|
      assert_same error, assert_raises(LoadError) { 'Example'.safe_constantize }
    end
  end

  def test_original_load_error_message_is_respected
    error = LoadError.new('wrapped error')
    def error.original_message
      'Unable to autoload constant Example.Channel'
    end
    ActiveSupport::Inflector.stub(:constantize, ->(_) { raise error }) do
      assert_nil 'Example.Channel::Nested'.safe_constantize
    end
  end

  def test_cocoapods_parses_podspec_and_round_trips_lockfile
    spec = Pod::Specification.new do |s|
      s.name = 'SecurityFixture'
      s.version = '1.0.0'
      s.summary = 'A local compatibility fixture.'
      s.homepage = 'https://example.com'
      s.license = 'MIT'
      s.author = 'Fixture'
      s.source = { git: 'https://example.com/fixture.git', tag: '1.0.0' }
      s.source_files = 'Sources/*.swift'
      s.ios.deployment_target = '15.1'
      s.description = "  A description\n  using ActiveSupport heredoc handling."
    end
    parsed = Pod::Specification.from_json(spec.to_json)
    assert_equal 'A description', parsed.description.lines.first.strip

    podfile = Pod::Podfile.new do
      platform :ios, '15.1'
      target 'Fixture' do
        pod 'SecurityFixture', '1.0.0'
      end
    end
    lockfile = Pod::Lockfile.generate(podfile, [parsed], {})
    Dir.mktmpdir('cocoapods-security') do |dir|
      path = Pathname.new(dir).join('Podfile.lock')
      lockfile.write_to_disk(path)
      restored = Pod::Lockfile.from_file(path)
      assert_equal ['SecurityFixture'], restored.pod_names
      assert_equal '1.0.0', restored.version('SecurityFixture').to_s
    end
  end

  def test_xcodeproj_reads_the_application_project
    path = File.expand_path('../ios/SwiftChat.xcodeproj', __dir__)
    project = Xcodeproj::Project.open(path)
    assert_includes project.targets.map(&:name), 'SwiftChat'
  end
end
