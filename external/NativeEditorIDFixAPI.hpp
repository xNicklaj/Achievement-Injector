//----------------------------------------------------------------------------------------------
// Native EditorID Fix
// Copyright (c) 2023 Kitsuune - Apache License 2.0
//

#pragma once

#ifndef WIN32_LEAN_AND_MEAN
#	define WIN32_LEAN_AND_MEAN 1
#endif

#ifndef NOMINMAX
#	define NOMINMAX 1
#endif

#include <Windows.h>
#include <cstdint>

namespace NEIF // Native Editor ID Fix
{
	enum class EditorIDLookupState : uint32_t
	{
		None,          // Lookup functionality is either disabled or the mod isn't available
		ExternalOnly,  // Lookup only possible externally. Native support disabled
		NativeNoNodes, // Native lookup enabled. Engine node naming was patched to exclude EditorIDs
		Native         // Full native lookup enabled
	};

	struct TESForm
	{
		uint8_t  Pad0[0x14];
		uint32_t FormID;
		uint8_t  Pad18[0x2];
		uint8_t  FormType;
		uint8_t  Pad1B[0x3];
	};

	struct FormInfo
	{
		FormInfo() = default;
		FormInfo(uint32_t ID, uint8_t Type) : ID(ID), Type(Type) {}
		FormInfo(const TESForm& In) : ID(In.FormID), Type(In.FormType) {}

		uint32_t ID;
		uint8_t  Type;
	};

	namespace Details
	{
		template<typename T> auto ExplicitImport(const char* Name)
		{
			auto Handle = GetModuleHandleW(L"NativeEditorIDFix");
			return Handle ? reinterpret_cast<T>(GetProcAddress(Handle, Name)) : nullptr;
		}

		using GetEditorIDLookupStateT = EditorIDLookupState(*)();
		using GetEditorIDT            = const char*(*)(FormInfo);

		constexpr const char* GetEditorIDLookupStateName = "NEIF_GetEditorIDLookupState";
		constexpr const char* GetEditorIDName            = "NEIF_GetEditorID";
	}

	inline EditorIDLookupState GetEditorIDLookupState()
	{
		static auto Func = Details::ExplicitImport<Details::GetEditorIDLookupStateT>(Details::GetEditorIDLookupStateName);
		return Func ? Func() : EditorIDLookupState::None;
	}

	inline const char* GetEditorID(const void* Form)
	{
		static auto Func = Details::ExplicitImport<Details::GetEditorIDT>(Details::GetEditorIDName);
		return Form && Func ? Func(*static_cast<const TESForm*>(Form)) : "";
	}
}
