#include "Singleton.h"
#include <eventpp/eventdispatcher.h>
#include "Scaleform.h"

class UIManager : public ISingleton<UIManager> {
public:
	UIManager();
	eventpp::EventDispatcher<std::string, void()> eventHandler;
};