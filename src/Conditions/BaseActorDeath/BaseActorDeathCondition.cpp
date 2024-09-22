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
void BaseActorDeathCondition::SetConditionParameters(std::string identifier_a, int quantity_a) {
	this->isFormID = isHex(identifier_a);
	this->identifier = identifier_a;
	this->quantity = quantity_a;
};
void BaseActorDeathCondition::SetEditorID(bool a_isEditorID) {
    this->isEditorID = a_isEditorID;
}
bool BaseActorDeathCondition::CheckCondition() {
	if (this->currQuantity >= this->quantity) {
		logger::info("Player met condition actor {} dead.", this->identifier);
		this->UnlockNotify();
		RE::ScriptEventSourceHolder::GetSingleton()->RemoveEventSink(this);
	}
	return false;
};
RE::BSEventNotifyControl BaseActorDeathCondition::ProcessEvent(const RE::TESDeathEvent* a_event, RE::BSTEventSource<RE::TESDeathEvent>*) {
	bool isTarget = false;
	if (!a_event->actorDying->IsDead()) return RE::BSEventNotifyControl::kContinue;
	if (!this->isFormID && !this->isEditorID && a_event->dead) {
        logger::debug("Actor {} is dead. Reference found using name {}", a_event->actorDying->GetName(), this->identifier);
		if (a_event->actorDying->GetName() == this->identifier) {
            currQuantity++;
            isTarget = true;
		}
    } else if (this->isEditorID && a_event->dead) {
        std::string targetEditorID = clib_util::editorID::get_editorID(a_event->actorDying->GetBaseObject());
        logger::debug("Actor {} is dead. Reference found using editorID {}.", a_event->actorDying->GetName(), targetEditorID);
        
        if (targetEditorID == this->identifier) {
            currQuantity++;
            isTarget = true;
		}        
    }
	else {
		RE::TESNPC* target = static_cast<RE::TESNPC*>(GetForm(this->identifier, this->plugin));
		if (target == NULL) {
			logger::error("Form {} not found.", this->identifier);
			return RE::BSEventNotifyControl::kContinue;
		}
		if (a_event->dead) {
            logger::debug("Actor {} is dead. Reference found using formID {}", a_event->actorDying->GetName(), this->identifier);
			if (a_event->actorDying->data.objectReference->As<RE::TESNPC>()->GetFormID() == target->formID) {
                currQuantity++;
                isTarget = true;
			}
		}
	}
	if (isTarget) {
		if (!this->CheckCondition()) this->eventManager->dispatch("SerializationRequested");
		else this->UnlockNotify();
	}

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