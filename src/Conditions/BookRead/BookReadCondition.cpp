#include "BookReadCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

BookReadCondition::BookReadCondition() : Condition(ConditionType::BookRead) {}

void BookReadCondition::OnDataLoaded(void) {
    CheckCondition();
}
void BookReadCondition::EnableListener() {
    RegisterPostLoadFunction(this);
    RE::BooksRead::GetEventSource()->AddEventSink(this);
}
void BookReadCondition::SetConditionParameters(std::string bookName) {
    this->bookName = bookName;
}
void BookReadCondition::Localize(std::string path) {
    if(this->bookName[0] == '$')
		this->bookName = LocalizationManager::GetSingleton()->GetLocalizedText(path, LocalizationManager::GetSingleton()->CurrentLocale(), this->bookName);
}
bool BookReadCondition::CheckCondition() { return false; }
RE::BSEventNotifyControl BookReadCondition::ProcessEvent(const RE::BooksRead::Event* a_event, RE::BSTEventSource<RE::BooksRead::Event>*) {
	std::string targetName = a_event->book->GetFullName();
	if (targetName == this->bookName)
	{
        logger::info("Player met condition read book {}.", this->bookName);
        this->UnlockNotify();
        RE::BooksRead::GetEventSource()->RemoveEventSink(this);
	}
	return RE::BSEventNotifyControl::kContinue;
}

BookReadConditionFactory::BookReadConditionFactory() : ConditionFactory() {};
Condition* BookReadConditionFactory::createCondition() {
	return new BookReadCondition();
};