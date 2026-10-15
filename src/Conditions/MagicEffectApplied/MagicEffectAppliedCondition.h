#ifndef MAGICEFFECTAPPLIED_CONDITION_H
#define MAGICEFFECTAPPLIED_CONDITION_H

#include "../Condition.h"

// Met when the given magic effect lands on the player. JSON: { "type": "MagicEffectApplied", "formID": "<magic effect>" }
// Unlike SpellCast this also sees effects from spells that scripts cast (Papyrus Spell.Cast raises no
// TESSpellCastEvent). The formID is the magic effect (MGEF), not the spell; a spell with several effects can be
// matched by listing each one as its own condition.
class MagicEffectAppliedCondition : public Condition, public RE::BSTEventSink<RE::TESMagicEffectApplyEvent> {
public:
	MagicEffectAppliedCondition();
	void OnDataLoaded(void) override;
	void EnableListener(void) override;
	void SetConditionParameters(std::string formid) override;
	bool CheckCondition() override;

	std::string formid;
	RE::FormID cachedFormID = 0;
private:
	RE::BSEventNotifyControl ProcessEvent(const RE::TESMagicEffectApplyEvent* a_event, RE::BSTEventSource<RE::TESMagicEffectApplyEvent>*) override;
};

#endif // MAGICEFFECTAPPLIED_CONDITION_H
