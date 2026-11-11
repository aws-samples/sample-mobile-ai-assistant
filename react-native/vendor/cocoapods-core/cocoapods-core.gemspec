# -*- encoding: utf-8 -*-
require File.expand_path('../lib/cocoapods-core/gem_version', __FILE__)
require 'date'

Gem::Specification.new do |s|
  s.name          =  "cocoapods-core"
  s.version       =  Pod::CORE_VERSION
  s.date          =  Date.today
  s.license       =  "MIT"
  s.email         =  ["eloy.de.enige@gmail.com", "fabiopelosin@gmail.com"]
  s.homepage      =  "https://github.com/CocoaPods/CocoaPods"
  s.authors       =  ["Eloy Duran", "Fabio Pelosin"]
  s.summary       =  "The models of CocoaPods"
  s.description   = "The CocoaPods-Core gem provides support to work with the models of "    \
                    "CocoaPods.\n\n "                                                        \
                    "It is intended to be used in place of the CocoaPods when the the "      \
                    "installation of the dependencies is not needed."                        \

  s.files         =  Dir["lib/**/*.rb"] + %w{ README.md LICENSE }
  s.require_paths =  %w{ lib }

  s.add_runtime_dependency 'activesupport', '>= 8.0.5.2', '< 8.1'
  s.add_runtime_dependency 'nap', '~> 1.0'
  s.add_runtime_dependency 'fuzzy_match', '~> 2.0.4'
  s.add_runtime_dependency 'algoliasearch', '~> 1.0'
  s.add_runtime_dependency 'concurrent-ruby', '~> 1.1'
  s.add_runtime_dependency 'typhoeus', '~> 1.0'
  s.add_runtime_dependency 'netrc', '~> 0.11'
  s.add_runtime_dependency 'addressable', '~> 2.8'
  s.add_runtime_dependency 'public_suffix', '~> 4.0'

  s.add_development_dependency 'bacon', '~> 1.1'

  s.required_ruby_version = '>= 3.2'
end
