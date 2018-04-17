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

// Default handlers of the skill
{
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
}

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

// Check if the sessionShould end from
// result.metadata.endConversation
async function checkEnd(res){
	if(res.result.metadata.endConversation==true){
		console.log("End of dialog");
		return true;
	}else{
		return false;
	}
}

// TODO function to find radio station using given category code
async function findRadio(category){
	var result={
		name:"",
		url:""
	};
	var code = category;
	var url="http://api.dirble.com/v2/category/"+code+"/stations?token=83a5369601147cb64f5c57f533";
	console.log("[findRadio] Sending get request");
	try{
		let res = await doRequest(url);
		var stream, streams;
		var stations = JSON.parse(res);
		var count=0;
		stations.forEach(function(station){
			// array of streams link
			streams= station.streams;
			streams.forEach(function(channel){
				stream=channel.stream;
				console.log("looking at: "+stream);
				if(stream.lastIndexOf("https",0)===0){
					// check if the stream starts with https
					result.name=station.name;
					result.url=stream;
					return result;
				}
			});
			count++;
		});
		console.log("[findRadio] No suitable Result after looking at "+count+" stations");
		// TODO get first result
		return result;

	}catch(err){
		console.log(err);
	}
}


// AFTER RECEIVING RES*****
// TODO: Function to check the context in respond to determine for any action
async function checkAction(res){
	// action array to set in session to tell next input what to expect
	console.log("[checkContext] Starts");
	var action_flag=0;
	var result=res.result;
	var contexts=result.contexts;
	var action=result.action;
	var param=result.parameters;
	// check if collectable params exists
	// result.actionIncomplete = true -> do not extract param
	if(result.actionIncomplete==false){
		// extract parameters
		if(result.parameters!=null){
			param=result.parameters;
			console.log("completed action params:");
			console.log(param);

			// possible contexts
			// Test: test_start , test_end
			if(contexts.indexOf("test_start")!=0){
				// start "test"
			}else{

			}
			// Music:
			if(action==="action.play.music"){
				// TODO: play_music context is an object containin the streaming url
				action_flag=1;
			}
			if(action==="action.stop.music"||action==="smalltalk.confirmation.cancel"){
				action_flag=2;
			}
			if(action==="action.play.radio"){
				action_flag=3;
			}

			return action_flag;

		}
	}else{
		// action incomplete, returns
		return action_flag;
	}

}


// Launch Intent
// The following runs, When user call the invocation name on Alexa
app.launch( async function( request, response ) {
	var session;
	var sessionID;
	var accessToken;
	var user_obj;
	var e_name;

	if(request.getSession()!=null){
		session = request.getSession();
		console.log(session);
		// Fixed, getting the accessToken by Alexa
		accessToken = session.details.accessToken;
		//console.log("Get session function returns: "+accessToken);
	}

	console.log("***[app.lauch] Started ***");

	// Check if the user have logged in
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

	// We have an authentidated Google users
	// Retreive user data from database
	try{
		// DO te followin
		// 1. validate user in DB (use access token)
		let result= await validateUser(accessToken);
		if(result!=null){
			console.log("[validateUser] Completed. User exists in db.");
			// Proceed with user
		}else{
			// This section should not be invoked
			console.log("user not in DB yet, create new record and do init dialogs");
			let result = await model.addUser("unknown",accessToken);
			console.log(result);
		}
	  // 2. check user daily status
		// 2.1 Look for today's record, if none, create one
		// Returned user_obj, contains the following:
		// .name : User name, how to call the user_info
		// .record: the record object
		// .record.owner: object of the user
		console.log("[app.launch] Reading Daily record");
		user_obj = await model.getUserTodaysRecord(accessToken);

		var options;
		// Check count from Daily Record
		daily_count=user_obj.record.count;
		console.log("[app.launch] Daily count = "+daily_count);

		if(daily_count==0){
			console.log("[app.launch] Daily starts");
			// Send API call with daily_init_event

			if(user_obj.record.owner.usr_type==="norm"){
				// Normal user, set launch event to "daily_init_event"
				e_name = "daily_init_event";
			}else{
				// elderly, set launch event to "daily_elder_init"
				e_name = "daily_elder_init";
			}
		}else{
			// NON- First time daily CatchAllIntent
			// set event to "daily_user_status"
			e_name = "daily_user_status";
		}

		//set session id with accesstoken
		sessionID=accessToken;
		// get user name from db
		// encode user name to context variable
		var user_context={
	    "lifespan": 1,
	    "name": "user_info",
	    "parameters": {
	      "usr_name": user_obj.name
	    }
	  };

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

		console.log("[app.launch] Sending request");
		let res = await doRequest(options);
		console.log("[app.launch] response result=>\n");
		console.log(res.result);
		var resSpeech = res.result.fulfillment.speech;
		// Output contexts
		// Store it to request Session object to persist the value
		var contexts = res.result.contexts;
		// TODO Try setting session with array
		session.set("contexts",contexts);
		console.log("[app.launch] Setting contexts in session");
		console.log(session.contexts);
		// TODO:
		// Function to check certain values within context
		// Perform reactions e.g. Music streaming
		response.say(resSpeech);

		//-------------------------------------END
		// Check if session ends
		let sessionEnd = await checkEnd(res);
		response.shouldEndSession(sessionEnd);
		// Update DB async
		model.updateUserDailyRecord(accessToken,"count",daily_count+1);
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
		console.log("***[catchAll]started*****");
		// Get session context
		var session = request.getSession();
		var context_array=session.get("contexts");
		var accessToken;
		var sessionId;
		var user_obj;
		var context_in;
		var e_name="";
		console.log("[catchAll] Logging session context object");
		console.log(context_array);
		// Get use Token from session object
		if(session!=null){
			//session = request.getSession();
			//console.log(session);
			// Fixed, getting the accessToken by Alexa
			accessToken = session.details.accessToken;
			//console.log("Get session function returns: "+accessToken);
		}

		if(accessToken==null){
			console.log("no access token");
			// 5-4-2018
			// Account linking with Google
			response.linkAccount();
			response.say("Please login with your Google account first.");
			return;
		}
		// use accessToken as sessionid
		sessionId = accessToken;

		console.log("[catchALL] Reading Daily record");
		user_obj = await model.getUserTodaysRecord(accessToken);
		daily_count=user_obj.record.count;
		console.log("[catchALL] Daily count = "+daily_count);

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
			if(score>0){sentiment={name:'sentiment_positive',lifespan:2}}
			if(score<0){sentiment={name:'sentiment_negative',lifespan:2}}
			if(score==0){sentiment={name:'sentiment_neutral',lifespan:2}}
			// Form input context with previous output
			if(context_array!=null){
				// Bind sentiment with existing context if any
				context_in = context_array.concat(sentiment);
			}else {
				context_in = sentiment;
			}

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
						"sessionId": sessionId,
						//optional "timezone": "America/New_York"
					}
			};
		}else{
			// *** Code reuse
			if(user_obj.record.owner.usr_type==="norm"){
				// Normal user, set launch event to "daily_init_event"
				e_name = "daily_init_event";
			}else{
				// elderly, set launch event to "daily_elder_init"
				e_name = "daily_elder_init";
			}
			// Send API call with daily_init_event
			var options = {
				headers: {"Authorization": "Bearer d25cbadf552a43eba0ed4d4905e98858"},
					url: 'https://api.dialogflow.com/v1/query?v=20150910',
					method: 'POST',
					json:true,
					body: {
						"lang": "en",
						"sessionId": sessionId,
						// init event, empty query
						"event":{"name": e_name}
					}
			};
		}

		// aync API call
		let res;
		try{
			console.log("[catchALL]=====Sending request with context==");
			console.log(context_in);
			let res = await doRequest(options);

			// TODO: check context for reactions
			let action = await checkAction(res);
			console.log("[catchALL] response result=>\n");
			console.log(res.result);

			var resSpeech = res.result.fulfillment.speech;
			var contexts = res.result.contexts;

			// Check if session ends
			// may be overited by following actions
			let sessionEnd = await checkEnd(res);


			// TODO: Perform action according to "action" and "context"
			switch(action){
				// 0. none, no further action
				case 0:
					break;
				// 1. play Music
				case 1:
				// TODO: Change url according to user's info
					var url = "https://alexa-server-ck.herokuapp.com/music/floating.mp3";
					var stream={
						"token": "90",
						"url": url,
						"offsetInMilliseconds": 0
					};
					// Start the play directive
					response.audioPlayerPlayStream("REPLACE_ALL", stream);
					sessionEnd=true;
					break;
				// 2. Stop any playing directives
				case 2:
					response.audioPlayerStop();
					break;
				case 3:
				// 3. Find radio stream url
					// TODO
				  console.log("Finding radio with cate: ",res.result.parameters.radio_category);
					let result = await findRadio(res.result.parameters.radio_category);
					resSpeech="I have found this station called "+result.name;
					var url = result.url;
					var stream={
						"token": "90",
						"url": url,
						"offsetInMilliseconds": 0
					};
					response.audioPlayerPlayStream("REPLACE_ALL", stream);
					sessionEnd=true;
					break;
			}


			//Setting session with array
			session.set("contexts",contexts);
			console.log("[catchALL] setting contexts with:");
			console.log(contexts);

			// Speech response
			response.say(resSpeech);
			response.shouldEndSession(sessionEnd);

			// Update DB async
			// update daily count
			model.updateUserDailyRecord(accessToken,"count",daily_count+1);
			// update daily avg score
			model.updateUserDailyRecord(accessToken,"avg_sentiment_score",session_sentiment);
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

// TODO:
// Incoperate the song playing function into the dialog model ***
// TODO
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



// TODO: Stream radio with Drible
// API key: 83a5369601147cb64f5c57f533
// authorize by http://api.dirble.com/v2/stations?token={your token}

module.exports = app;
