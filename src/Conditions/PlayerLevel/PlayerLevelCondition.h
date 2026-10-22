#include "../Condition.h"

class PlayerLevelCondition : public Condition, public RE::BSTEventSink<RE::LevelIncrease::Event> {
public:
	PlayerLevelCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void StopListening(void) override;
	void SetConditionParameters(int level) override;
	void SetConditionParameters(std::string op, int level) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	int level = 0;
	std::string OP = ">=";
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::LevelIncrease::Event* a_event, RE::BSTEventSource<RE::LevelIncrease::Event>*) override;
};