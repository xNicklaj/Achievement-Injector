#pragma once

const RE::GFxValue SYSTEMMENU_ALIAS = "$ACHIEVEMENTS MENU";

uint16_t CheckQuestStage(std::string FormID, std::string baseEsp);
RE::ActorValue StringToActorValue(std::string value);
std::string FormIDToString(RE::FormID formID);
void AddMenuOption();