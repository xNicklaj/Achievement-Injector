#include "CustomRE.h"
std::int32_t RE::QueryStat(const char* name) {
    std::int32_t result[4] = { 0, 0, 0, 0 };
    using type = bool(*)(RE::BSFixedString, std::int32_t*);
    static REL::Relocation<type> func{
        REL::VariantID(16120, 16362, 0x2094F0)
    };
    func(name, result);
    return result[0];
    }
