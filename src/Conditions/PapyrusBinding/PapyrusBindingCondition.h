#include "../Condition.h"

#ifndef PAPYRUSBINDING_CONDITION_H
#define PAPYRUSBINDING_CONDITION_H

class PapyrusBindingCondition : public Condition {
public:
	PapyrusBindingCondition();
};

class PapyrusBindingConditionFactory : public ConditionFactory {
public:
    PapyrusBindingConditionFactory();
    Condition* createCondition() override;
};

#endif  // PAPYRUSBINDING_CONDITION_H