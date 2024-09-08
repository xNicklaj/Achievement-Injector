#ifndef ACHIEVEMENTUNLOCKED_CONDITION_H
#define ACHIEVEMENTUNLOCKED_CONDITION_H

#include "../Condition.h" // Ensure this is the correct path to Condition.h
#include "../../AchievementManager.h" 

class AchievementUnlockedCondition : public Condition{
public:
    AchievementUnlockedCondition();
    void OnDataLoaded() override;
    void EnableListener() override;
    void SetConditionParameters(std::string stat, std::string value) override;
    bool CheckCondition();
    
    void ProcessEvent(AchievementUnlockedEvent*);
private:
    std::string achievementName = "";
    std::string groupName = "";
};

class AchievementUnlockedConditionFactory : public ConditionFactory {
public:
    AchievementUnlockedConditionFactory();
    Condition* createCondition() override;
};

#endif // QUERY_STAT_VALUE_CONDITION_H
