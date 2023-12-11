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

const options = {};

const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage(credentials, options);

const privateKey = fs.readFileSync('./.private.key');

const { tokenGenerate } = require('@vonage/jwt');

const apiBaseUrl = 'https://api.nexmo.com';

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

  if (req.body.type != undefined && req.body.type === 'transfer'){

    const hostName = req.hostname;

    const conversationUuid = req.body.conversation_uuid_to;
    const uuid = req.body.uuid;

    const accessToken = tokenGenerate(process.env.APP_ID, privateKey, {});

    //- start "conference" recording - does not record play TTS or stream audio file
    // request.put(apiBaseUrl + '/v1/conversations/' + conversationUuid + '/record', {
    //     headers: {
    //         'Authorization': 'Bearer ' + accessToken,
    //         "content-type": "application/json",
    //     },
    //     body: {
    //       "action": "start",
    //       "event_url": ['https://' + hostName + '/recording?uuid=' + conversationUuid],
    //       "event_method": "POST",
    //       "split": "conversation",
    //       "channels": 2,
    //       "format": "mp3",
    //       "transcription": {
    //         "event_url": ["https://" + hostName + "/transcription?uuid=" + conversationUuid],
    //         "event_method": "POST",
    //         "language":"en-US"
    //         }
    //     },
    //     json: true,
    //   }, function (error, response, body) {
    //     if (error) {
    //       console.log('error start recording:', error);
    //     }
    //     else {
    //       console.log('response:', response);
    //     }
    // }); 

    //- start "leg" recording - does record play TTS and stream audio file
    //- see https://nexmoinc.github.io/conversation-service-docs/docs/api/create-recording (note: path is different in this doc)
    request.put(apiBaseUrl + '/beta/legs/' + uuid + '/recording', {
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
          console.log('error start recording:', error);
        }
        else {
          console.log('response:', response);
        }
    }); 

    //--- establish 2nd leg
    //-- e.g. PSTN call (this sample code)
    //-- or WebSocket to your middleware platform
    
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
      advanced_machine_detection: {
        "behavior": "continue",
        "mode": "default",
        "beep_timeout": 45
      },
      ringing_timer: 60,
      answer_url: ['https://' + hostName + '/answer2?original_uuid=' + uuid],
      answer_method: 'GET',
      event_url: ['https://' + hostName + '/event2?original_uuid=' + uuid],
      event_method: 'POST',
    })
      .then(resp => console.log(resp))
      .catch(err => console.error(err));

    //-- play MoH to first (incoming) call leg

    // this is just a placeholder audio file for demo purpose
    // you MUST USE a Music on Hold audio file you have license or legal usage rights

    vonage.voice.streamAudio(uuid, 'https://ccrma.stanford.edu/~jos/mp3/pno-cs.mp3', 0)
      .then(resp => console.log(resp))
      .catch(err => console.error(err));


    setTimeout( () => {

      vonage.voice.stopStreamAudio(uuid)
        .then(resp => console.log(resp))
        .catch(err => console.error(err));

    }, 4000);

    //-- play TTS to first (incoming) call leg

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
          "endOnExit": true,  // keep for a PSTN leg, not necessary for a WebSocket leg
          "startOnEnter":true,
          "name": "conference_" + originalUuid  // put 2nd leg into same named conference
        }
      ];

    res.status(200).json(nccoResponse);

});

//-------------------

app.post('/event2', (req, res) => {

  res.status(200).send('Ok');

});

//-------------------

// called on record conversation, not on record call leg
app.post('/recording', async(req, res) => {

  res.status(200).send('Ok');

  await vonage.voice.downloadRecording(req.body.recording_url, './post-call-data/' + req.query.uuid + '.mp3');

});

//-------------------

// called on record conversation, not on record call leg
app.post('/transcription', async(req, res) => {

  res.status(200).send('Ok');

  await vonage.voice.downloadTranscription(req.body.transcription_url, './post-call-data/' + req.query.uuid + '.txt');  

});

//-------------------

app.post('/rtc', async(req, res) => {

  res.status(200).send('Ok');

  switch (req.body.type) {

    case "audio:record:done": // leg recording, get the audio file
      console.log('\n>>> /rtc audio:record:done');
      console.log('req.body.body.destination_url', req.body.body.destination_url);
      console.log('req.body.body.recording_id', req.body.body.recording_id);

      await vonage.voice.downloadRecording(req.body.body.destination_url, './post-call-data/' + req.body.body.recording_id + '_' + req.body.body.channel.id + '.mp3');
 
      break;

    case "audio:transcribe:done": // leg recording, get the transcript
      console.log('\n>>> /rtc audio:transcribe:done');
      console.log('req.body.body.transcription_url', req.body.body.transcription_url);
      console.log('req.body.body.recording_id', req.body.body.recording_id);

      await vonage.voice.downloadTranscription(req.body.body.transcription_url, './post-call-data/' + req.body.body.recording_id + '.txt');  

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
