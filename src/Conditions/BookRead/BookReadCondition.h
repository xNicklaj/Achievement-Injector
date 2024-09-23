#include "../Condition.h"

class BookReadCondition : public Condition, RE::BSTEventSink<RE::BooksRead::Event> {
public:
	BookReadCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;
	void Localize(std::string path) override;

	std::string identifier;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::BooksRead::Event* a_event, RE::BSTEventSource<RE::BooksRead::Event>*) override;
};
class BookReadConditionFactory : public ConditionFactory {
public:
	BookReadConditionFactory();
	Condition* createCondition() override;
};