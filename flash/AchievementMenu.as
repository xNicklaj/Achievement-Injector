import JSON;
import skse;
import AchievementUtils;
import Components.CrossPlatformButtons;

class AchievementMenu extends MovieClip {

    /* stage elements */
    public var groupHolder_mc:MovieClip;
    public var heading_tf:TextField;
    public var progress_tf:TextField;
    public var AchievementList_mc:MovieClip;
    public var BottomBar_mc:MovieClip;

    private var data:Object;
    private var isFocusOnGroups:Boolean = true;
    private var focusIndex:Number = -1;

    function onLoad(): Void {
        BottomBar_mc = _root.BottomBar_mc;
        Key.addListener(this);
        Selection["alwaysEnableArrowKeys"] = false;
        heading_tf.noTranslate = progress_tf.noTranslate = true;
		skse.SendModEvent( 'AchievementMenu_Init' )
    }

	function InitExtensions(): Void {
        skse.SendModEvent( 'AchievementMenu_Init', '', 0, 0 ); /* signal we're ready to load */
	}

	function SetPlatform(aiPlatformIndex: Number, abPS3Switch: Boolean): Void {
        var BackButtonInstance:CrossPlatformButtons = BottomBar_mc.ButtonRect.BackButtonInstance;
        BackButtonInstance.SetPlatform(aiPlatformIndex, abPS3Switch);
        var MoveColumnInstance:CrossPlatformButtons = BottomBar_mc.ButtonRect.MoveColumnInstance;
        MoveColumnInstance.SetPlatform(aiPlatformIndex, abPS3Switch);
    }

    function render() {
        var y = 0;
        for ( var i = 0; i < data.length; i++ ) {
            var mc = groupHolder_mc.attachMovie('AchievementGroup', 'AchievementGroup_' + i, groupHolder_mc.getNextHighestDepth());
            mc.setData( i, data[ i ].groupName, data[ i ].image, this );
            mc._y = y;
            y += 55;
        }

        loadGroup(0);
    }

    function loadGroup(index) {
        AchievementUtils.setText( heading_tf, data[ index ].groupName );
        AchievementList_mc.render( index );
        calculateProgress( index );
    }

    function calculateProgress(groupIndex:Number) {
        var completed:Number = 0;
        var achievements = data[ groupIndex ].AchievementData;
        for ( var i = 0; i < achievements.length; i++ ) {
            if ( achievements[ i ].Unlocked === true ) {
                completed++;
            }
        }
        var percent = Math.ceil( ( completed / achievements.length ) * 100 ),
            progressText = AchievementUtils.get_i18n( '$ACH_PROGRESS' );
        progressText = AchievementUtils.str_replace( '<completed>', completed, progressText );
        progressText = AchievementUtils.str_replace( '<all>', achievements.length, progressText );
        progressText = AchievementUtils.str_replace( '<percent>', percent, progressText );
        AchievementUtils.setText( progress_tf, progressText );
    }

    function getAchievements( index:Number ) {
        return data[ index ].AchievementData;
    }

    function closeMenu() {
        skse.SendModEvent( 'AchievementMenu_Close', '', 0, 0 );
    }

    function setFocusTo(nextIndex:Number) {
        if ( isFocusOnGroups ) {
            if ( groupHolder_mc['AchievementGroup_' + nextIndex ] ) {
                Selection.setFocus( groupHolder_mc['AchievementGroup_' + nextIndex ] );
                focusIndex = nextIndex;
            }
        } else {
            if ( AchievementList_mc.getClipIndex( nextIndex ) ) {
                AchievementList_mc.setFocusTo( nextIndex );
                focusIndex = nextIndex;
            }
        }
    }

    function onKeyDown() {
        if ( Key.getCode() === 9 ) {
            _parent.play();
        } else if ( Key.getCode() === 38 ) { // up
            setFocusTo( focusIndex - 1 )
        } else if ( Key.getCode() === 40 ) { // down
            setFocusTo( focusIndex + 1 )
        } else if ( Key.getCode() === 37 ) { // left
            if ( ! isFocusOnGroups ) {
                isFocusOnGroups = true;
                focusIndex = 0;
                Selection.setFocus(groupHolder_mc['AchievementGroup_' + 0]);
            }
        } else if ( Key.getCode() === 39 ) { // right
            if ( isFocusOnGroups ) {
                isFocusOnGroups = false;
                focusIndex = 0;
                AchievementList_mc.setFocusTo(0);
            }
        } else if ( Key.getCode() === 13 ) { // Activate
            if ( isFocusOnGroups && groupHolder_mc['AchievementGroup_' + focusIndex ] ) {
                groupHolder_mc['AchievementGroup_' + focusIndex ].onRelease();
            }
        }
    }

    // @api
    function setData( dataString:String ) {
        var decodedData = JSON.parse( dataString );
        data = decodedData;
        render();
        _parent.play();
    }
}