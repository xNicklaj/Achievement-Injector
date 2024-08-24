import skse;

class AchievementsMenuInjector extends MovieClip {

    public var SystemPage:MovieClip;
    public var CategoryList:MovieClip;

    private var LoadGameIndex = 0;

    function onLoad() {
        SystemPage = _parent._parent.QuestJournalFader.Menu_mc.SystemFader.Page_mc;
        CategoryList = SystemPage.CategoryList_mc.List_mc;
        var _this = this;
        CategoryList.__InvalidateData = CategoryList.InvalidateData;
        CategoryList.InvalidateData = function() {
            var entryList = _this.CategoryList.entryList;
            for ( var i = 0; i < entryList.length; i++ ) {
                if ( entryList[ i ].text === '$LOAD' ) {
                    _this.LoadGameIndex = i + 1;
                    break;
                }
            }
            _this.CategoryList.entryList = entryList.slice(0, _this.LoadGameIndex).concat( [ { text : '$ACH_MENULBL', isAchievements : true } ], entryList.slice( _this.LoadGameIndex ) );
            _this.CategoryList.__InvalidateData();
        }
        CategoryList.InvalidateData();

        SystemPage.__onCategoryButtonPress = SystemPage.onCategoryButtonPress;
        SystemPage.onCategoryButtonPress = function(event:Object) {
            _this.LogObject(event.entry);
            if ( event.entry.isAchievements ) {
                skse.SendModEvent( 'AchievementsMenu_Open' );
            } else {
                if ( event.index > _this.LoadGameIndex ) {
                    event.index--;
                }

                _this.SystemPage.__onCategoryButtonPress(event);
            }
        }

    }

}