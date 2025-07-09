'use strict'

//-------------

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const request = require('request');
const fs = require('fs');

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

//---

console.log('------------------------------------------------------------');
console.log('To manually trigger an outbound PSTN call to "callee" number');
console.log('in a web browser, enter the address:');
console.log('https://<server-address>/call?number=<number>');
console.log("<number> must in E.164 format without '+' sign, or '-', '.' characters");
console.log('for example');
console.log('https://xxxx.ngrok.app/call?number=12995551212');
console.log('------------------------------------------------------------\n');

//==========================================================

app.use(bodyParser.json());

//--------

app.get('/answer', (req, res) => {

    const hostName = req.hostname;

    const uuid = req.query.uuid;

    //----------

    let nccoResponse = [
    {
        "action": "connect",
        "eventType": "synchronous",
        "endpoint": [
            {
                "type": "phone",
                "number": "12995550101" // replace with actual number to call
            }
        ],
        "timeout": "30",  // set as needed for your use case
        "from": serviceNumber,
        "limit": "3600",  // set as needed for your use case
        "eventUrl": ['https://' + hostName + '/event_b']
    }
]

    res.status(200).json(nccoResponse);

});

//--------

app.post('/event', (req, res) => {

  res.status(200).send('Ok');

  if (req.body.status == 'ringing') {

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
          // "transcription": {
          //   "language":"en-US",
          //   "sentiment_analysis": true
          // }
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

  }  
  
});

//----------

app.post('/event_b', (req, res) => {

  res.status(200).send('Ok');

});  

//============= Initiating outbound PSTN calls ===============

//-- Use case where the PSTN call is outbound
//-- manually trigger outbound PSTN call to "number" - see sample request below
//-- sample request: https://<server-address>/call?number=12995550101

app.get('/call', async(req, res) => {

  if (req.query.number == null) {

    res.status(200).send('"number" parameter missing as query parameter - please check');
  
  } else {

    // code may be added here to make sure the number is in valid E.164 format (without leading '+' sign)
  
    res.status(200).send('Ok');  

    const hostName = req.hostname;

    //-- Outgoing PSTN call --

    vonage.voice.createOutboundCall({
      to: [{
        type: 'phone',
        number: req.query.number
      }],
      from: {
       type: 'phone',
       number: serviceNumber
      },
      answer_url: ['https://' + hostName + '/answer2'],
      answer_method: 'GET',
      event_url: ['https://' + hostName + '/event2'],
      event_method: 'POST'
      })
      .then(res => console.log(">>> Outgoing PSTN call status:", res))
      .catch(err => console.error(">>> Outgoing PSTN call error:", err))

    }

});

//-------------------

app.get('/answer2', (req, res) => {

    let nccoResponse = [
      {
        "action": "talk",
        "text": "Hello and good bye!"
      }
    ];

    res.status(200).json(nccoResponse);

});

//-------------------

app.post('/event2', (req, res) => {

  res.status(200).send('Ok');

  if (req.body.status == 'ringing') {

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
          // "transcription": {
          //   "language":"en-US",
          //   "sentiment_analysis": true
          // }
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

//--------------- for VCR (Vonage Cloud Runtime serverless infrastructure) ----------------

app.get('/_/health', async (req, res) => {
   
  res.status(200).send('Ok');

});

//=========================================

const port = process.env.VCR_PORT || process.env.PORT || 8000;

app.listen(port, () => console.log(`Application listening on port ${port}`));

//------------
