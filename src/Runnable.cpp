#include "Runnable.h"
#include "log.h"
#include "../include/ConsoleUtilSSE.h"
#include "CommonFunctions.h"

Runnable::Runnable() {}

Runnable::Runnable(json jsonData) {
	this->push_back(jsonData);
}

void Runnable::push_back(json jsonData) {
	for (auto& element : jsonData) {
		Runnable_t runnable;

		if (element["type"] == "command") {
			runnable.type = kConsoleCommand;
			runnable.arg01 = element["command"];
			runnable.arg02 = "";
		}
		else if (element["type"] == "papyrus") {
			runnable.type = kPapyrusScript;
			runnable.arg01 = element["script"];
			runnable.arg02 = element["function"];
		}
		else {
			logger::warn("Found runnable with unknown type. Skipping.");

		}

		m_runnables.push_back(runnable);
	}
}

void Runnable::push_back(Runnable_t runnable) {
	m_runnables.push_back(runnable);
}
int Runnable::RunAll() {
	int i = 0;
	logger::debug("Running {} runnables", m_runnables.size());
	for (auto& runnable : m_runnables) {
		if (runnable.type == kConsoleCommand) {
			logger::info("Running console command: {}", runnable.arg01);
			Papyrus::ConsoleUtil::ExecuteCommand(NULL, runnable.arg01);
			i++;
		}
		else if (runnable.type == kPapyrusScript) {
			logger::info("Running papyrus script: {} with function: {}", runnable.arg01, runnable.arg02);
			RE::BSScript::IVirtualMachine* vm = RE::BSScript::Internal::VirtualMachine::GetSingleton();
			RE::BSTSmartPointer<RE::BSScript::IStackCallbackFunctor> callback = nullptr;
			RE::TESForm* form = GetForm("000D62", "testscript.esl");
			RE::VMHandle handle = vm->GetObjectHandlePolicy()->GetHandleForObject(RE::FormType::Quest, form);
			auto args = RE::MakeFunctionArguments();
			vm->DispatchMethodCall(handle, runnable.arg01, runnable.arg02, args, callback);
			//NativePapyrus::RunScript(runnable.arg01, runnable.arg02);
			i++;
		}
	}
	return i;
}