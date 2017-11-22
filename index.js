"use strict";
module.change_code = 1;


var alexa = require( 'alexa-app' );
var app = new alexa.app( 'my_friend' );


// A few default intents to be handled
app.launch( function( request, response ) {
	response.say( 'Your friend is here!' ).shouldEndSession( true );
} );

app.error = function( exception, request, response ) {
	console.log(exception)
	console.log(request);
	console.log(response);
	response.say( 'Sorry an error occured ' + error.message);
};

app.intent("AMAZON.HelpIntent", {
    "slots": {},
    "utterances": []
  },
  function(request, response) {
    var helpOutput = "You can say 'some statement' or ask 'some question'. You can also say stop or exit to quit.";
    var reprompt = "What would you like to do?";
    // AMAZON.HelpIntent must leave session open -> .shouldEndSession(false)
    response.say(helpOutput).reprompt(reprompt).shouldEndSession(false);
  }
);

app.intent("AMAZON.StopIntent", {
    "slots": {},
    "utterances": []
  }, function(request, response) {
    var stopOutput = "Don't You Worry. I'll be back.";
    response.say(stopOutput);
  }
);

app.intent("AMAZON.CancelIntent", {
    "slots": {},
    "utterances": []
  }, function(request, response) {
    var cancelOutput = "No problem. Request cancelled.";
    response.say(cancelOutput);
  }
);

// Custom Intents start below VVVVVVVVVVVVVVVVVVVVVVVVVVVVVV

// First line is Intent's name

// Play welcome home music

app.intent("GreetingIntent",
	function(request,response){
		response.say("Greetings from Your Friend. Your skill is ready.");
	});
// Testing, hard coded playng music
app.intent("WelcomeMusicIntent", {
  // Try specifying nothing
  /*
    "slots": {
      "searchPhrase": "SearchItem"
    },
    "utterances": [
      "find {-|searchPhrase}",
  		"Google about {-|searchPhrase}",
  		"tell me about {-|searchPhrase}",
  		"I want to know about {-|searchPhrase}"
    ]
    */
  },
  function(request,response) {
		// Get user's
    response.say("Here's some welcoming music!");
		var stream={
			"token": "90",
			"url": "https://evening-savannah-89199.herokuapp.com/music/zensai.mp3",
			"offsetInMilliseconds": 0
		}
		response.audioPlayerPlayStream("REPLACE_ALL", stream)
  }
);

// Play music
app.intent("MusicIntent", {
    "slots": {
      "MusicType": "AMAZON.Genre",
      "Musician": "AMAZON.Musician"
    }
    /*,
    // try leaving the utterances null as it is stated on Skill kit

    "utterances": [
      "find {-|searchPhrase}",
  		"Google about {-|searchPhrase}",
  		"tell me about {-|searchPhrase}",
  		"I want to know about {-|searchPhrase}"
    ]
    */
  }
  ,
  function(request,response) {
    var musicType = request.slot('MusicType');
    var musician = request.slot('Musician');
    if(musicType==null)
      console.log("No music type specified");
    if(musician==null)
      console.log("Nomusician specified");
    response.say("You wanna play some "+ musicType+" music by artist:["+musician+"]");
  }
);

// Intent that train your friend to know more about you
app.intent("ShareIntent",{
	slots:{
		"userInfo": "UserInfo"
	}

},
	  function(request, response) {
			// update the status of the dialog model
			var dialogState=request.dialogState;
			console.log(dialogState);
			console.log("Get passed");

			if(dialogState=="STARTED"){
				var directive={
				  "type": "Dialog.Delegate",
				  "updatedIntent": {
				    "name": "ShareIntent",
				    "confirmationStatus": "NONE",
				    "slots": {
				      "string": {
				        "name": "string",
				        "value": "string",
				        "confirmationStatus": "NONE"
				      }
				    }
				  }
				}
				response.directive(directive);
			}else{
				response.card({
					type:"Simple",
					title:"Starting a Dialog",
					content: "The card should be shown, and dialog starts"
				});
				response.say("Tell me.");
			}
			//response.directive(directive);
			/*
			// return the Dialog object
Dialog request.getDialog()

// return the intent's dialogState
String request.dialogState

// check if the intent's dialog is STARTED
Boolean dialog.isStarted()

// check if the intent's dialog is IN_PROGRESS
Boolean dialog.isInProgress()

// check if the intent's dialog is COMPLETED
Boolean dialog.isCompleted()

*/

		}
	);


module.exports = app;
