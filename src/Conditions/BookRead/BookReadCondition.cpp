#include "BookReadCondition.h"
#include "../../CommonFunctions.h"

extern void RegisterPostLoadFunction(Condition* condition);

BookReadCondition::BookReadCondition() : Condition(ConditionType::BookRead) {}

void BookReadCondition::OnDataLoaded(void) {
    CheckCondition();
}
void BookReadCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::BooksRead::GetEventSource()->AddEventSink(this);
}
void BookReadCondition::SetConditionParameters(std::string identifier_a) {
    this->identifier = identifier_a;
}
void BookReadCondition::Localize(std::string path) {
    if(this->identifier[0] == '$')
		this->identifier = LocalizationManager::GetSingleton()->GetLocalizedText(path, LocalizationManager::GetSingleton()->CurrentLocale(), this->identifier);
}
bool BookReadCondition::CheckCondition() { return false; }
RE::BSEventNotifyControl BookReadCondition::ProcessEvent(const RE::BooksRead::Event* a_event, RE::BSTEventSource<RE::BooksRead::Event>*) {
	std::string targetName = a_event->book->GetFullName();
    bool IsHex = isHex(identifier);
	if ((IsHex && GetForm(this->identifier,this->plugin)->formID == a_event->book->formID) || (!IsHex && targetName == this->identifier))
	{
        logger::info("Player met condition read book {}.", this->identifier);
        this->UnlockNotify();
        RE::BooksRead::GetEventSource()->RemoveEventSink(this);
	}
	return RE::BSEventNotifyControl::kContinue;
}

BookReadConditionFactory::BookReadConditionFactory() : ConditionFactory() {};
Condition* BookReadConditionFactory::createCondition() {
	return new BookReadCondition();
};