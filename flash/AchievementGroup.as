class AchievementGroup extends MovieClip {

    public var title_tf:TextField;
    public var highlight_mc:MovieClip;
    public var imagePlaceholder_mc:MovieClip;

    private var index:Number;
    private var Menu_mc:MovieClip; /* ref to AchievementMenu */

    function onLoad() {
        title_tf.noTranslate = true;
        title_tf._visible = false;
        highlight_mc._visible = false;
    }

    function setData( a_index:Number, title:String, imagePath:String, a_Menu_mc:MovieClip ) {
        title_tf.border = false;
        title_tf.background = true;
        title_tf.backgroundColor = 0x000000;
        title_tf.autoSize = 'left';
        title_tf.text = title;
        imagePlaceholder_mc.loadMovie( "../AchievementsData/Icons/" + imagePath );
        index = a_index;
        Menu_mc = a_Menu_mc;
    }

    function onRollOver() {
        title_tf._visible = true;
        highlight_mc._visible = true;
    }

    function onRollOut() {
        title_tf._visible = false;
        highlight_mc._visible = false;
    }

    function onSetFocus() {
        title_tf._visible = true;
        highlight_mc._visible = true;
    }

    function onKillFocus() {
        title_tf._visible = false;
        highlight_mc._visible = false;
    }

    function onRelease() {
        Menu_mc.loadGroup( index );
    }
}