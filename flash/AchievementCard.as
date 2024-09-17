class AchievementCard extends MovieClip {

    public var title_tf:TextField;
    public var date_tf:TextField;
    public var desc_tf:TextField;
    public var highlight_mc:MovieClip;

    private var sidePadding:Number = 5;

    function onLoad(): Void {
        highlight_mc._visible = false;
        date_tf.noTranslate = desc_tf.noTranslate = true;
    }

    function setData( data:Object ) {
        AchievementUtils.setText( title_tf, data.AchievementName );
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
        } else {
            AchievementUtils.setText( date_tf, '$ACH_LOCKED' );
        }
        desc_tf.autoSize = 'left';
        desc_tf.multiline = true;
        desc_tf.wordWrap = true;
        AchievementUtils.setText( desc_tf, data.Description );
        drawHghlight();
    }

    function drawHghlight() {
        highlight_mc.lineStyle(1, 0xffffff, 70);
        highlight_mc.lineTo( _width + sidePadding, 0);
        highlight_mc.lineTo( _width + sidePadding, _height + sidePadding );
        highlight_mc.lineTo( 0, _height + sidePadding );
        highlight_mc.lineTo(0, 0);
    }

    function onRelease() {
    }

    function onSetFocus() {
        highlight_mc._visible = true;
    }

    function onKillFocus() {
        highlight_mc._visible = false;
    }
}