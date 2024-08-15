

class AchievementMenu extends MovieClip
{
	#include "../version.as"
	
  /* CONSTANTS */
	
	static var HIDE_PANEL = 0;
	static var SHOW_PANEL = 1;
	static var TRANSITIONING_TO_HIDE_PANEL = 2;
	static var TRANSITIONING_TO_SHOW_PANEL = 3;
	
	
  /* STAGE ELEMENTS */
  
	public var categoryLabel;
	public var itemList;
	public var searchWidget;


  /* PRIVATE VARIABLES */

	
	

  /* PROPERTIES */

	


  /* INITIALIZATION */
	function getAllAchievements(){
		var path = "../AchievementsData/";
		var files = fscommand("GetFiles", path);
	}
	
	
	
  /* PUBLIC FUNCTIONS */

	
	
	
  /* PRIVATE FUNCTIONS */
  
  	
}