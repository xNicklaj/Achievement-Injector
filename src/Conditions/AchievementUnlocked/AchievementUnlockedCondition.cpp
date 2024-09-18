#include "AchievementUnlockedCondition.h"
#include "../../Serializer.h"
#include "../../settings.h"

extern void RegisterPostLoadFunction(Condition* condition);

AchievementUnlockedCondition::AchievementUnlockedCondition(void) : Condition(ConditionType::AchievementUnlocked) {};
void AchievementUnlockedCondition::OnDataLoaded(void) {
	CheckCondition();
};
void AchievementUnlockedCondition::EnableListener(void) {
	RegisterPostLoadFunction(this);
	AchievementManager::GetSingleton()->AddEventSink([this](AchievementUnlockedEvent* a_event) {
			this->ProcessEvent(a_event);
	});
};
void AchievementUnlockedCondition::SetConditionParameters(std::string achievementName, std::string groupName) {
	this->achievementName = achievementName;
	this->groupName = groupName;
};
bool AchievementUnlockedCondition::CheckCondition() {
	if (Settings::GetSingleton()->GetGlobal()) {
		SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData_GLOBAL(this->achievementName);
		if (sa.unlocked) {
			logger::info("Player met condition unlocked {}", this->achievementName);
			this->UnlockNotify();
			return true;
		}
	}
	else {
		SerializedAchievement sa = Serializer::GetSingleton()->DeserializeAchievementData(this->achievementName);
		if (sa.unlocked) {
			logger::info("Player met condition unlocked {}", this->achievementName);
			this->UnlockNotify();
			return true;
		}
	}
	return false;
};
void AchievementUnlockedCondition::ProcessEvent(AchievementUnlockedEvent* a_event) {
	if (a_event->achievement->achievementName == this->achievementName && a_event->achievementGroup == this->groupName) {
		logger::info("Player met condition unlocked {}", this->achievementName);
		this->UnlockNotify();
	}
}

// GlobalVariableStateConditionFactory
AchievementUnlockedConditionFactory::AchievementUnlockedConditionFactory() : ConditionFactory() {};
Condition* AchievementUnlockedConditionFactory::createCondition() {
	return new AchievementUnlockedCondition();
};