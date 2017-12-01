"use strict";
module.change_code = 1;


var alexa = require( 'alexa-app' );
var app = new alexa.app( 'my_friend' );
// server-side tools for processing
var sentiment_Analyser = require.main.require('./process/sAnalyse.js');
var entityClassifier = require.main.require('./process/entityTrain.js');


// A few default intents to be handled
app.launch( function( request, response ) {
	response.say( 'Your friend is here!' ).shouldEndSession( true );
} );

app.error = function( exception, request, response ) {
	console.log(exception)
	console.log(request);
	console.log(response);
	response.say( 'Sorry an error occured ');
};

// help messages
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

//  stop an intent
app.intent("AMAZON.StopIntent", function(request, response) {
    var stopOutput = "Come back later!";
		response.audioPlayerStop();
    response.say(stopOutput);
  }
);

// PAUSEINTENT is used to handle audio player interrupt
// should be able to stop audio player
app.intent("AMAZON.PauseIntent", function(request, response) {
    var stopOutput = "Paused it for you";
		response.audioPlayerStop();
    response.say(stopOutput);
  }
);

// Resume audio player status
app.intent("AMAZON.ResumeIntent", function(request, response) {
    var stopOutput = "It has not yet been implemented";
		//response.audioPlayerStop();
    response.say(stopOutput);
  }
);

// respond to "Nothing"
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

// TODO: For checking if the code is updated
app.intent("TestIntent",
	function(request,response){
		response.say("Greetings from Jarvis. Current version is beta one point two");
	}
);

app.intent("GreetingIntent",
	function(request,response){
		response.say("Greetings from Jarvis. System is standing by.");
	}
);


// TODO:
app.intent("WelcomeMusicIntent", {},
  function(request,response) {
		// Get user's
    response.say("Here's some welcoming music!");
		// TODO:
		// Fetch for user's favourite song lately
		// put into the song variable
		var song="floating.mp3";

		// encoded the link for the song
		var url = "https://evening-savannah-89199.herokuapp.com/music/"+song;
		var stream={
			"token": "90",
			"url": url,
			"offsetInMilliseconds": 0
		}
		console.log("playing: "+url);
		// Start the play directive
		response.audioPlayerPlayStream("REPLACE_ALL", stream)
  }
);

// TODO: Handle the player object
// Play music
app.intent("MusicIntent", {
    "slots": {
      "MusicType": "AMAZON.Genre",
      "Musician": "AMAZON.Musician"
    }
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
// ShareIntent is a wrapper that redirects the user to specific intents for handling different topics
// Redirects to:
// ShareMusicIntent (For music related)
// ShareMovieIntent (For movies related)
// ShareWorkIntent  (For work related)
// ... others are work in process
app.intent("ShareIntent",{
		"slots":{
			"userInfo": "UserInfo",
			"subject": "Subject"
		}
	},function(request, response) {
			var subject = request.slot('subject');
			if(subject==null){
				var dialog = [{
						"type": "Dialog.ElicitSlot",
						"slotToElicit": "subject",
				}];
				var clarify = "What would you like to talk about?";
				var reprompt = "What is it about?";
				response.response.response.directives=dialog;
		    // AMAZON.HelpIntent must leave session open -> .shouldEndSession(false)
		    response.say(clarify).reprompt(reprompt).shouldEndSession(false);
			}else{
				var content = JSON.stringify(request);
				var slot = request.data.request.intent.slots.subject;
				var id = slot.resolutions.resolutionsPerAuthority[].values[].value.id;
				content = JSON.stringify(slot);
				//var status = request.data.request.intent.slots.subject.resolutions.resolutionsPerAuthority.values.value.id;
				response.card({
					type:"Simple",
					title:"triggered",
					content: slot
				});
				if(status==="MUSIC")
				{
					var directive=[{"updatedIntent": {
				    "name": "ShareMusicIntent"
				  }
				}];
				response.response.response.directives=directive;
				response.shouldEndSession(false);
				}
			}
	}
);

app.intent("ShareMusicIntent", {
    "slots": {
      "songName": "AMAZON.MusicRecording",
      "musicGenre": "AMAZON.Genre",
			"musician": "AMAZON.MusicGroup",
			"preference": "PreferencePhrase"
    }
  }
  ,
  function(request,response) {
		// testing slot values
		var song = request.slot('songName'); 	//    3
    var genre = request.slot('musicGenre'); //  5
		var musician = request.slot('musician'); // 7
		var preference=request.slot('preference');

		// Get the dialogState (DONE)
		var dialogState = request.data.request.dialogState;
		if(dialogState==null||dialogState!="COMPLETED"){
			var check=checkMusicSlots(song,genre,musician);
			if(check==0){
				response.say("Go on");
				response.shouldEndSession(false);
			}
			if(check==3){
				//console.log(request.directive());
				var dialog = [{
						"type": "Dialog.ElicitSlot",
						"slotToElicit": "genre",
				}];
				// TODO: Set the custom directives
				response.response.response.directives=dialog;
				console.log(response.response.response.directives);
				console.log(response);
				var result=entityClassifier.classify(song);
				console.log(result);
				var content = "Classifier got =>"+result;
				response.shouldEndSession(false);
				var speech="Isn't that a "+result+" song?";
				response.say(speech);
				response.card({
					type:"Simple",
					title:"Got song name",
					content: content
				});
			}
			if(check==5){
				// got the genre
				var dialog = [{
						"type": "Dialog.ElicitSlot",
						"slotToElicit": "preference",
				}];
				// TODO: Set the custom directives
				response.response.response.directives=dialog;
				console.log(response.response.response.directives);
				console.log(response);
				response.shouldEndSession(false);
				var speech="Do you like"+genre+" music?";
				response.say(speech);
				var content="song: "+song+"\ngenre: "+genre+"\nmusician: "+musician;
				response.card({
					type:"Simple",
					title:"Got Genre",
					content: content
				});
			}
			if(check==7){
				// got the musician
				var dialog = [{
						"type": "Dialog.ElicitSlot",
						"slotToElicit": "preference",
				}];
				var speech="Do you like them?";
				response.shouldEndSession(false);
				var content="song: "+song+"\ngenre: "+genre+"\nmusician: "+musician;
				response.card({
					type:"Simple",
					title:"Got Genre",
					content: content
				});
			}
			if(check>=8){
				// got multiple slots
				if(preference!=null){
					var score = sentiment_Analyser.getScore(preference);
					var sentiment="";
					if(score>0)
						sentiment="like";
					else {
						sentiment="don't like"
					}
					var speech="I know that you"+sentiment+"it";
					response.say(speech);
					response.shouldEndSession(true);
				}else{
					var dialog = [{
							"type": "Dialog.ElicitSlot",
							"slotToElicit": "preference",
					}];
					response.response.response.directives=dialog;
					response.shouldEndSession(false);
					var speech="Do you like it?";
					response.say(speech);
				}
				var content="song: "+song+"\ngenre: "+genre+"\nmusician: "+musician;
				response.card({
					type:"Simple",
					title:"Got Genre",
					content: content
				});
			}

		}else {
			var content="song= "+song+"\nGenre: "+genre+"\nmusician:"+musician;
				response.card({
					type:"Simple",
					title:"Intent end",
					content: content
				});
				response.say("Thanks for sharing, ");
		}
	}
);

/* Template for ElicitSlot directive
{
  "version": "1.0",
  "sessionAttributes": {},
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "From where did you want to start your trip?"
    },
    "shouldEndSession": false,
    "directives": [
      {
        "type": "Dialog.ElicitSlot",
        "slotToElicit": "fromCity",
      }
    ]
  }
}
*/
// TODO: Testing intent to work with dialog
app.intent("DialogTestIntent", {
		"dialog":{
			type:"delegate"
		},
    "slots": {
      "animal": "AMAZON.Animal",
      "music_genre": "AMAZON.Genre",
			"general_info": "UserInfo"
    }
  }
  ,
  function(request,response) {
		// testing slot values
		var animal = request.slot('animal');
    var music_genre = request.slot('music_genre');
		var general_info = request.slot('UserInfo');

		// TODO To get the dialogState (DONE)
		var dialogState = request.data.request.dialogState;
		if(dialogState==null||dialogState!="COMPLETED"){
			console.log(request.type());
			console.log(request.directive);
			//console.log(request.directive());
			var dialog = [{
					  "type": "Dialog.Delegate"
			}];
			// TODO: Set the custom directives
			response.response.response.directives=dialog;
			console.log(response.response.response.directives);
			console.log(response);
			response.shouldEndSession(false);
			var content="State= "+dialogState;
			response.card({
				type:"Simple",
				title:"TestDialogIntent",
				content: content
			});

		}else {
					response.say("Outputs are, "+music_genre+animal+" with final message:"+general_info);
		}
	}
);

// TODO: utility function
// Checking music slots, the sum of values represent which slots are present
function checkMusicSlots(song,genre,musician){
	var check=0;
	if(song!=null)
		check+=3;
	if(genre!=null)
		check+=5;
	if(musician!=null)
		check+=7;
	return check;
}
module.exports = app;
