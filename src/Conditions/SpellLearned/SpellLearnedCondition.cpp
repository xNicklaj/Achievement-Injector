#include "SpellLearnedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

SpellLearnedCondition::SpellLearnedCondition() : Condition(ConditionType::SpellLearned) {}
void SpellLearnedCondition::OnDataLoaded(void) {
    this->cachedSpell = GetFormOfType<RE::SpellItem>(this->FormID, this->plugin);
    CheckCondition();
}
void SpellLearnedCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
    RE::SpellsLearned::GetEventSource()->AddEventSink(this);
}
void SpellLearnedCondition::SetConditionParameters(std::string formID) {
    this->FormID = formID;
}
RE::BSEventNotifyControl SpellLearnedCondition::ProcessEvent(const RE::SpellsLearned::Event* a_event, RE::BSTEventSource<RE::SpellsLearned::Event>*) {
    if(!a_event || !a_event->spell) return RE::BSEventNotifyControl::kContinue;
    if (this->cachedSpell && a_event->spell->GetFormID() == this->cachedSpell->formID) {
        CheckCondition();
    }
    
    return RE::BSEventNotifyControl::kContinue;
}

bool SpellLearnedCondition::CheckCondition() {
    bool found = false;
    RE::SpellItem* target = this->cachedSpell;
    if (!target) return false;
    RE::TESNPC* player = RE::PlayerCharacter::GetSingleton()->GetActorBase();
    
    if (target && RE::PlayerCharacter::GetSingleton()->HasSpell(target))
        found = true;

    if (!found) {
        for (unsigned i = 0; i < player->GetSpellList()->numSpells; i++) {
            RE::SpellItem* spell = player->GetSpellList()->spells[i];
            if (spell && spell->formID == target->formID) {
                found = true;
                break;
            }
        }
    }
    
    if (found) {
        logger::info("Player met condition learned {}:{}", target->fullName.c_str(), FormIDToString(target->formID));
        this->UnlockNotify();
        RE::SpellsLearned::GetEventSource()->RemoveEventSink(this);
    }
    return false;
}