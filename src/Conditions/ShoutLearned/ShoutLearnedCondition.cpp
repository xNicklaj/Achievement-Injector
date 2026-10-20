#include "ShoutLearnedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ShoutLearnedCondition::ShoutLearnedCondition() : Condition() {}
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

bool ShoutLearnedCondition::Evaluate() {
    // Live conditions skip OnDataLoaded, so resolve lazily
    if (!this->cachedShout) this->cachedShout = GetFormOfType<RE::TESShout>(this->FormID, this->plugin);
    RE::TESShout* target = this->cachedShout;
    RE::TESNPC* player = RE::PlayerCharacter::GetSingleton()->GetActorBase();
    if(!target) return false;

    for (unsigned i = 0; i < player->GetSpellList()->numShouts; i++) {
        RE::TESShout* shout = player->GetSpellList()->shouts[i];
        if (shout && shout->formID == target->formID) {
            int wordCount = 0;
            for(const auto& variation : shout->variations){
                if(variation.word->GetKnown())
                    wordCount++;
            }
            logger::debug("Shouts {} has learned {}/3 words. ({} required)", shout->fullName.c_str(), wordCount, this->wordNumber);
            return wordCount >= this->wordNumber;
        }
    }
    return false;
}

bool ShoutLearnedCondition::CheckCondition() {
    if (Evaluate()) {
        RE::TESShout* target = this->cachedShout;
        logger::info("Player met condition learned shout {}:{}", target->fullName.c_str(), FormIDToString(target->formID));
        this->UnlockNotify();
        KeyedSink<RE::TESTrackedStatsEvent>::GetSingleton()->Unsubscribe(this);
    }
    return false;
}
