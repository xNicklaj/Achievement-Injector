
namespace NativePapyrus {
	using VM = RE::BSScript::Internal::VirtualMachine;
    using StackID = RE::VMStackID;

	inline constexpr auto MCM = "AchievementInjectorMcmScript"sv;
    inline constexpr auto script = "AchievementInjectorScripts"sv;
	void OnConfigClose(RE::TESQuest*);

	bool Register(VM* a_vm);
}

	