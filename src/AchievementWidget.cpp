#include <chrono>
#include "AchievementWidget.h"
#include "settings.h"

namespace Scaleform {
	AchievementWidget::AchievementWidget()
	{
		auto scaleformManager = RE::BSScaleformManager::GetSingleton();

		inputContext = Context::kNone;
		depthPriority = 0;

		menuFlags.set(RE::UI_MENU_FLAGS::kAlwaysOpen);
		menuFlags.set(RE::UI_MENU_FLAGS::kRequiresUpdate);
		menuFlags.set(RE::UI_MENU_FLAGS::kAllowSaving);

		if (uiMovie) {
			uiMovie->SetMouseCursorCount(0);  // disable input
		}

		scaleformManager->LoadMovieEx(this, MENU_PATH, [this](RE::GFxMovieDef* a_def) {
			a_def->SetState(
				RE::GFxState::StateType::kLog,
				RE::make_gptr<Logger>().get());
		});
	}

	RE::GPtr<AchievementWidget> AchievementWidget::GetAchievementWidget()
	{
		auto ui = RE::UI::GetSingleton();
		return ui ? ui->GetMenu<AchievementWidget>(AchievementWidget::MENU_NAME) : nullptr;
	}

	void AchievementWidget::Register()
	{
		auto ui = RE::UI::GetSingleton();
		if (ui) {
			ui->Register(MENU_NAME, Creator);
			logger::info("Menu Registered.");
		}
	}

	void AchievementWidget::Show()
	{
		auto msgQ = RE::UIMessageQueue::GetSingleton();
		if (msgQ) {
			msgQ->AddMessage(AchievementWidget::MENU_NAME, RE::UI_MESSAGE_TYPE::kShow, nullptr);
		}
	}

	void AchievementWidget::Hide()
	{
		auto msgQ = RE::UIMessageQueue::GetSingleton();
		if (msgQ) {
			msgQ->AddMessage(AchievementWidget::MENU_NAME, RE::UI_MESSAGE_TYPE::kHide, nullptr);
		}
	}

	// pass the breath meter percents to the scaleform menu using invokes, and tell the menu when to show or hide itself (as in within the scaleform, not the IMenu kHide flag)
	void AchievementWidget::Update()
	{

	}

	// Every time a new frame of the menu is rendered call the update function.
	void AchievementWidget::AdvanceMovie(float a_interval, std::uint32_t a_currentTime)
	{
		AchievementWidget::Update();
		RE::IMenu::AdvanceMovie(a_interval, a_currentTime);
	}

	RE::UI_MESSAGE_RESULTS AchievementWidget::ProcessMessage(RE::UIMessage& a_message)
	{
		using Type = RE::UI_MESSAGE_TYPE;

		switch (*a_message.type) {
		case Type::kShow:
			OnOpen();
			return RE::IMenu::ProcessMessage(a_message);
		case Type::kHide:
			OnClose();
			return RE::IMenu::ProcessMessage(a_message);
		default:
			return RE::IMenu::ProcessMessage(a_message);
		}
	}

	bool AchievementWidget::IsOpen() const
	{
		return _bIsOpen;
	}

	void AchievementWidget::OnOpen()
	{
		// The advance movie process will handle showing the meter when appropriate
		AchievementWidget::SetMenuVisibilityMode(AchievementWidget::MenuVisibilityMode::kHidden);
		_bIsOpen = true;
	}

	void AchievementWidget::OnClose()
	{
		want_visible = false;
		_bIsOpen = false;
	}

	void AchievementWidget::SetMenuVisibilityMode(MenuVisibilityMode a_mode)
	{
		auto menu = GetAchievementWidget();
		if (menu) {
			auto _view = menu->uiMovie;

			if (_view) {
				switch (a_mode) {
				case MenuVisibilityMode::kHidden:
					if (menu->_menuVisibilityMode == MenuVisibilityMode::kVisible) {
						_view->SetVisible(false);
						menu->_menuVisibilityMode = a_mode;
					}
					break;

				case MenuVisibilityMode::kVisible:
					if (menu->_menuVisibilityMode == MenuVisibilityMode::kHidden && want_visible) {
						_view->SetVisible(true);
						menu->_menuVisibilityMode = a_mode;
					}
					break;
				}
			}
		}
	}

}