// https://github.com/Scrabx3/ScrabsPapyrusExtender/blob/main/src/Interface/Interface.h
#pragma once

namespace Internal::Interface {
    struct SKSEScaleform_OpenMenu;
    struct SKSEScaleform_CloseMenu;
    struct SKSEScaleform_SendModEvent;

    template <typename T>
    class FlashLogger : public RE::GFxLog {
        public:
            void LogMessageVarg(LogMessageType, const char* str, std::va_list a_argList) override {
                std::string msg(str ? str : "");
                while (!msg.empty() && msg.back() == '\n')
                    msg.pop_back();

                auto length = std::vsnprintf(0, 0, msg.c_str(), a_argList) + 1;
                char* buffer = (char*) malloc(sizeof(*buffer) * length);
                if (!buffer)
                    return;
                std::vsnprintf(buffer, length, msg.c_str(), a_argList);

                logger::info("{} -> {}", T::NAME, buffer);
                free(buffer);
            }
    };

    struct FunctionManager {
            template <class F>
            static inline void AttachFunction(RE::GPtr<RE::GFxMovieView> a_view, RE::GFxValue& a_scope, const char* a_methodname) {
                RE::GFxFunctionHandler* fn;
                const auto where = gfx_functions.find(&typeid(F));
                if (where != gfx_functions.end()) {
                    fn = where->second;
                } else {
                    fn = new F;
                    gfx_functions[&typeid(F)] = fn;
                }
                RE::GFxValue fnValue;
                a_view->CreateFunction(&fnValue, fn);
                bool success = a_scope.SetMember(a_methodname, fnValue);
                if (!success) {
                    logger::error("Unable to bind function {}", a_methodname);
                }
            }

            static inline void AttachSKSEFunctions(RE::GPtr<RE::GFxMovieView> a_view) {
                RE::GFxValue global;
                bool success = a_view->GetVariable(&global, "_global");
                if (!success) {
                    logger::error("Unable to get _global from view");
                    return;
                }
                RE::GFxValue skse;
                a_view->CreateObject(&skse);
                success = global.SetMember("skse", skse);
                if (!success) {
                    logger::error("Failed to attach skse to global instance");
                    return;
                }

                AttachFunction<SKSEScaleform_OpenMenu>(a_view, skse, "OpenMenu");
                AttachFunction<SKSEScaleform_CloseMenu>(a_view, skse, "CloseMenu");
                AttachFunction<SKSEScaleform_SendModEvent>(a_view, skse, "SendModEvent");
            }

        private:
            static inline std::map<const std::type_info*, RE::GFxFunctionHandler*> gfx_functions{};
    };

    struct SKSEScaleform_OpenMenu : public RE::GFxFunctionHandler {
            void Call(Params& a_args) override {
                assert(a_args.argCount > 0);

                const auto name = a_args.args->GetString();
                RE::UIMessageQueue::GetSingleton()->AddMessage(name, RE::UI_MESSAGE_TYPE::kShow, nullptr);
            }
    };

    struct SKSEScaleform_CloseMenu : public RE::GFxFunctionHandler {
            void Call(Params& a_args) override {
                assert(a_args.argCount > 0);

                const auto name = a_args.args->GetString();
                RE::UIMessageQueue::GetSingleton()->AddMessage(name, RE::UI_MESSAGE_TYPE::kHide, nullptr);
            }
    };

    struct SKSEScaleform_SendModEvent : public RE::GFxFunctionHandler {
            void Call(Params& a_args) override {
                assert(a_args.argCount > 0);

                const auto evt = a_args.args->GetString();

                const auto argStr = a_args.argCount > 1 && a_args.args[1].IsString() ? a_args.args[1].GetString() : "";
                const auto argNum =
                    a_args.argCount > 2 && a_args.args[2].IsNumber() ? static_cast<float>(a_args.args[2].GetNumber()) : 0.0f;
                const auto argForm =
                    a_args.argCount > 3 && a_args.args[3].IsNumber() ? static_cast<uint32_t>(a_args.args[3].GetNumber()) : 0;

                SKSE::ModCallbackEvent modEvent{evt, argStr, argNum, argForm ? RE::TESForm::LookupByID(argForm) : nullptr};
                SKSE::GetModCallbackEventSource()->SendEvent(&modEvent);
            }
    };
}  // namespace Internal::Interface