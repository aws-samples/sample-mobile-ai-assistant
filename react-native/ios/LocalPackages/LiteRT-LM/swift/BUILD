# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# [Google-internal load of `objc_library`]
load("@build_bazel_rules_apple//apple:apple.bzl", "apple_xcframework")
load("@build_bazel_rules_apple//apple:ios.bzl", "ios_unit_test")
load("@build_bazel_rules_swift//swift:swift.bzl", "swift_library")


package(default_visibility = ["//visibility:public"])

# Swift API for LiteRT LM.
swift_library(
    name = "LiteRT_LM_Swift",
    srcs = [
        "Benchmark.swift",
        "Capabilities.swift",
        "Config.swift",
        "Conversation.swift",
        "Engine.swift",
        "ExperimentalFlags.swift",
        "LiteRTLMError.swift",
        "Message.swift",
        "Tool.swift",
        "ToolManager.swift",
    ],
    copts = ["-enable-testing"],
    module_name = "LiteRTLM",
    deps = [


        "//c:engine",
        "//schema/capabilities:capabilities_c",
    ],
)

# Swift library containing test sources for Engine.
swift_library(
    name = "LiteRT_LM_EngineTestsLib",
    testonly = True,
    srcs = ["EngineTests.swift"],
    copts = ["-enable-testing"],
    data = ["//runtime/testdata"],
    deps = [
        ":LiteRT_LM_Swift",

    ],
)

# Swift library containing test sources for Conversation.
swift_library(
    name = "LiteRT_LM_ConversationTestsLib",
    testonly = True,
    srcs = ["ConversationTests.swift"],
    copts = ["-enable-testing"],
    data = ["//runtime/testdata"],
    deps = [
        ":LiteRT_LM_Swift",

    ],
)

# Swift library containing test sources for Tool.
swift_library(
    name = "LiteRT_LM_ToolTestsLib",
    testonly = True,
    srcs = ["ToolTests.swift"],
    copts = ["-enable-testing"],
    data = ["//runtime/testdata"],
    deps = [
        ":LiteRT_LM_Swift",

    ],
)

# Swift library containing test sources for Message.
swift_library(
    name = "LiteRT_LM_MessageTestsLib",
    testonly = True,
    srcs = ["MessageTests.swift"],
    copts = ["-enable-testing"],
    deps = [
        ":LiteRT_LM_Swift",

    ],
)

objc_library(
    name = "CLiteRTLM_objc",
    deps = [
        "//c:engine",
        "//schema/capabilities:capabilities_c",
    ],
)

apple_xcframework(
    name = "CLiteRTLM",
    bundle_id = "com.google.odml.litertlm.CLiteRTLM",
    features = ["exported_symbols"],
    infoplists = ["Info.plist"],
    ios = {
        "simulator": [
            "arm64",
            "x86_64",
        ],
        "device": [
            "arm64",
        ],
    },
    minimum_os_versions = {
        "ios": "15.0",
    },
    public_hdrs = [
        "//c:engine.h",
        "//schema/capabilities:capabilities_c.h",
    ],
    deps = [
        ":CLiteRTLM_objc",
    ],
)

ios_unit_test(
    name = "LiteRT_LM_Engine_Tests",
    data = [
        "//runtime/testdata",
    ],
    minimum_os_version = "15.0",
    # The ios_unit_test depends on the swift_library containing the test code.
    deps = [
        ":LiteRT_LM_EngineTestsLib",
    ],
)

ios_unit_test(
    name = "LiteRT_LM_Conversation_Tests",
    data = [
        "//runtime/testdata",
    ],
    minimum_os_version = "15.0",
    # The ios_unit_test depends on the swift_library containing the test code.
    deps = [
        ":LiteRT_LM_ConversationTestsLib",
    ],
)

ios_unit_test(
    name = "LiteRT_LM_Tool_Tests",
    data = [
        "//runtime/testdata",
    ],
    minimum_os_version = "15.0",
    # The ios_unit_test depends on the swift_library containing the test code.
    deps = [
        ":LiteRT_LM_ToolTestsLib",
    ],
)

ios_unit_test(
    name = "LiteRT_LM_Message_Tests",
    minimum_os_version = "15.0",
    # The ios_unit_test depends on the swift_library containing the test code.
    deps = [
        ":LiteRT_LM_MessageTestsLib",
    ],
)

# Swift library containing test sources for Capabilities.
swift_library(
    name = "LiteRT_LM_CapabilitiesTestsLib",
    testonly = True,
    srcs = ["CapabilitiesTests.swift"],
    copts = ["-enable-testing"],
    data = ["//runtime/testdata"],
    deps = [
        ":LiteRT_LM_Swift",

    ],
)

ios_unit_test(
    name = "LiteRT_LM_Capabilities_Tests",
    data = [
        "//runtime/testdata",
    ],
    minimum_os_version = "15.0",
    # The ios_unit_test depends on the swift_library containing the test code.
    deps = [
        ":LiteRT_LM_CapabilitiesTestsLib",
    ],
)
