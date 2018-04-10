"use strict";
module.change_code = 1;


var alexa = require( 'alexa-app' );
var app = new alexa.app( 'my_friend' );
// 4-4-2018 Added Express for routing
var express = require("express");

var express_app = express();

// TODO Try adding auth middleware
/*
express_app.use('*',oauth2.required, (req, res, next) => {
  console.log("Middleware check\n");
});
*/

// setup the alexa app and attach it to express before anything else
app.express({ expressApp: express_app });

// server-side tools for processing
var sentiment_Analyser = require.main.require('./process/sAnalyse.js');
var entityClassifier = require.main.require('./process/entityTrain.js');
var database = require.main.require('./db/database.js');
// For accessing db model
var model = require.main.require('./db/model.js');

// For making API call to Dialogflow
// Client token: da9e1b70742a4272ac020ae9d87d6f35
// Dev Access token: df95f94d49a54fbe98b020434cc95438
var request= require.main.require('request');

// For constructing ssml
var AmazonSpeech = require('ssml-builder/amazon_speech');

// 13-3-2018
// Dummy counter for daily dialog check
var daily_count=0;
var session_sentiment=0;

app.error = function( exception, request, response ) {
	console.log(exception)
	console.log(request);
	console.log(response);
	response.say( 'Sorry, an error occured ');
	var content = exception;
	response.card({
		type:"Simple",
		title:"Error",
		content: content
	});
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
		response.shouldEndSession(true);
  }
);

// wrapper for async usage of request
function doRequest(url) {
  return new Promise(function (resolve, reject) {
    request(url, function (error, res, body) {
      if (!error && res.statusCode == 200) {
				console.log("[doRequest]res received");
        resolve(body);
      } else {
				console.log("Status code:"+res.statusCode);
				console.log("[doRequest]rejected, error=>"+error);
        reject(error);
      }
    });
  });
}

// Check if user exists in DB
async function validateUser(accessToken){
	let result = await model.findUser(accessToken);
	return result;
}

// A few default intents to be handled
app.launch( async function( request, response ) {
	// TODO: Test using request.getSession
	var session;
	var accessToken;
	if(request.getSession()!=null){
		session = request.getSession();
		// Better way to get session variables
		accessToken = session.get("accessToken");
		console.log("Get session function returns: "+accessToken);
	}

	console.log("***[app.lauch]started");

	if(accessToken==null){
		console.log("no access token");
		// 5-4-2018
		// Account linking with Google
		response.linkAccount();
		response.say("Please login with your Google account first.");
		return;
	}
	// Check the whole requestType
	//console.log("LOGGING FULL request");
	//console.log(request);

	// TODO: Now we have an authentidated Google users
	// DO te followin
	// 1. validate user in DB (use access token)
	let result= await validateUser(accessToken);
	if(result!=null){
		console.log("user exists in db");
		// Proceed with user
	}else{
		// This section should not be invoked
		console.log("user not in DB yet, create new record and do init dialogs");
		let result = await model.addUser("dummy",accessToken);
		console.log(result);
	}
  // 2. check user daily status
	// 2.1 Look for today's record

	var options;
	// **TODO Check count from DB
	// **TODO Get user account type
	// *** For current testing, assume all users are elderly
	var e_name="daily_elder_init";
	// TODO set session id with accesstoken
	var sessionID="12345";
	// TODO get user name from db
	// Tried encoding user info in context variable
	var user_context={
    "lifespan": 3,
    "name": "user_info",
    "parameters": {
      "usr_name": "Peter"
    }
  };

	if(daily_count==0){
		console.log("Daily starts");
		// Send API call with daily_init_event
	}else{
		// Pass to CatchAll
		console.log("Non Daily greetings");
		daily_count=0;
	}


	// options
	options = {
		headers: {"Authorization": "Bearer d25cbadf552a43eba0ed4d4905e98858"},
			url: 'https://api.dialogflow.com/v1/query?v=20150910',
			method: 'POST',
			json:true,
			body: {
				"contexts":[user_context],
				"lang": "en",
				"sessionId": sessionID,
				// init event, empty query
				"event":{"name": e_name}
			}
	};
	// aync API call
	try{
		console.log("Sending request");
		let res = await doRequest(options);
		console.log("response result=>\n");
		console.log(res.result.fulfillment);
		var resSpeech = res.result.fulfillment.speech;
		// Output contexts
		// Store it to request Session object to persist the value
		var contexts = res.result.contexts;
		// TODO Try setting session with array
		session.set("contexts",contexts);
		console.log(session);
		// TODO:
		// Function to check certain values within context
		// Perform reactions e.g. Music streaming
		response.say(resSpeech);
		response.shouldEndSession(false);
		daily_count++;
	}catch(err){
		console.log("Error =>"+err);
		response.say("Sorry there was an error, please try again later");
		return;
	}
} );

// 6-2-2018 updated
// Testing with "CatchAll" intent
app.intent("CatchAllIntent", {
    "slots": {
      "speech": "CatchAll"
    }
  }
  ,
  async function(request,response) {
		// Get session context
		var session = request.getSession();
		var context_array=session.get("contexts");
		console.log("Logging session context object");
		console.log(context_array);

		if(session.get("accessToken")!=null){
			console.log(session.get("accessToken"));
		}else{
			console.log("no access token");
			response.linkAccount();
			response.say("Please login with your Google account first.");
			return;
		}

		if(daily_count!=0){
	    var userIn = request.slot('speech');
	    // TODO
	    // Log user input, time stamp
	    // Perform sentiment analysis on input
		  console.log("---Alexa Input Log---");
			console.log("timestamp: "+new Date().toISOString());
			console.log("user input: "+userIn);
			// Calculate sentiment score
			// 13-3-2018 Addded cumulative sentiment score among user queries
			var score = sentiment_Analyser.getScore(userIn);
			session_sentiment = (session_sentiment*daily_count+score)/(daily_count+1);
			console.log("input sentiment score: "+score+" session sentiment: "+session_sentiment);
			console.log("----------count: "+daily_count+"----------");
			// context input
			var sentiment;
			if(score>0){sentiment="sentiment_positive"}
			if(score<0){sentiment="sentiment_negative"}
			if(score==0){sentiment="sentiment_neutral"}
			// Form input context with previous output
			var context_in = context_array.concat(sentiment);

			var options = {
				headers: {"Authorization": "Bearer d25cbadf552a43eba0ed4d4905e98858"},
			    url: 'https://api.dialogflow.com/v1/query?v=20150910',
			    method: 'POST',
			    json:true,
			    body: {
						// added contexts var
						"contexts":context_in,
						"lang": "en",
						"query": userIn,
						"sessionId": "12345",
						//optional "timezone": "America/New_York"
					}
			};
		}else{
			// *** Code reuse
			// Send API call with daily_init_event
			var options = {
				headers: {"Authorization": "Bearer d25cbadf552a43eba0ed4d4905e98858"},
					url: 'https://api.dialogflow.com/v1/query?v=20150910',
					method: 'POST',
					json:true,
					body: {
						"lang": "en",
						"sessionId": "12345",
						// init event, empty query
						"event":{"name": "daily_init_event"}
					}
			};
		}

		// aync API call
		let res;
		try{
			console.log("=====Sending request with context==");
			console.log(context_in);
			let res = await doRequest(options);
			console.log("response result=>\n");
			console.log(res.result);
			var resSpeech = res.result.fulfillment.speech;
			var contexts = res.result.contexts;
			// TODO Try setting session with array
			session.set("contexts",contexts);
			console.log(contexts);
			daily_count++;
			response.say(resSpeech);
			response.shouldEndSession(false);
		}catch(err){
			console.log(err);
			response.say("Sorry there was an error, please try again later");
			return;
		}

  }
);


// For checking if the code is updated
// TODO: Connect to database (DONE)
app.intent("TestIntent",
	function(request,response){
		return database.connect().then(function(result){
			var status;
			if(result)
				status='online';
			else {
				status='offline';
			}
			response.say("Greetings. Current version is beta one point four. Database connection currently "+status);
			response.shouldEndSession(false);
		});
	}
);

// 25-1-2018  Greetings
// Description: Start of the daily interaction monitoring
app.intent("GreetingsIntent",
	function(request,response){
		return loginCheck(request).then(function(result){
			if(result.auth==false){
				response.linkAccount();
			}
			response.say(result.speech);
		});
	}
);

// Get username from database (DONE)
// Kept as template
app.intent("WhoIntent", function(request,response){
	return database.find("username").then(function(result){
		console.log("***Database query");
		console.log(result);
		var name =result.username;
		console.log(name);
		response.say("You are "+name);
		response.shouldEndSession(false);
	});
});

// TODO:  Connect it to database so the result is based on database value
app.intent("PickMusicIntent", {},
  function(request,response) {
		return dacdtabase.find("favorite.music.song").then(function(result){
			// Get user's
	    response.say("Here's your favourite lately!");
			console.log(result);
			console.log(result.favorite.music.song);

			var song=result.favorite.music.song;

			// encoded the link for the song
			var url = "https://evening-savannah-89199.herokuapp.com/music/"+song+".mp3";
			var stream={
				"token": "90",
				"url": url,
				"offsetInMilliseconds": 0
			}
			console.log("playing: "+url);
			// Card display for details
			var content=song;
			response.card({
				type:"Simple",
				title:"I picked this song for you",
				content: content
			});
			// Start the play directive
			response.audioPlayerPlayStream("REPLACE_ALL", stream)

		});

  }
);

// TODO: Handle the player object



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
				var resolutionArray = slot.resolutions.resolutionsPerAuthority;
				var resolution=resolutionArray[0];
				var valueArray = resolution.values;
				if(valueArray==null){
					var dialog = [{
							"type": "Dialog.ElicitSlot",
							"slotToElicit": "subject",
							"updatedIntent": {
						    "name": "ShareIntent",
						    "confirmationStatus": "NONE",
						    "slots": {
						      "subject": {
						        "name": "subject",
						        "value": null,
						        "confirmationStatus": "NONE"
						      },
									"shareAction": {
						        "name": "shareAction",
						        "confirmationStatus": "NONE"
						      },
									"preference": {
						        "name": "preference",
						        "confirmationStatus": "NONE"
						      }
						    }
						  }
					}];
					response.response.response.directives=dialog;
					response.say("I'm not sure what it is, what is it related to?");
					response.shouldEndSession(false);
				}else{
					var entry = valueArray[0];
					console.log(entry);
					var id = entry.value.id;
					// If there is no match, the value will be null
					content = id;
					//var status = request.data.request.intent.slots.subject.resolutions.resolutionsPerAuthority.values.value.id;
					response.card({
						type:"Simple",
						title:"Request received",
						content: content
					});

					if(id==="MUSIC")
					{
						// call back for handling music
						//shareMusicCB(request,response);
						console.log(request);
						return shareMusicAsync(request).then(function(result){
							console.log(result);
							if(result.dialog!=null)
								response.response.response.directives=result.dialog;
							if(result.card!=null)
								response.card(result.card);
							response.say(result.speech);
							response.shouldEndSession(result.sessionEnd);
						});
					}
					if(id==="FYP")
					{
						console.log(request);
						return shareFYPAsync(request).then(function(result){
							console.log(result);
							if(result.dialog!=null)
								response.response.response.directives=result.dialog;
							if(result.card!=null)
								response.card(result.card);
							response.say(result.speech);
							response.shouldEndSession(result.sessionEnd);

							var url = "https://evening-savannah-89199.herokuapp.com/music/floating.mp3";
							var stream={
								"token": "90",
								"url": url,
								"offsetInMilliseconds": 0
							}
							console.log("playing: "+url);

							// Start the play directive
							response.audioPlayerPlayStream("REPLACE_ALL", stream)
						});
					}
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
  },function(request,response){
		return shareMusicAsync(request).then(function(result){
			console.log(result);
			if(result.dialog!=null)
				response.response.response.directives=result.dialog;
			if(result.card!=null)
				response.card(result.card);
			response.say(result.speech);
			response.shouldEndSession(result.sessionEnd);
		});
	}
);

// 26-1-2018 function for authentication check
function loginCheck(request){
	return new Promise((resolve,reject)=>{
		if(request.data.session.user.accessToken == undefined){
			var speech = "Please login to your Amazon account in the companion app to start using this skill";
			var sessionEnd = true;
			var authState = false;
		}else{
			var speech = "How are you doing?";
			var sessionEnd = false;
			var authState = true;
		}
		var result={
			"speech": speech,
			"sessionEnd": sessionEnd,
			"auth": authState
		}
		resolve(result);
});
}
// Async Work handler
function shareFYPAsync(request){
	return new Promise((resolve,reject)=>{
			var feel = request.slot('feeling');
			console.log("***analysing sentiment");
			var score = sentiment_Analyser.getScore(feel);

			var speech = "I know you did not sleep last night. Relax and listen to some music.";
			var sessionEnd=true;
			// Card display for details
			var content="Floating-Chillstep";
			var card={
				type:"Simple",
				title:"I picked this song for you",
				content: content
			};
			var result={
				"speech": speech,
				"sessionEnd": sessionEnd,
				"card":card
			}


			// pass promise back
			resolve(result);
});
}

// Working
function shareMusicAsync(request){
	return new Promise((resolve,reject)=>{

		var song = request.slot('songName'); 	//    3
		var genre = request.slot('musicGenre'); //  5
		var musician = request.slot('musician'); // 7
		var preference=request.slot('preference');
		var dialogState = request.data.request.dialogState;
		if(dialogState==null||dialogState!="COMPLETED"){
			console.log("*****************ShareMusic Dialog NOT COMPLETED");
			console.log("song:"+song);
			console.log("genre:"+genre);
			console.log("musician:"+musician);
			console.log("preference:"+preference);
			var check=checkMusicSlots(song,genre,musician);
			if(check==0){
				//response.say("Go on");
				//response.shouldEndSession(false);
				var speech = "Go on";
				var sessionEnd = false;
				var card={
					type:"Simple",
					title:"No slot values",
					content: ""
				};
				var result={

					"speech": speech,
					"sessionEnd": sessionEnd,
					"card":card
				}
				// pass promise back
				resolve(result);
			}
			if(check==3){
				console.log("*** song name");
				if(preference==null){
					//console.log(request.directive());
					var dialog = [{
							"type": "Dialog.ElicitSlot",
							"slotToElicit": "musicGenre",
					}];
					var result=entityClassifier.classify(song);
					console.log(result);
					var content = "Classifier got =>"+result;
					var speech="Isn't that a "+result+" song?";
					var card={
						type:"Simple",
						title:"Got song name",
						content: content
					};

					var sessionEnd = false;
					var result={
						"dialog": dialog,
						"speech": speech,
						"sessionEnd": sessionEnd,
						"card": card
					}
					// pass promise back
					resolve(result);

				}else{
					console.log("**analysisng sentiment");
					var score = sentiment_Analyser.getScore(preference);
					// TODO: update score in DB
					// set new favourite in DB
					var sentiment="";
					if(score>0)
						sentiment="like";
					if(score<0){
						sentiment="don't like";
					}
					if(score==0)
						sentiment="are fine";
					var speech="I know that you "+sentiment+" it. I got it now for you.";
					var sessionEnd = true;
					var content ="You "+sentiment+" the song: "+song+"\n Echo got your preference value: "+preference;
					var card={
						type:"Simple",
						title:"Sentiment about a song",
						content: content
					};

					var result={
						"speech": speech,
						"sessionEnd": sessionEnd,
						"card": card
					}
					// pass promise back
					resolve(result);

				}
			}
			if(check==5){
				console.log("*** genre");
				if(preference==null){
					// got the genre
					var dialog = [{
							"type": "Dialog.ElicitSlot",
							"slotToElicit": "preference",
					}];
					var sessionEnd=false;
					var speech="Do you like"+genre+" music?";
					var content="song: "+song+"\ngenre: "+genre+"\nmusician: "+musician;
					var card={
						type:"Simple",
						title:"Got Genre",
						content: content
					};

					var result={
						"dialog": dialog,
						"speech": speech,
						"sessionEnd": sessionEnd,
						"card": card
					}
					// pass promise back
					resolve(result);

				}else{
					console.log("**analysisng sentiment");
					var score = sentiment_Analyser.getScore(preference);
					// update score in DB
					// set new favourite in DB
					var sentiment="";
					if(score>0)
						sentiment="like";
					else {
						sentiment="don't like"
					}
					var speech="I've got that down for you. I know that you "+sentiment+" it";
					var sessionEnd=true;
					var result={
						"speech": speech,
						"sessionEnd": sessionEnd
					}
					// update database async
					database.update(genre);
					// pass promise back
					resolve(result);
				}

			}
			if(check==7){
				console.log("*** musician");
				// Check preference
				if(preference==null){
					// got the musician

					// basic handling here
					var dialog = [{
							"type": "Dialog.ElicitSlot",
							"slotToElicit": "preference",
					}];
					var speech="Do you like them?";
					var sessionEnd =false;
					var content="song: "+song+"\ngenre: "+genre+"\nmusician: "+musician;
					var card={
						type:"Simple",
						title:"Got Genre",
						content: content
					};
					var result={
						"dialog": dialog,
						"speech": speech,
						"sessionEnd": sessionEnd,
						"card": card
					}
					// pass promise back
					resolve(result);
				}else{
					console.log("**analysisng sentiment");
					var score = sentiment_Analyser.getScore(preference);
					var sentiment="";
					if(score>0)
						sentiment="like";
					else {
						sentiment="don't like"
					}
					var speech="I know that you "+sentiment+" it";
					var sessionEnd=true;
					var result={
						"speech": speech,
						"sessionEnd": sessionEnd,
					}
					// pass promise back
					resolve(result);

				}

			}
			if(check>=8){
				console.log("*** multiple slots received");
				// got multiple slots
				if(preference!=null){
					var score = sentiment_Analyser.getScore(preference);
					var sentiment="";
					if(score>0)
						sentiment="like";
					else {
						sentiment="don't like"
					}
					var speech="I know that you "+sentiment+" it";
					var sessionEnd=true;
					var result={
						"speech": speech,
						"sessionEnd": sessionEnd,
					}
					// pass promise back
					resolve(result);

				}else{
					var dialog = [{
							"type": "Dialog.ElicitSlot",
							"slotToElicit": "preference",
					}];
					var speech="Do you like it?";
					var sessionEnd=false;
					var result={
						"dialog": dialog,
						"speech": speech,
						"sessionEnd": sessionEnd
					}
					// pass promise back
					resolve(result);

				}
			}
		}else {
			var content="song= "+song+"\nGenre: "+genre+"\nmusician:"+musician;
				var card={
					type:"Simple",
					title:"Intent end",
					content: content
				};
				var speech = "Thank you for your sharing";
				var sessionEnd=true;
				var result={
					"speech": speech,
					"sessionEnd": sessionEnd,
					"card":card
				}
				// pass promise back
				resolve(result);
		}

	});
}

// VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV
// WORKS
// ShareMusicIntent Callback
// Buggy VVV
/*
function shareMusicCB(request,response) {
	// testing slot values
	var song = request.slot('songName'); 	//    3
	var genre = request.slot('musicGenre'); //  5
	var musician = request.slot('musician'); // 7
	var preference=request.slot('preference');

	// Get the dialogState (DONE)
	var dialogState = request.data.request.dialogState;
	if(dialogState==null||dialogState!="COMPLETED"){
		console.log("*****************ShareMusic Dialog NOT COMPLETED");
		var check=checkMusicSlots(song,genre,musician);
		if(check==0){
			response.say("Go on");
			response.shouldEndSession(false);

			var dialog = [{
					"type": "Dialog.ElicitSlot",
					"slotToElicit": "preference",
			}];
			// TODO: Set the custom directives
			response.response.response.directives=dialog;

		}
		if(check==3){
			console.log("*** song name");
			if(preference==null){
				//console.log(request.directive());
				var dialog = [{
						"type": "Dialog.ElicitSlot",
						"slotToElicit": "musicGenre",
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
			}else{
				console.log("**analysisng sentiment");
				var score = sentiment_Analyser.getScore(preference);

				// update score in DB

				// set new favourite in DB
				var sentiment="";
				if(score>0)
					sentiment="like";
				if(score<0){
					sentiment="don't like";
				}
				if(score==0)
					sentiment="are fine";
				var speech="I know that you "+sentiment+" it. I got it now for you.";
				response.say(speech);
				response.shouldEndSession(true);
				var content ="You "+sentiment+" the song: "+song+"\n Echo got your preference value: "+preference;
				response.card({
					type:"Simple",
					title:"Sentiment about a song",
					content: content
				});

			}
		}
		if(check==5){
			console.log("*** genre");
			if(preference==null){
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

			}else{
				console.log("**analysisng sentiment");
				var score = sentiment_Analyser.getScore(preference);

				// update score in DB

				// set new favourite in DB
				var sentiment="";
				if(score>0)
					sentiment="like";
				else {
					sentiment="don't like"
				}
				var speech="I know that you "+sentiment+" it";
				response.say(speech);
				response.shouldEndSession(true);

			}

		}
		if(check==7){
			console.log("*** musician");
			// Check preference
			if(preference==null){
				// got the musician

				// basic handling here
				var dialog = [{
						"type": "Dialog.ElicitSlot",
						"slotToElicit": "preference",
				}];
				var speech="Do you like them?";
				response.response.response.directives=dialog;
				response.shouldEndSession(false);
				var content="song: "+song+"\ngenre: "+genre+"\nmusician: "+musician;
				response.card({
					type:"Simple",
					title:"Got Genre",
					content: content
				});
				response.say(speech);
			}else{
				console.log("**analysisng sentiment");
				var score = sentiment_Analyser.getScore(preference);
				var sentiment="";
				if(score>0)
					sentiment="like";
				else {
					sentiment="don't like"
				}
				var speech="I know that you "+sentiment+" it";
				response.say(speech);
				response.shouldEndSession(true);

			}

		}
		if(check>=8){
			console.log("*** multiple slots received");
			// got multiple slots
			if(preference!=null){
				var score = sentiment_Analyser.getScore(preference);
				var sentiment="";
				if(score>0)
					sentiment="like";
				else {
					sentiment="don't like"
				}
				var speech="I know that you "+sentiment+" it";
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

// 23-1-2018 Added Language related skills
// Intent for translating a language
app.intent("TranslateIntent", {
    "slots": {
      "phrase": "FreePhrase",
      "language": "AMAZON.Language"
    }
  },function(request,response){

		var phrase = request.slot('phrase');
    var language = request.slot('language');
		// test if Literal can capture free speech input
    response.say("You want to translate "+ phrase+" into "+language);
	}
);

module.exports = app;
