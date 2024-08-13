
namespace NativePapyrus {
	inline constexpr auto MCM = "AchievementInjectorMcmScript"sv;
	void OnConfigClose(RE::TESQuest*);
	bool Register(RE::BSScript::IVirtualMachine* a_vm);

	std::string OnPowerLearned(RE::StaticFunctionTag*);
	float QueryStat(std::string);
}

	