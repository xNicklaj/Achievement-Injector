﻿class AchievementList extends MovieClip {

    public var scrollbar:MovieClip;
    public var AchievementCardHolder_mc:MovieClip;
    public var ListMask_mc:MovieClip;

    private var list:Object;
    private var scrollEnabled:Boolean;
    private var maxScroll:Number;
    private var mouseListener:Object;
    private var currentIndex:Number;

    function onLoad(): Void {
        scrollbar.upArrow._visible = false;
        scrollbar.downArrow._visible = false;
        list = new Object();
        this.mouseListener = new Object();
        var _this = this;
        mouseListener.onMouseWheel = function( delta ) {
            _this.onMouseWheelCallback( delta );
        }
        Mouse.addListener(mouseListener);
        scrollbar.addEventListener("scroll", this, "onScroll");
    }

    function render(index:Number) {
        for ( var i in AchievementCardHolder_mc ) {
            if ( typeof AchievementCardHolder_mc[i] === 'movieclip' ) {
                AchievementCardHolder_mc[i]._visible = false;
            }
        }
        AchievementCardHolder_mc._y = 0;

        if ( list[ index ] === undefined ) {
            var data = _parent.getAchievements( index );
            var parent = AchievementCardHolder_mc.createEmptyMovieClip( 'holder_' + index, AchievementCardHolder_mc.getNextHighestDepth() );
            
            var yOffset:Number = 0;
            for ( var i = 0; i < data.length; i++ ) {
                var mc = parent.attachMovie('AchievementCard', 'AC_' + i, parent.getNextHighestDepth());
                mc.setData( data[ i ] );
                mc._y = yOffset;
                yOffset += mc._height;
            }

            list[ index ] = parent;
        }
        list[ index ]._visible = true;
        currentIndex = index;
        scrollEnabled = list[ index ]._height > ListMask_mc._height;

        scrollbar.thumb.visible = scrollEnabled;
        scrollbar.track.disabled = scrollEnabled;
        if ( scrollEnabled ) {
            scrollbar.position = 0;
            scrollbar.height = ListMask_mc._height + 25;
            maxScroll = list[ index ]._height - ListMask_mc._height;
            scrollbar.setScrollProperties( 0, 0, maxScroll );
        }
    }

    function onScroll(event: Object) {
        AchievementCardHolder_mc._y = event.position * -1;
    }

    function onMouseWheelCallback(delta) {
        if ( scrollEnabled ) {
            var value = AchievementCardHolder_mc._y + 15 * ( delta * 2 );
            value = clampValue( value, maxScroll * -1, 0 );
            scrollbar.position = value * -1;
        }
    }

    function clampValue(a_val: Number, a_min: Number, a_max: Number): Number {
        return Math.min(a_max, Math.max(a_min, a_val));
    }

    function setFocusTo(index:Number) {
        var mc = getClipIndex(index);
        if ( mc ) {
            Selection.setFocus( mc );
            
            if ( scrollEnabled ) {
                scrollbar.position = mc._height * index;
            }
        }
    }

    function getClipIndex(index:Number) {
        return AchievementCardHolder_mc[ 'holder_' + currentIndex ][ 'AC_' + index ];
    }
}