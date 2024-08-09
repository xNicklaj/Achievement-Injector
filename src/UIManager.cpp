#include "UIManager.h"
#include "log.h"
#include <functional>
#include "AchievementManager.h"


UIManager::UIManager() {
    this->eventHandler.appendListener("AchievementUnlocked", []() {

    });
}

