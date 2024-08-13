#include <vector>
#include <nlohmann/json.hpp>

#ifndef RUNNABLE_H
#define RUNNABLE_H

using json = nlohmann::json;

enum Type_e {
	kConsoleCommand,
	kPapyrusScript
};

struct Runnable_t {
	Type_e type;
	std::string arg01; // Console command for kConsoleComand or ScriptName for kPapyrusScript
	std::string arg02; // Function name for kPapyrusScript or empty for kConsoleCommand
	std::string plugin; // Plugin name for kPapyrusScript or empty for kConsoleCommand
};

class Runnable {
public:
	Runnable(json jsonData);
	int RunAll();
	void push_back(Runnable_t runnable);
protected:
	std::vector<Runnable_t> m_runnables;;
};

#endif