#include "Serializer.h"
#include "settings.h"
#include <algorithm>


namespace fs = std::filesystem;
using json = nlohmann::json;

std::string Serializer::GetFilename(bool useGlobal) const {
	std::string playerName = "GLOBAL";
	if (!useGlobal) {
		playerName = RE::PlayerCharacter::GetSingleton()->GetName();
		std::transform(playerName.begin(), playerName.end(), playerName.begin(), [](unsigned char c) { return std::toupper(c); });
		playerName.erase(std::remove(playerName.begin(), playerName.end(), ' '), playerName.end());
		// Characters Windows refuses in a file name would leave this character without a save file
		for (char& c : playerName) if (static_cast<unsigned char>(c) < 32 || std::string_view("<>:\"/\\|?*").find(c) != std::string_view::npos) c = '_';
	}
	return DIRECTORY_PATH + std::format(FILENAME, playerName);
}

void Serializer::Load(Store& store) {
	const std::string path = GetFilename(store.global);
	if (path == store.loadedPath) return;
	if (!SaveStore::Load(path, store.data)) logger::error("{} is missing or unreadable, starting empty (previous copy kept as .bak).", path);
	store.loadedPath = path;
}

void Serializer::Save(Store& store) {
	if (deferSaves) { store.savePending = true; return; }
	const std::string path = GetFilename(store.global);
	if (!SaveStore::Write(path, store.data)) logger::error("Failed to write {}.", path);
}

void Serializer::Write(Store& store, Achievement* achievement) {
	// Never write one character's data into another's file: make sure the store holds the current file first
	Load(store);
	const int64_t now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
	// Put refuses an entry that is already unlocked: other conditions of an OR achievement still ask for saves after it unlocked
	if (SaveStore::Put(store.data, achievement->achievementName, achievement->unlocked, achievement->unlocked ? now_ms : -1, achievement->GetConditionsState()))
		Save(store);
}

void Serializer::SerializeAchievementData(Achievement* achievement) {
	Write(global, achievement);
	if (!Settings::GetSingleton()->GetGlobal()) Write(character, achievement);
}

struct SerializedAchievement Serializer::DeserializeAchievementData(std::string name) {
	Store& store = Settings::GetSingleton()->GetGlobal() ? global : character;
	Load(store);
	return SaveStore::Find(store.data, name);
}

void Serializer::DeferSaves(bool defer) {
	deferSaves = defer;
	if (defer) return;
	for (Store* store : { &character, &global }) {
		if (!store->savePending) continue;
		store->savePending = false;
		Save(*store);
	}
}

void Serializer::CreateFileIfNotExists() {
	std::error_code ec;
	fs::create_directories(DIRECTORY_PATH, ec);
	// The two files are independent: one existing must not skip creating the other
	for (Store* store : { &character, &global }) {
		const std::string path = GetFilename(store->global);
		if (SaveStore::Exists(path)) continue;
		store->data = SaveStore::Empty();
		store->loadedPath = path;
		Save(*store);
	}
}
