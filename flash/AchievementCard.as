class AchievementCard extends MovieClip {

    public var title_tf:TextField;
    public var date_tf:TextField;
    public var highlight_mc:MovieClip;
    public var Lock_mc:MovieClip;
    public var Unlock_mc:MovieClip;
    public var UnlockHighlight_mc:MovieClip;
    public var UnlockBg_mc:MovieClip;
    public var desc_tf:TextField;
    public var imagePlaceholder_mc:MovieClip;

    private var sidePadding:Number = 5;
    private var data:Object;

    function onLoad(): Void {
        highlight_mc._visible = false;
        date_tf.noTranslate = desc_tf.noTranslate = true;
    }

    function setData( a_data:Object ) {
        data = a_data;
        Unlock_mc._visible = Lock_mc._visible = date_tf._visible = UnlockHighlight_mc._visible = UnlockBg_mc._visible = imagePlaceholder_mc._visible = false;
        if ( data.Icon !== '' ) {
            imagePlaceholder_mc.loadMovie( data.Icon );
            imagePlaceholder_mc._visible = true;
            title_tf._x += 55;
            desc_tf._x += 55;
            title_tf._width -= 55;
            desc_tf._width -= 55;
        }
        title_tf.autoSize = 'left';
        title_tf.multiline = true;
        title_tf.wordWrap = true;
        AchievementUtils.setText( title_tf, data.AchievementName );
        desc_tf._y = title_tf._y + title_tf._height;
        desc_tf.autoSize = 'left';
        desc_tf.multiline = true;
        desc_tf.wordWrap = true;
        AchievementUtils.setText( desc_tf, data.Description );
        drawHighlight();
        if ( data.Unlocked === true ) {
            var date:Date = new Date(data.UnlockDatetime),
                unlockText = AchievementUtils.get_i18n('$ACH_UNLOCK'),
                day = date.getDate(),
                hour = date.getHours(),
                minutes = date.getMinutes();
            if ( day < 10 ) {
                day = '0' + day.toString();
            }
            if ( hour < 10 ) {
                hour = '0' + hour.toString();
            }
            if ( minutes < 10 ) {
                minutes = '0' + minutes.toString();
            }
            unlockText = AchievementUtils.str_replace( '<month>', AchievementUtils.get_i18n( '$ACH_MONTH' + date.getMonth() ), unlockText );
            unlockText = AchievementUtils.str_replace( '<day>', day, unlockText );
            unlockText = AchievementUtils.str_replace( '<year>', date.getFullYear(), unlockText );
            unlockText = AchievementUtils.str_replace( '<hour>', hour, unlockText );
            unlockText = AchievementUtils.str_replace( '<minute>', minutes, unlockText );
            date_tf.autoSize = 'right';
            AchievementUtils.setText( date_tf, unlockText );
            Unlock_mc._visible = true;
            UnlockBg_mc._x = date_tf._x - sidePadding;
            UnlockBg_mc.beginFill(0xffffff);
            var w = ( UnlockHighlight_mc._x + UnlockHighlight_mc._width + sidePadding ) - date_tf._x;
            drawRectangle(UnlockBg_mc, w, date_tf._height + sidePadding, 5);
            UnlockBg_mc.endFill();
        } else {
            // AchievementUtils.setText( date_tf, '$ACH_LOCKED' );
            Lock_mc._visible = true;
        }
    }

    function drawHighlight() {
        highlight_mc.lineStyle(1, 0xffffff, 70);
        highlight_mc.lineTo( _width + sidePadding, 0);
        highlight_mc.lineTo( _width + sidePadding, _height + sidePadding );
        highlight_mc.lineTo( 0, _height + sidePadding );
        highlight_mc.lineTo(0, 0);
    }

    function onRelease() {
        // dont' remove!
    }

    function maybeShowUnlock(a_show:Boolean) {
        var visible = a_show === true && data.Unlocked === true;
        date_tf._visible = visible;
        UnlockBg_mc._visible = visible;
        UnlockHighlight_mc._visible = visible;
    }

    function onRollOver() {
        maybeShowUnlock(true);
    }

    function onRollOut() {
        maybeShowUnlock(false);
    }

    function onSetFocus() {
        maybeShowUnlock(true);
        highlight_mc._visible = true;
    }

    function onKillFocus() {
        highlight_mc._visible = false;
        maybeShowUnlock(false);
    }

    function drawRectangle(mc:MovieClip, width, height, round) {
        if (round > width / 2) round = width / 2;
        if (round > height / 2) round = height / 2;

        mc.moveTo(round, 0);

        mc.lineTo(width - round, 0);
        mc.curveTo(width, 0, width, round);

        mc.lineTo(width, height - round);
        mc.curveTo(width, height, width - round, height);

        mc.lineTo(round, height);
        mc.curveTo(0, height, 0, height - round);

        mc.lineTo(0, round);
        mc.curveTo(0, 0, round, 0);
    }
}