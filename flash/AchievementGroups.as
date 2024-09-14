class AchievementGroups extends MovieClip {

    public var GroupsMask_mc:MovieClip;
    public var groupHolder_mc:MovieClip;
    public var EventCatcher_mc:MovieClip;

    public var ItemHeight:Number = 55;
    public var ScrollSpeed:Number = 5;

    function onLoad() {
        EventCatcher_mc.onRollOver = function() {
            _parent._parent.isFocusOnGroups = true;
        }
        EventCatcher_mc.onRollOut = function() {
            _parent._parent.isFocusOnGroups = false;
        }
    }

    function showGroups(data:Array) {
        var y = 0;
        for ( var i = 0; i < data.length; i++ ) {
            var mc = groupHolder_mc.attachMovie('AchievementGroup', 'AchievementGroup_' + i, groupHolder_mc.getNextHighestDepth());
            mc.setData( i, data[ i ].groupName, data[ i ].image, _parent );
            mc._y = y;
            y += ItemHeight;
        }
    }

    function getClipIndex(index:Number) {
        return groupHolder_mc[ 'AchievementGroup_' + index ];
    }

    function setFocusTo(index:Number) {
        var mc:MovieClip = getClipIndex( index );
        if ( mc ) {
            Selection.setFocus( mc );
            var newY = ( mc._y + mc._height ) - GroupsMask_mc._height;
            if ( newY < 0 ) {
                newY = 0;
            }
            groupHolder_mc._y = newY * -1;
        }
    }

    function onMouseWheelCallback(delta:Number) {
        if ( groupHolder_mc._height > GroupsMask_mc._height ) {
            delta *= ScrollSpeed;
            groupHolder_mc._y = AchievementUtils.clampValue( groupHolder_mc._y + delta, ( groupHolder_mc._height - GroupsMask_mc._height ) * -1, 0 );
        }
    }
}