#ifndef PAPYRUSVARIABLE_CONDITION_H
#define PAPYRUSVARIABLE_CONDITION_H

#include "../Condition.h"
#include "../../CommonFunctions.h"

// Met when an int script variable (or property) on a form's Papyrus script reaches a value.
// Re-checked whenever a menu closes; Papyrus has no "variable changed" event.
class PapyrusVariableCondition : public Condition, public RE::BSTEventSink<RE::MenuOpenCloseEvent> {
public:
	PapyrusVariableCondition();

	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	bool CheckCondition() override;
	void SetParameters(std::string formID, std::string script, std::string variable, int value);

	std::string formIDStr;
	std::string script;
	std::string variable;
	int value = 0;
	RE::FormID cachedFormID = 0;
private:
	bool loggedMissing = false;
	RE::BSEventNotifyControl ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) override;
};

#endif // PAPYRUSVARIABLE_CONDITION_H
