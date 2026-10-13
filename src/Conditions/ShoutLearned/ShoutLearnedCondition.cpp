#include "ShoutLearnedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ShoutLearnedCondition::ShoutLearnedCondition() : Condition(ConditionType::SpellLearned) {}
void ShoutLearnedCondition::OnDataLoaded(void) {
	this->cachedShout = GetFormOfType<RE::TESShout>(this->FormID, this->plugin);
    if (this->cachedShout) KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Subscribe(StatKey("Words Of Power Learned"), this);
    CheckCondition();
}
void ShoutLearnedCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
}
void ShoutLearnedCondition::SetConditionParameters(std::string formID_a, int wordNumber_a) {
    this->FormID = formID_a;
    this->wordNumber = wordNumber_a;
}
RE::BSEventNotifyControl ShoutLearnedCondition::ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) {
    if (a_event->stat == "Words Of Power Learned") CheckCondition();
    
    return RE::BSEventNotifyControl::kContinue;
}

bool ShoutLearnedCondition::CheckCondition() {
    bool found = false;
    RE::TESShout* target = this->cachedShout;
    RE::TESNPC* player = RE::PlayerCharacter::GetSingleton()->GetActorBase();
    if(!target) return false;

    int wordCount = 0;
    if (!found) {
        for (unsigned i = 0; i < player->GetSpellList()->numShouts; i++) {
            RE::TESShout* shout = player->GetSpellList()->shouts[i];
            if (shout && shout->formID == target->formID) {
                found = true;
                for(const auto& variation : shout->variations){
                    if(variation.word->GetKnown()) 
                        wordCount++;
				}
                logger::debug("Shouts {} has learned {}/3 words. ({} required)", shout->fullName.c_str(), wordCount, this->wordNumber);
                break;
            }
        }
    }
    
    if (found && wordCount >= this->wordNumber) {
        logger::info("Player met condition learned shout {}:{}", target->fullName.c_str(), FormIDToString(target->formID));
        this->UnlockNotify();
        KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Unsubscribe(this);
    }
    return false;
}

ShoutLearnedConditionFactory::ShoutLearnedConditionFactory() : ConditionFactory() {};
Condition* ShoutLearnedConditionFactory::createCondition() {
    return new ShoutLearnedCondition();
}