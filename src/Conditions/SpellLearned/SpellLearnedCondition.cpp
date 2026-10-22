#include "SpellLearnedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

SpellLearnedCondition::SpellLearnedCondition() : Condition() {}
void SpellLearnedCondition::OnDataLoaded(void) {
    this->cachedSpell = GetFormOfType<RE::SpellItem>(this->FormID, this->plugin);
    CheckCondition();
}
void SpellLearnedCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
    RE::SpellsLearned::GetEventSource()->AddEventSink(this);
    // SpellsLearned only fires for spell tomes; AddSpell (console, quest scripts) is caught on the next load door / fast travel
    RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->AddEventSink<RE::PositionPlayerEvent>(this);
}
void SpellLearnedCondition::SetConditionParameters(std::string formID) {
    this->FormID = formID;
}
RE::BSEventNotifyControl SpellLearnedCondition::ProcessEvent(const RE::SpellsLearned::Event*, RE::BSTEventSource<RE::SpellsLearned::Event>*) {
    // The event carries no spell (CommonLib removed the member), it is only a trigger: ask the player instead
    if (!this->isMet) CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}
RE::BSEventNotifyControl SpellLearnedCondition::ProcessEvent(const RE::PositionPlayerEvent*, RE::BSTEventSource<RE::PositionPlayerEvent>*) {
    if (!this->isMet) CheckCondition();
    return RE::BSEventNotifyControl::kContinue;
}

bool SpellLearnedCondition::Evaluate() {
    // Live conditions skip OnDataLoaded, so resolve lazily
    if (!this->cachedSpell) this->cachedSpell = GetFormOfType<RE::SpellItem>(this->FormID, this->plugin);
    RE::SpellItem* target = this->cachedSpell;
    if (!target) return false;
    RE::TESNPC* player = RE::PlayerCharacter::GetSingleton()->GetActorBase();

    if (RE::PlayerCharacter::GetSingleton()->HasSpell(target))
        return true;

    for (unsigned i = 0; i < player->GetSpellList()->numSpells; i++) {
        RE::SpellItem* spell = player->GetSpellList()->spells[i];
        if (spell && spell->formID == target->formID) return true;
    }
    return false;
}

bool SpellLearnedCondition::CheckCondition() {
    if (this->isMet) return true;
    bool found = Evaluate();
    RE::SpellItem* target = this->cachedSpell;

    if (found) {
        logger::info("Player met condition learned {}:{}", target->fullName.c_str(), FormIDToString(target->formID));
        this->UnlockNotify();
        StopListening();
    }
    return found;
}
void SpellLearnedCondition::StopListening(void) {
    RE::SpellsLearned::GetEventSource()->RemoveEventSink(this);
    RE::PlayerCharacter::GetSingleton()->AsPositionPlayerEventSource()->RemoveEventSink(this);
}
