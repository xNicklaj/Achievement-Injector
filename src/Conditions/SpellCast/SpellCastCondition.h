#ifndef SPELLCAST_CONDITION_H
#define SPELLCAST_CONDITION_H

#include "../Condition.h"

// Met when the player casts the given spell. JSON: { "type": "SpellCast", "formID": "<spell>" }
// Only sees casts that raise TESSpellCastEvent (hand casts, shouts, powers). Spells a script casts with Papyrus
// Spell.Cast raise no such event; use MagicEffectApplied on one of the spell's effects for those.
class SpellCastCondition : public Condition, public RE::BSTEventSink<RE::TESSpellCastEvent> {
public:
	SpellCastCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;

	std::string formid;
	RE::FormID cachedFormID = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESSpellCastEvent* a_event, RE::BSTEventSource<RE::TESSpellCastEvent>*) override;
};

#endif // SPELLCAST_CONDITION_H
