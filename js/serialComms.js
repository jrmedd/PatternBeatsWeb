var preferredPort = '/dev/cu.usbmodem1421'; //preferred serial port (automatically picked)
var connectionId = -1; //null connection id before serial connection
var MIN_RESPONSE_LENGTH = 37; //number of bytes expected from card read
var incoming = ""; //buffer for incoming serial information

chrome.serial.getDevices(onGetDevices); //get devices

var ac = new AudioContext();//audio context for playback
var numVoices = 8; //number of separate audio voices
var voices = new Array(); //array for storing voices
var steps = new Array();//array for storing steps
var numSteps = 8;//number of steps

var playing = false;//playing or not

var notes = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'];//scale

for (var voice = 0; voice < numVoices; voice ++) {
  steps[voice] = new Array(); //array of each voices steps
  voices[voice] = new TinyMusic.Sequence(ac, 120);//create a synth for each voice
}

function onGetDevices(ports){
  if (ports.length > 0) { //if there are serial devices available
    $.each(ports, function(key, value) {//
      if (value.path == preferredPort) {
        $('#serial-select').append($('<option selected></option>').attr('value', value.path).text(value.path));//append to menu and select
        chrome.serial.connect(preferredPort, {bitrate: 115200}, onConnect);//open connection
      }
      else if (value.path != preferredPort && connectionId < 1) {
        $('#serial-select').append($('<option></option>').attr('value', value.path).text(value.path));//append other options
      }
    });
  }
  else {
    $('#serial-select').append($('<option disabled>No devices detected!</option>'));
    $('#serial-select').prop('disabled', true);
    $("#choose-serial-port").prop('disabled', true);
  }
};

function onConnect(connectionInfo){
  connectionId = connectionInfo.connectionId;
};

$('#choose-serial-port').on('click', function(){
  var selectedPort = $('#serial-select').val();
  chrome.serial.connect(selectedPort, {bitrate: 115200}, onConnect);
});


var onReceiveCallback = function(info) {
  if (info.connectionId == connectionId && info.data) {
    incoming += ab2str(info.data);
    if (incoming.length < MIN_RESPONSE_LENGTH)  //ensure we get the full byte length
        setTimeout(function() {
          //console.log('Data fragmented');
        }, 25); //timeout and try again
        return;
    }
    var successRead = incoming.split(":01")[1]; //got the full length? Try to split at success character
    if (successRead) {
      reading = processCard(successRead); //get 0s and 1s from reading
      setRows(reading); //set the table rows and synth parts
      if (!playing) { //if we're not playing
        var startTime = ac.currentTime;
        for (var voice = 0; voice < numVoices; voice ++) {
          voices[voice].play(startTime);
        }
        playing = true;
      }
    }
    else {
      console.log('Failed to read card');
    }
    incoming = "";
  };
};

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
};
function setRows(rows) {
  $('tr').each(function(rowIndex, rowValue) {
    $(this).find('td input').each(function(colIndex, colValue){
      if (rows[rowIndex][colIndex] == 1 ) {
        $(this).prop('checked', true);
        steps[rowIndex][colIndex] = notes[rowIndex] + ' e';
      }
      else if (rows[rowIndex][colIndex] == 0) {
        $(this).prop('checked', false);
        steps[rowIndex][colIndex] = '- e';
      }
    });
    voices[rowIndex].notes = [];
    for (note = 0; note < steps[rowIndex].length; note ++) {
      voices[rowIndex].push(new TinyMusic.Note(steps[rowIndex][note]));
    }
  });
}

function processCard(input) {
	var converted = input.match(/.{2}/g); //split longer hex value into array of pairs of values e.g. 'FF' 'F0' etc.
	for (var i = 0; i < converted.length; i ++) {
  	converted[i] = parseInt(converted[i], 16); //convert hex values to integers
  }
	bits = toBitList(converted); //get array of base-2 arrays
  return bits;
}

function toBitList(input) {
	bitList = []
	for (var i = 0; i < input.length; i++) { //iterate over 8 integers
		var base2 = input[i].toString(2); //convert to base-2 (binary)
	  base2 = padZeroes(base2, 8);
	  base2 = base2.split("").map(Number); //convert array of strings to integers
		bitList.push(base2);
	}
	return bitList;
}

function padZeroes(input, amount) {
	while (input.length < amount) {
		input = "0" + input;
	}
	return input;
}

chrome.serial.onReceive.addListener(onReceiveCallback);
