#include "Sync.h"
#include "Scaleform.h"
#include "AchievementWidget.h"
#include <thread>
#include <chrono>


std::queue<std::tuple<std::string, std::string, std::string>> entryQueue;
std::atomic<bool> isDisplayingEntry = false;
std::mutex entryMutex;

void ProcessQueue() {
    while (true) {
        std::unique_lock<std::mutex> lock(entryMutex);
        auto ui = RE::UI::GetSingleton();

        if (ui && !entryQueue.empty() && !isDisplayingEntry && !ui->GameIsPaused()) {
            std::tuple<std::string, std::string, std::string> args = entryQueue.front();
            entryQueue.pop();

            lock.unlock();

            isDisplayingEntry = true;

            // Scaleform may only be touched from the UI thread
            SKSE::GetTaskInterface()->AddUITask([args]() {
                Scaleform::AchievementWidget::DisplayEntry(std::get<0>(args), std::get<1>(args), std::get<2>(args));
            });

            std::this_thread::sleep_for(std::chrono::seconds(4));

            isDisplayingEntry = false;
        }
        else {
            lock.unlock();
            std::this_thread::sleep_for(
                std::chrono::milliseconds(100));
        }
    }
}