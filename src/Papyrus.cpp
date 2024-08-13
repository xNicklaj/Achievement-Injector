#include "Papyrus.h"
#include "settings.h"
#include "log.h"



namespace NativePapyrus {
	std::string OnPowerLearned(RE::StaticFunctionTag*) {
		return "Hello from C++!";
	}

	void OnConfigClose(RE::TESQuest*)
	{
		//Settings::GetSingleton()->LoadSettings();
		//SetupLog(false);
	}

	void OnSettingChange(RE::TESQuest*, std::string a_id)
	{
		Settings::GetSingleton()->LoadSettings();
		SetupLog(false);
		if (a_id == "iNotificationSound:Sound") {
			RE::PlaySound(Settings::GetSingleton()->GetNotificationSound().c_str());
		}
	}

	bool Register(RE::BSScript::IVirtualMachine* a_vm)
	{
		if (!a_vm) {

			return false;
		}

		a_vm->RegisterFunction("OnConfigClose", MCM, OnConfigClose);
		a_vm->RegisterFunction("OnSettingChange", MCM, OnSettingChange);
		return true;
	}

	class QueryStatShort_Callback : public RE::BSScript::IStackCallbackFunctor
	{
	public:
		QueryStatShort_Callback() {}
		void operator()(RE::BSScript::Variable a_result)
		{
			this->result = a_result.Unpack<short>();
			logger::info("Suca {}", result);
		}
		bool CanSave() {
			return false;
		}
		void SetObject(const RE::BSTSmartPointer<RE::BSScript::Object>&) {

		}
		float GetResult() {
			return this->result;
		}
	private:
		float result = 0.0;
	};


	class QueryStatFloat_Callback : public RE::BSScript::IStackCallbackFunctor
	{
	public:
		QueryStatFloat_Callback() {}
		void operator()(RE::BSScript::Variable a_result)
		{
			this->result = a_result.Unpack<float>();
		}
		bool CanSave() {
			return false;
		}
		void SetObject(const RE::BSTSmartPointer<RE::BSScript::Object>&) {

		}
		float GetResult() {
			return this->result;
		}
	private:
		float result = 0.0;
	};

	class QueryStat_Callback : public RE::BSScript::IStackCallbackFunctor
	{
	public:
		QueryStat_Callback() {}
		void operator()(RE::BSScript::Variable a_result)
		{
			this->result = a_result;
		}
		bool CanSave() {
			return false;
		}
		void SetObject(const RE::BSTSmartPointer<RE::BSScript::Object>&) {

		}
		template <typename T>
		T GetResult() {
			return this->result.Unpack<T>();
		}
	private:
		RE::BSScript::Variable result;
	};

	float QueryStat(std::string stat) {
		RE::BSScript::IVirtualMachine* vm = RE::BSScript::Internal::VirtualMachine::GetSingleton();
		QueryStatShort_Callback* cb = new QueryStatShort_Callback();
		RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor> callback(cb);
		auto args = RE::MakeFunctionArguments(std::move(stat));
		vm->DispatchStaticCall("Game", "QueryStat", args, callback);
		cb->GetResult();
		return 0;
	}
}