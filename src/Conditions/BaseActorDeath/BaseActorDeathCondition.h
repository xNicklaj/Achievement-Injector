#include "../Condition.h"

class BaseActorDeathCondition : public Condition, public RE::BSTEventSink<RE::TESDeathEvent> {
public:
	BaseActorDeathCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string identifier, int quantity) override;
	bool CheckCondition();

	int Serialize() override;
	bool Deserialize(int value) override;

	void Localize(std::string path) override;

	std::string identifier = "";
	std::string name = "";
	int quantity = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESDeathEvent * a_event, RE::BSTEventSource<RE::TESDeathEvent>*) override;
	int currQuantity = 0;
	bool isFormID = false;
};

class BaseActorDeathConditionFactory : public ConditionFactory {
public:
	BaseActorDeathConditionFactory();
	Condition* createCondition() override;
};