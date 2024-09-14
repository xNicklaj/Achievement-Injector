class AchievementUtils {

    public static var i18nCache:Object = new Object();

    static function get_i18n( lookup:String ) {
        if ( AchievementUtils.i18nCache[ lookup ] === undefined ) {
            var tf = _root.createTextField( 'temp', _root.getNextHighestDepth(), -100, -100, 0, 0 );
            tf.text = lookup;
            AchievementUtils.i18nCache[ lookup ] = tf.text;
            tf.removeTextField();
        }

        return AchievementUtils.i18nCache[ lookup ];
    }

    public static function str_replace( search, replace, subject ) {
        var temp = '';
        var searchIndex = -1;
        var startIndex = 0;

        while ((searchIndex = subject.indexOf(search, startIndex)) != -1) {
            temp += subject.substring(startIndex, searchIndex);
            temp += replace;
            startIndex = searchIndex + search.length;
        }

        return temp + subject.substring(startIndex);
    }

    public static function setText( input:TextField, text:String ) {
        var textFormat:TextFormat = input.getTextFormat();
        textFormat.font = '$EverywhereMediumFont';
        input.text = text;
        input.setTextFormat( textFormat );
    }

    public static function clampValue(a_val: Number, a_min: Number, a_max: Number): Number {
        return Math.min(a_max, Math.max(a_min, a_val));
    }
}