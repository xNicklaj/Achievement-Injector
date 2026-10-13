add_rules("mode.debug", "mode.release")

-- include subprojects
includes("lib/commonlibsse-ng")

set_project("AchievementInjector")
set_version("0.0.1")
set_license("MIT")
set_languages("c++23")
add_defines("SPDLOG_COMPILED_LIB")

-- define clib-util package
package("clib-util")
    set_homepage("https://github.com/powerof3/CLibUtil")
    set_description("CLibUtil")
    add_urls("https://github.com/powerof3/CLibUtil.git")
    on_install(function (package)
        os.cp("include", package:installdir())
    end)
package_end()

-- dependencies
add_requires("clib-util")
add_requires("spdlog v1.16.0", { configs = { header_only = false, wchar = true, std_format = true } })
add_requires("simpleini")
add_requires("nlohmann_json")
add_requires("eventpp")
add_requires("boost", {configs = {algorithm = true}})
add_requires("fmt")

target("AchievementInjector")
    add_rules("commonlibsse-ng.plugin", {
        name = "AchievementInjector",
        author = "xNicklaj",
        description = "AchievementInjector CommonLibSSE-NG"
    })
    
    add_packages("clib-util", "spdlog", "simpleini", "nlohmann_json", "eventpp", "boost", "fmt")
    
    add_includedirs("include", "src")
    add_files("src/**.cpp")
    add_headerfiles("src/**.h")
    
    -- Generate PDB symbols
    set_symbols("debug")
    
    -- PCH
    set_pcxxheader("src/PCH.h")

-- Self-check for the progress file logic, built without the game: xmake build SaveStoreTest && xmake run SaveStoreTest
target("SaveStoreTest")
    set_kind("binary")
    set_default(false)
    add_packages("nlohmann_json")
    add_includedirs("src")
    add_files("src/SaveStore.cpp", "tests/SaveStoreTest.cpp")
    add_tests("default")
