# Vonage APIs Application - Record all audio on a call leg

## Set up

Copy or rename .env-example to .env<br>
Update parameters in .env file<br>
Have Node.js installed on your system, this application has been tested with Node.js version 16.15<br>
Install node modules with the command "npm install"<br>
Start application with the command "node record-call-leg-all-audio"<br>

In your account at dashboard.nexmo.com,<br>
edit the application associated to this server code,<br>
enable "RTC (In-app voice & messaging)", and set the corresponding webhook URL, then [Save changes].<br>

In this sample application, the webhook URLs relative paths are:<br>
HTTP GET /answer for the voice Answer URL<br>
HTTP POST /event for the voice Event URL<br>
HTTP POST /rtc for the RTC Event URL<br>

Modify those relative paths in this sample code record-call-leg-all-audio.js to match your actual webhook URLs as set in the dashboard.

If you run this application locally on your computer, you may use ngrok and establish an https tunnel to local port 8000.

## How this application works

Call the Vonage number linked to this voice application (dashboard.nexmo.com)<br>
in this sample code,<br>
it streams an audio file to the caller,<br>
it plays TTS to the caller,<br>
it calls a second PSTN party, instead your application could establish a WebSocket leg to your middleware,<br>
both legs are dropped into a unique named conference,<br>
each party on each leg may speak to the other party on the other leg and both can hear each other,<br>
your application will get the full 2-channel (stereo) audio recording including play TTS and stream audio file and text transcript of each call under the folder 'post-call-data'.

Although this sample code has been written using the Vonage Voice API Node.js SDK, the same call flows would be the same with any other Vonage Voice API SDK programming language, including using direct API calls.

