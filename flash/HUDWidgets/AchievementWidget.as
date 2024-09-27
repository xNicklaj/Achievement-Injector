import gfx.io.GameDelegate;
import gfx.managers.FocusHandler;

class AchievementWidget extends MovieClip
{	
  /* STAGE ELEMENTS */
  
    #include "../version.as"
  
  	var WidgetClip:MovieClip;
	var achievementName;
	var achievementDescription;
	var initialW;
	var initialH;
  
  
  /* INITIALIZATION */

	public function AchievementWidget()
	{
		super();
		FocusHandler.instance.setFocus(this,0);
		
		this.achievementName = "Initial";
		this.achievementDescription = "Initial";
		
		this.initialW = this._width;
		this.initialH = this._height;
		
		this._visible = true;
		this.gotoAndStop("widgetHidden");
	}


  /* PUBLIC FUNCTIONS */
  
	// @overrides WidgetBase
	function getWidth()
	{
		return this._width;
	}
	function getHeight()
	{
		return this._height;
	}
	function setVisible(a_visible)
	{
		this._visible = a_visible;
	}
	function setPosition(a_x, a_y)
	{
		this._x = a_x;
		this._y = a_y;
	}
	function setYPosition(a_y)
	{
		this._y = a_y;
	}
	function setScale(a_scale:Number)
	{
		this._width = this.initialW * a_scale;
		this._height = this.initialH * a_scale;
	}
	
	// @Papyrus
	public function setName(a_name: String): Void
	{
		achievementName = a_name;
	}
	
	public function setDescription(a_description: String): Void
	{
		achievementDescription = a_description;
	}
	
	function ShowNotification(a_show)
	{
		if (a_show == true)
		{
			GameDelegate.call("PlaySound",["UISkillIncreaseSD"]);
			this.gotoAndPlay("widgetShow");
		}
		else
		{
			//GameDelegate.call("PlaySound",["UIMenuBladeCloseSD"]);
			this.gotoAndPlay("widgetHide");
		}
	}
	
}