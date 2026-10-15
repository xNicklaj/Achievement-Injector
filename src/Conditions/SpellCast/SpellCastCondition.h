#ifndef SPELLCAST_CONDITION_H
#define SPELLCAST_CONDITION_H

#include "../Condition.h"

// Met when the player casts the given spell. JSON: { "type": "SpellCast", "formID": "<spell>" } (optional "quantity", default 1)
// Only sees casts that raise TESSpellCastEvent (hand casts, shouts, powers). Spells a script casts with Papyrus
// Spell.Cast raise no such event; use MagicEffectApplied on one of the spell's effects for those.
class SpellCastCondition : public Condition, public RE::BSTEventSink<RE::TESSpellCastEvent> {
public:
	SpellCastCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	void SetConditionParameters(std::string formid, int quantity) override;
	bool CheckCondition() override;
	int Serialize() override;
	bool Deserialize(int value) override;

	std::string formid;
	RE::FormID cachedFormID = 0;
	int quantity = 1;
	int currQuantity = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESSpellCastEvent* a_event, RE::BSTEventSource<RE::TESSpellCastEvent>*) override;
};

#endif // SPELLCAST_CONDITION_H
