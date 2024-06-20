'use strict'

//-------------

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const request = require('request');
const fs = require('fs');

//--- for VCR installation ----

const neruHost = process.env.NERU_HOST;
console.log('neruHost:', neruHost);

//------------------------------

const serviceNumber = process.env.SERVICE_NUMBER;
const calleeNumber = process.env.CALLEE_NUMBER;

// ------------------

console.log("Service phone number:", serviceNumber);

//-------------------

const { Auth } = require('@vonage/auth');

const credentials = new Auth({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  applicationId: process.env.APP_ID,
  privateKey: './.private.key'
});

// sample API endpoint value, set the relevant one for your own application
const apiRegion = "https://api-us-4.vonage.com";  // must be consistent with the corresponding application's "Region" paremeter value (dashboard.nexmo.com)

const options = {
  apiHost: apiRegion
};

const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage(credentials, options);

const vonageNr = new Vonage(credentials, {} );  


const privateKey = fs.readFileSync('./.private.key');

const { tokenGenerate } = require('@vonage/jwt');

//--

// const apiBaseUrl = "https://api.vonage.com";
const apiBaseUrl = "https://api-us.vonage.com";
// const apiBaseUrl = "https://api-eu.vonage.com";
// const apiBaseUrl = "https://api-ap.vonage.com";

//==========================================================

app.use(bodyParser.json());

//--------

app.get('/answer', (req, res) => {

    const hostName = req.hostname;

    const uuid = req.query.uuid;

    //----------

    let nccoResponse = [
        {
          "action": "conversation",
          "endOnExit": true,
          "startOnEnter":true,
          "name": "conference_" + uuid
        }
      ];

    res.status(200).json(nccoResponse);

});

//--------

app.post('/event', (req, res) => {

  res.status(200).send('Ok');

  if (req.body.status != undefined){
    console.log("status:", req.body.status);

    if (req.body.status == 'answered') {  // first leg (incoming call)

      const uuid = req.body.uuid;

      const convId = req.body.conversation_uuid;

      const accessToken = tokenGenerate(process.env.APP_ID, privateKey, {});

      //-- get leg status --
          request.get(apiRegion + '/v1/legs?conversation_id=' + convId, {
          headers: {
              'Authorization': 'Bearer ' + accessToken,
              "content-type": "application/json",
          },
          json: true,
        }, function (error, response, body) {
          if (error) {
            // console.log('>>> error get leg', convId, 'status:', error);
            console.log('>>> error get leg with conv ID:', convId, error.body);
          }
          else {
            // console.log('>>> call leg', convId, 'status:', response);
            console.log('>>> get leg with conv ID:', convId, response.body);
            console.log('>>> get leg details with conv ID:', convId, response.body._embedded.legs);
          }
      }); 

      //--- get legs with status answered ---

      request.get(apiRegion + '/v1/legs?status=answered', {
          headers: {
              'Authorization': 'Bearer ' + accessToken,
              "content-type": "application/json",
          },
          json: true,
        }, function (error, response, body) {
          if (error) {
            // console.log('>>> error get leg', convId, 'status:', error);
            console.log('>>> error get legs:', error.body);
          }
          else {
            // console.log('>>> call leg', convId, 'status:', response);
            console.log('>>> get legs status answered:', response.body._embedded.legs);
          }
      });

      //--- get calls ---

      request.get(apiRegion + '/v1/calls?status=answered', {
          headers: {
              'Authorization': 'Bearer ' + accessToken,
              "content-type": "application/json",
          },
          json: true,
        }, function (error, response, body) {
          if (error) {
            // console.log('>>> error get leg', convId, 'status:', error);
            console.log('>>> error get calls:', error.body);
          }
          else {
            // console.log('>>> call leg', convId, 'status:', response);
            console.log('>>> get calls with status answered:', response.body._embedded.calls);
          }
      });     
   
      //-- play MoH to first (incoming) call leg
      console.log("call leg uuid:", uuid);

      // you must use a Music on Hold audio file you have license or legal usage rights
      vonage.voice.streamAudio(uuid, 'https://ccrma.stanford.edu/~jos/mp3/pno-cs.mp3', 0)
        .then(resp => console.log(resp))
        .catch(err => console.error(err));
    }

  };

  if (req.body.type != undefined && req.body.type === 'transfer'){

    const hostName = req.hostname;

    const conversationUuid = req.body.conversation_uuid_to;
    const uuid = req.body.uuid;

    const accessToken = tokenGenerate(process.env.APP_ID, privateKey, {});

    //-- start "leg" recording --
    // request.post(apiRegion + '/v1/legs/' + uuid + '/recording', {
    request.post(apiBaseUrl + '/v1/legs/' + uuid + '/recording', {
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            "content-type": "application/json",
        },
        body: {
          "split": true,
          "streamed": true,
          // "beep": true,
          "public": true,
          "validity_time": 30,
          "format": "mp3",
          "transcription": {
            "language":"en-US",
            "sentiment_analysis": true
          }
        },
        json: true,
      }, function (error, response, body) {
        if (error) {
          console.log('error start recording:', error.body);
        }
        else {
          console.log('start recording response:', response.body);
        }
    });

    //------------------------

    setTimeout

    // //--- get leg status ---

    // request.get(apiRegion + '/v1/legs?status=answered', {
    //     headers: {
    //         'Authorization': 'Bearer ' + accessToken,
    //         "content-type": "application/json",
    //     },
    //     json: true,
    //   }, function (error, response, body) {
    //     if (error) {
    //       // console.log('>>> error get leg', convId, 'status:', error);
    //       console.log('>>> error get legs:', error.body);
    //     }
    //     else {
    //       // console.log('>>> call leg', convId, 'status:', response);
    //       console.log('>>> get legs status answered:', response.body._embedded.legs);
    //     }
    // }); 

    //-- call other party -- instead of a PSTN call, it could be a WebSocket connection to your ASR / Voice bot engine
    console.log("Now calling", calleeNumber, "with", serviceNumber, "as caller-ID number.");

    vonage.voice.createOutboundCall({
      to: [{
        type: 'phone',
        number: calleeNumber
      }],
      from: {
        type: 'phone',
        number: serviceNumber
      },
      // advanced_machine_detection: {
      //   "behavior": "continue",
      //   "mode": "default",
      //   "beep_timeout": 45
      // },
      ringing_timer: 60,
      answer_url: ['https://' + hostName + '/answer2?original_uuid=' + uuid],
      answer_method: 'GET',
      event_url: ['https://' + hostName + '/event2?original_uuid=' + uuid],
      event_method: 'POST',
    })
      .then(resp => console.log(resp))
      .catch(err => console.error(err));


    // stop MoH  
    setTimeout( () => {  

      vonage.voice.stopStreamAudio(uuid)
        .then(resp => console.log(resp))
        .catch(err => console.error(err));

    }, 4000);

    //-- play TTS to first (incoming) PSTN call leg
    setTimeout( () => {

      vonage.voice.playTTS(uuid,  
      {
        text: "What would you like to order today?",
        language: 'en-US', 
        style: 0,
      })
        .then(resp => console.log(resp))
        .catch(err => console.error(err));

    }, 4000 + 1000);

  };
  
});

//-------------------

app.get('/answer2', (req, res) => {

    const originalUuid = req.query.original_uuid;

    //----------

    let nccoResponse = [
        {
          "action": "conversation",
          "endOnExit": true,
          "startOnEnter":true,
          "name": "conference_" + originalUuid
        }
      ];

    res.status(200).json(nccoResponse);

});

//-------------------

app.post('/event2', (req, res) => {

  res.status(200).send('Ok');

  if (req.body.status != undefined){
  console.log("status:", req.body.status);

    if (req.body.status == 'answered') {  // first leg (incoming call)

      const accessToken = tokenGenerate(process.env.APP_ID, privateKey, {});

      //--- get calls ---

      request.get(apiRegion + '/v1/calls?status=answered', {
          headers: {
              'Authorization': 'Bearer ' + accessToken,
              "content-type": "application/json",
          },
          json: true,
        }, function (error, response, body) {
          if (error) {
            console.log('>>> error get calls:', error.body);
          }
          else {
            console.log('>>> get calls with status answered:', response.body._embedded.calls);
          }
      });

    }

  }

  //---

  if (req.body.type != undefined && req.body.type === 'transfer'){

    //--- get calls ---

    const accessToken = tokenGenerate(process.env.APP_ID, privateKey, {});

    request.get(apiRegion + '/v1/calls?status=answered', {
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            "content-type": "application/json",
        },
        json: true,
      }, function (error, response, body) {
        if (error) {
          console.log('>>> error get calls:', error.body);
        }
        else {
          console.log('>>> get calls with status answered - after named conference:', response.body._embedded.calls);
        }
    });


  }  



});

//-------------------

app.post('/rtc', async(req, res) => {

  res.status(200).send('Ok');

  switch (req.body.type) {

    case "audio:record:done": // leg recording, get the audio file
      console.log('\n>>> /rtc audio:record:done');
      console.log('req.body.body.destination_url', req.body.body.destination_url);
      console.log('req.body.body.recording_id', req.body.body.recording_id);

      await vonageNr.voice.downloadRecording(req.body.body.destination_url, './post-call-data/' + req.body.body.recording_id + '_' + req.body.body.channel.id + '.mp3');
 
      break;

    case "audio:transcribe:done": // leg recording, get the transcript
      console.log('\n>>> /rtc audio:transcribe:done');
      console.log('req.body.body.transcription_url', req.body.body.transcription_url);
      console.log('req.body.body.recording_id', req.body.body.recording_id);

      await vonageNr.voice.downloadTranscription(req.body.body.transcription_url, './post-call-data/' + req.body.body.recording_id + '.txt');  

      break;      
    
    default:  
      // do nothing

  }

});

//--------------- for VCR (aka Neru) ----------------

app.get('/_/health', async (req, res) => {
   
  res.status(200).send('Ok');

});

//=========================================

const port = process.env.NERU_APP_PORT || process.env.PORT || 8000;

app.listen(port, () => console.log(`Application listening on port ${port}`));

//------------
