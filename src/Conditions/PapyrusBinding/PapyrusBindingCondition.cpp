#include "PapyrusBindingCondition.h"

PapyrusBindingCondition::PapyrusBindingCondition(void) : Condition(ConditionType::PapyrusBinding) {}

PapyrusBindingConditionFactory::PapyrusBindingConditionFactory() : ConditionFactory() {}
Condition* PapyrusBindingConditionFactory::createCondition() {
    return new PapyrusBindingCondition();
}
