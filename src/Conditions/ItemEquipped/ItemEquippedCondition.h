#ifndef ITEMEQUIPPED_CONDITION_H
#define ITEMEQUIPPED_CONDITION_H

#include "../Condition.h"

// Met when the player equips the given item (armor, weapon, ammo...). JSON: { "type": "ItemEquipped", "formID": "<item>" }
// Latches once met: unequipping later does not undo it, so joining several of these with AND means
// "has worn each at some point", not "wears them all at once". An item already worn when the save loads counts.
class ItemEquippedCondition : public Condition, public RE::BSTEventSink<RE::TESEquipEvent> {
public:
	ItemEquippedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;
	bool SupportsLive() override { return true; }
	bool Evaluate() override;

	std::string formid;
	RE::FormID cachedFormID = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESEquipEvent* a_event, RE::BSTEventSource<RE::TESEquipEvent>*) override;
};

#endif // ITEMEQUIPPED_CONDITION_H
