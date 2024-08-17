#include "BaseActorDeathCondition.h"
#include "../../CommonFunctions.h"

extern void RegisterPostLoadFunction(Condition* condition);

BaseActorDeathCondition::BaseActorDeathCondition() : Condition(ConditionType::BaseActorDeath){};
void BaseActorDeathCondition::OnDataLoaded(void) {
	// TODO check if actor is already dead

}
void BaseActorDeathCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::ScriptEventSourceHolder::GetSingleton()->AddEventSink(this);
};
void BaseActorDeathCondition::SetConditionParameters(std::string identifier, int quantity) {
	this->isFormID = isHex(identifier);
	this->identifier = identifier;
	this->quantity = quantity;
};
bool BaseActorDeathCondition::CheckCondition() {
	if (this->currQuantity >= this->quantity) {
		logger::info("Player met condition actor {} dead.", this->identifier);
		this->UnlockNotify();
		RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
	}
	return false;
};
RE::BSEventNotifyControl BaseActorDeathCondition::ProcessEvent(const RE::TESDeathEvent* a_event, RE::BSTEventSource<RE::TESDeathEvent>*) {
	
	if (!this->isFormID && a_event->actorDying->GetName() == this->identifier && a_event->dead) {
		currQuantity++;
	}
	else {
		auto* target = GetForm(this->identifier, this->plugin);
		if (target == NULL) {
			logger::error("Form {} not found.", this->identifier);
			return RE::BSEventNotifyControl::kContinue;
		}
		if (a_event->actorDying->data.objectReference->As<RE::TESNPC>()->GetFormID() == target->formID && a_event->dead) {
			currQuantity++;	
		}
	}
	if(!this->CheckCondition()) this->eventManager->dispatch("SerializationRequested");
	return RE::BSEventNotifyControl::kContinue;
};

bool BaseActorDeathCondition::Deserialize(int value) {
	this->currQuantity = value;
	return this->currQuantity >= this->quantity;
}

int BaseActorDeathCondition::Serialize() {
	return currQuantity;
}

void BaseActorDeathCondition::Localize(std::string path) {
	if (!this->isFormID && this->identifier[0] == '$')
		this->identifier = LocalizationManager::GetSingleton()->GetLocalizedText(path, LocalizationManager::GetSingleton()->CurrentLocale(), this->identifier);
}

BaseActorDeathConditionFactory::BaseActorDeathConditionFactory() : ConditionFactory() {};
Condition* BaseActorDeathConditionFactory::createCondition() {
	return new BaseActorDeathCondition();
};