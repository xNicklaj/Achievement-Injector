#include "../Condition.h"


namespace RE {
	struct BGSNewVoicePowerEvent
	{
		RE::ObjectRefHandle actorHandle; // 0
		RE::TESForm* shout; // 8
	};
	static_assert(offsetof(BGSNewVoicePowerEvent, actorHandle) == 0x0);
	static_assert(offsetof(BGSNewVoicePowerEvent, shout) == 0x8);
	static_assert(sizeof(BGSNewVoicePowerEvent) == 0x10);
}

class PowerLearnedCondition : public Condition , public RE::BSTEventSink<RE::BGSNewVoicePowerEvent>
{
public:
	PowerLearnedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;

	std::string formid;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::BGSNewVoicePowerEvent* a_event, RE::BSTEventSource<RE::BGSNewVoicePowerEvent>*) override;
};

class PowerLearnedConditionFactory : public ConditionFactory {
public:
	PowerLearnedConditionFactory();
	Condition* createCondition() override;
};