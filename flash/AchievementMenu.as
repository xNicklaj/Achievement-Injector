import JSON;
import skse;
import AchievementUtils;
import Components.CrossPlatformButtons;

class AchievementMenu extends MovieClip {

    /* stage elements */
    public var heading_tf:TextField;
    public var progress_tf:TextField;
    public var AchievementGroups_mc:MovieClip;
    public var AchievementList_mc:MovieClip;
    public var BottomBar_mc:MovieClip;

    private var data:Object;
    private var isFocusOnGroups:Boolean = true;
    private var focusIndex:Number = -1;
    private var mouseListener:Object;
    private var currentGroupIndex:Number = 0;
	
	private var useJsonDecoding:Boolean = false; // ONLY ENABLE FOR DEBUG

    function onLoad(): Void {
        BottomBar_mc = _root.BottomBar_mc;
        Key.addListener(this);
        setupMouseListener();
        Selection["alwaysEnableArrowKeys"] = false;
        heading_tf.noTranslate = progress_tf.noTranslate = true;
    }

    function setupMouseListener() {
        mouseListener = new Object();
        var _this = this;
        mouseListener.onMouseWheel = function( delta ) {
            _this.onMouseWheelCallback( delta );
        }
        Mouse.addListener(mouseListener);
    }

    function onMouseWheelCallback( delta ) {
        if ( isFocusOnGroups ) {
            AchievementGroups_mc.onMouseWheelCallback(delta);
        } else {
            AchievementList_mc.onMouseWheelCallback(delta);
        }
    }

	function InitExtensions(): Void {
        skse.SendModEvent( 'AchievementMenu_Init', '', 0, 0 ); /* signal we're ready to load */
	}

	function SetPlatform(aiPlatformIndex: Number, abPS3Switch: Boolean): Void {
        isFocusOnGroups = aiPlatformIndex != 0 ? true : false;
        var BackButtonInstance:CrossPlatformButtons = BottomBar_mc.ButtonRect.BackButtonInstance;
        BackButtonInstance.SetPlatform(aiPlatformIndex, abPS3Switch);
        var UpDownInstance:CrossPlatformButtons = BottomBar_mc.ButtonRect.UpDownInstance;
        UpDownInstance.SetPlatform(aiPlatformIndex, abPS3Switch);
        var RightInstance:CrossPlatformButtons = BottomBar_mc.ButtonRect.RightInstance;
        RightInstance.SetPlatform(aiPlatformIndex, abPS3Switch);
        var LeftInstance:CrossPlatformButtons = BottomBar_mc.ButtonRect.LeftInstance;
        LeftInstance.SetPlatform(aiPlatformIndex, abPS3Switch);
    }

    function render() {
        AchievementGroups_mc.showGroups(data);
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
            if ( AchievementGroups_mc.getClipIndex( nextIndex ) ) {
                AchievementGroups_mc.setFocusTo( nextIndex );
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
                AchievementGroups_mc.setFocusTo(0);
            }
        } else if ( Key.getCode() === 39 ) { // right
            if ( isFocusOnGroups ) {
                isFocusOnGroups = false;
                focusIndex = 0;
                AchievementList_mc.setFocusTo(0);
            }
        } else if ( Key.getCode() === 13 ) { // Activate
            var mc;
            if ( isFocusOnGroups && ( mc = AchievementGroups_mc.getClipIndex( focusIndex ) ) ) {
                mc.onRelease();
            }
        }
    }

    // @api
    function setData( dataString:String ) {
		if(this.useJsonDecoding) {
			// OLD SYSTEM, DO NOT ENABLE
			var decodedData = JSON.parse( dataString );
			data = decodedData;
		} else {
			var decodedData:Array = []
			// Split the input into lines
			var lines:Array = dataString.split("\n");
			
			var groupCount:Number = parseInt(lines[0]); // First line gives us the number of groups
			
			// Process groups and store in `data` as an Object
			for (var i:Number = 1; i <= groupCount; i++) {
				var groupLine:Array = lines[i].split("||");
				var groupId:String = groupLine[0];
				var newObject:Object = {
					image: groupLine[2],
					groupName: groupLine[1],
					AchievementData: [],
					groupId: groupId
				};
				
				// Process achievements
				for (var j:Number = groupCount + 1; j < lines.length; j++) {
					var achievementLine:Array = lines[j].split("||");
					var groupId:String = achievementLine[0];
					if(groupId != newObject.groupId) continue;
					if (newObject != undefined) {
						var achievement:Object = {
							Unlocked: parseInt(achievementLine[3]) > 0,
							UnlockDatetime: parseInt(achievementLine[3]),
							Icon: achievementLine[4],
							Description: achievementLine[2],
							AchievementName: achievementLine[1]
						};
						newObject.AchievementData.push(achievement);
					}
				}
				decodedData.push(newObject);
			}
			data = decodedData;
		}
        render();
        _parent.play();
    }
}