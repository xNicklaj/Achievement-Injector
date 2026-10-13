#ifndef SYNC_H
#define SYNC_H

#include <atomic>
#include <mutex>
#include <queue>
#include <string>

extern std::queue<std::tuple<std::string, std::string, std::string>> entryQueue;
extern std::atomic<bool> isDisplayingEntry;
extern std::mutex entryMutex;

void ProcessQueue();

#endif  // SYNC_H