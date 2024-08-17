#include "ShoutLearnedCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

ShoutLearnedCondition::ShoutLearnedCondition() : Condition(ConditionType::SpellLearned) {}
void ShoutLearnedCondition::OnDataLoaded(void) {
    CheckCondition();
}
void ShoutLearnedCondition::EnableListener(void)
{
    RegisterPostLoadFunction(this);
    RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink(this);
}
void ShoutLearnedCondition::SetConditionParameters(std::string formID, int wordNumber) {
    this->FormID = formID;
    this->wordNumber = wordNumber;
}
RE::BSEventNotifyControl ShoutLearnedCondition::ProcessEvent(const RE::TESTrackedStatsEvent* a_event, RE::BSTEventSource<RE::TESTrackedStatsEvent>*) {
    if (a_event->stat == "Words Of Power Learned") {
        CheckCondition();
    }
    
    CheckCondition();
    
    return RE::BSEventNotifyControl::kContinue;
}

bool ShoutLearnedCondition::CheckCondition() {
    bool found = false;
    RE::TESShout* target = static_cast<RE::TESShout*>(GetForm(this->FormID, this->plugin));
    RE::TESNPC* player = RE::TESNPC::LookupByID<RE::TESNPC>(GetForm("000007", "Skyrim.esm")->formID);

    int wordCount = 0;
    if (!found) {
        for (int i = 0; i < player->GetSpellList()->numShouts; i++) {
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
        RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
    }
    return false;
}

ShoutLearnedConditionFactory::ShoutLearnedConditionFactory() : ConditionFactory() {};
Condition* ShoutLearnedConditionFactory::createCondition() {
    return new ShoutLearnedCondition();
}