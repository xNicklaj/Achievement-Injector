class AchievementGroup extends MovieClip {

    public var title_tf:TextField;
    public var highlight_mc:MovieClip;
    public var imagePlaceholder_mc:MovieClip;

    private var index:Number;
    private var Menu_mc:MovieClip; /* ref to AchievementMenu */

    function onLoad() {
        title_tf.noTranslate = true;
        if ( index !== 0 ) {
            title_tf._visible = false;
            highlight_mc._visible = false;
            _alpha = 50;
        }
    }

    function setData( a_index:Number, title:String, imagePath:String, a_Menu_mc:MovieClip ) {
        title_tf.border = true;
        title_tf.border = true;
        title_tf.background = true;
        title_tf.backgroundColor = 0xffffff;
        title_tf.borderColor = 0xeeeeee;
        title_tf.autoSize = 'left';
        AchievementUtils.setText( title_tf, ' ' + title + ' ' );
        imagePlaceholder_mc.loadMovie( "../AchievementsData/Icons/" + imagePath );
        index = a_index;
        Menu_mc = a_Menu_mc;
    }

    function onRollOver() {
        highlight(true);
    }

    function onRollOut() {
        highlight(false);
    }

    function onSetFocus() {
        highlight(true);
    }

    function onKillFocus() {
        highlight(false);
    }

    function highlight(state:Boolean) {
        title_tf._visible = state;
        if ( state === false && Menu_mc.currentGroupIndex === index ) {
            return;
        }

        highlight_mc._visible = state;
        _alpha = state ? 100 : 50;
    }

    function onRelease() {
        Menu_mc.loadGroup( index );
        var prevIndex = Menu_mc.currentGroupIndex;
        Menu_mc.currentGroupIndex = index;
        _parent._parent.getClipIndex(prevIndex).highlight(false);
        highlight(true);
        title_tf._visible = false;
    }
}