import skse;

class AchievementsMenuInjector extends MovieClip {

    public var SystemPage:MovieClip;
    public var CategoryList:MovieClip;

    private var LoadGameIndex = 0;
    private var itemEmbedDone:Boolean = false;

    function FindAchievementsIndex(entryList:Array) {
        for ( var i = 0; i < entryList.length; i++ ) {
            if ( entryList[ i ].isAchievements ) {
                return i;
            }
        }
        return -1;
    }

    function onLoad() {
        this.SystemPage = this._parent._parent.QuestJournalFader.Menu_mc.SystemFader.Page_mc;
        this.CategoryList = this.SystemPage.CategoryList_mc.List_mc;
        var _this = this;
        _this.CategoryList.__InvalidateData = _this.CategoryList.InvalidateData;
        _this.CategoryList.InvalidateData = function() {
            // The game may rebuild entryList at any time, so insert whenever our entry is missing (not once)
            var entryList = _this.CategoryList.entryList;
            if ( _this.FindAchievementsIndex( entryList ) === -1 ) {
                for ( var i = 0; i < entryList.length; i++ ) {
                    if ( entryList[ i ].text === '$LOAD' ) {
                        _this.LoadGameIndex = i + 1;
                        break;
                    }
                }
                _this.CategoryList.entryList = entryList.slice(0, _this.LoadGameIndex).concat( [ { text : '$ACH_MENULBL', isAchievements : true } ], entryList.slice( _this.LoadGameIndex ) );
                // Newer SystemPage dispatches on IDX_* positions it computed (by text) before our entry existed; recompute
                if ( typeof _this.SystemPage.UpdateIndices === 'function' ) {
                    _this.SystemPage.UpdateIndices();
                }
            }
            _this.CategoryList.__InvalidateData();
        }
        _this.CategoryList.InvalidateData();

        _this.SystemPage.__onCategoryButtonPress = _this.SystemPage.onCategoryButtonPress;
        _this.SystemPage.onCategoryButtonPress = function(event:Object) {
            _this.LogObject(event.entry);
            if ( event.entry.isAchievements ) {
                skse.SendModEvent( 'AchievementsMenu_Open' );
            } else {
                // Older SystemPage dispatches on fixed vanilla positions, so hide our entry from the index
                if ( typeof _this.SystemPage.UpdateIndices !== 'function' ) {
                    var achIndex = _this.FindAchievementsIndex( _this.CategoryList.entryList );
                    if ( achIndex !== -1 && event.index > achIndex ) {
                        event.index--;
                    }
                }

                _this.SystemPage.__onCategoryButtonPress(event);
            }
        }

    }

}