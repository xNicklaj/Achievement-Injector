#include "PapyrusVariableCondition.h"

extern void RegisterPostLoadFunction(Condition* condition);

PapyrusVariableCondition::PapyrusVariableCondition(void) : Condition() {}

void PapyrusVariableCondition::SetParameters(std::string formID, std::string script_a, std::string variable_a, int value_a) {
	this->formIDStr = formID;
	this->script = script_a;
	this->variable = variable_a;
	this->value = value_a;
}

void PapyrusVariableCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	RE::UI::GetSingleton()->AddEventSink(this);
}

void PapyrusVariableCondition::OnDataLoaded(void) {
	this->cachedFormID = GetFormID(this->formIDStr, this->plugin);
	if (!this->cachedFormID) {
		logger::error("PapyrusVariable: failed to resolve form {} in {}", this->formIDStr, this->plugin);
	}
	CheckCondition();
}

bool PapyrusVariableCondition::CheckCondition() {
	if (this->isMet || !this->cachedFormID) return false;

	auto form = RE::TESForm::LookupByID(this->cachedFormID);
	auto vm = RE::BSScript::Internal::VirtualMachine::GetSingleton();
	if (!form || !vm) return false;

	auto policy = vm->GetObjectHandlePolicy();
	if (!policy) return false;
	RE::VMHandle handle = policy->GetHandleForObject(form->GetFormType(), form);
	RE::BSTSmartPointer<RE::BSScript::Object> obj;
	// The script is absent until the quest has started; stay quiet apart from one log line
	if (!handle || !vm->FindBoundObject(handle, this->script.c_str(), obj) || !obj) {
		if (!this->loggedMissing) {
			logger::info("PapyrusVariable: script {} not bound to form {} (yet)", this->script, this->formIDStr);
			this->loggedMissing = true;
		}
		return false;
	}

	// Script variables first, then properties (Papyrus properties may be backed by a ::var)
	const RE::BSFixedString name(this->variable);
	const RE::BSScript::Variable* var = obj->GetVariable(name);
	if (!var) var = obj->GetProperty(name);
	if (!var || !var->IsInt()) {
		if (!this->loggedMissing) {
			logger::error("PapyrusVariable: int variable {} not found on script {}", this->variable, this->script);
			this->loggedMissing = true;
		}
		return false;
	}

	if (var->GetSInt() >= this->value) {
		this->UnlockNotify();
		RE::UI::GetSingleton()->RemoveEventSink(this);
		return true;
	}
	return false;
}

RE::BSEventNotifyControl PapyrusVariableCondition::ProcessEvent(const RE::MenuOpenCloseEvent* a_event, RE::BSTEventSource<RE::MenuOpenCloseEvent>*) {
	if (a_event && !a_event->opening) {
		CheckCondition();
	}
	return RE::BSEventNotifyControl::kContinue;
}
