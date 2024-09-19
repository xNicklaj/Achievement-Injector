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
void AchievementUnlockedCondition::SetConditionParameters(std::string achievementName_a, std::string groupName_a) {
	this->achievementName = achievementName_a;
	this->groupName = groupName_a;
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