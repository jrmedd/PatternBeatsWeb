var preferredPort = '/dev/ttyACM0'; //preferred serial port (automatically picked)
var connectionId = -1; //null connection id before serial connection
var MIN_RESPONSE_LENGTH = 37; //number of bytes expected from card read
var incoming = ""; //buffer for incoming serial information

chrome.serial.getDevices(onGetDevices); //get devices

var ac = new AudioContext();//audio context for playback
var numVoices = 8; //number of individual voices
var voices = new Array(); //array for voice objects
var steps = new Array(); //array for note arrays
var numSteps = 8; //number of steps
var tempo = 120;

var playing = false; //playing or not

var scale = ['C4', 'B3', 'A3', 'G3', 'F3', 'E3', 'D3', 'C3']; //scales

for (var voice = 0; voice < numVoices; voice ++) {
  steps[voice] = new Array();//setup note arrays
  voices[voice] = new TinyMusic.Sequence(ac, tempo);//setup instrument objects
}

$('#tempo-display').html(tempo + " BPM");
$("#tempo-adjust").on('change', function(){
  tempo = $(this).val();
  $('#tempo-display').html(tempo + " BPM");
  for (var voice = 0; voice < numVoices; voice ++) {
    voices[voice].tempo = tempo;
  }
})
for (var row = 0; row < numVoices; row ++) {
  var tr = $('<tr>');
  for (var col = 0; col < numSteps; col ++) {
    $('<td></td>').appendTo(tr);
  }
  tr.appendTo('#sequencer');
};

function onGetDevices(ports){
  //check for serial devices
  if (ports.length > 0) {
    $.each(ports, function(key, value) {
      //if preferred port
      if (value.path == preferredPort) {
        $('#serial-select').append($('<option selected></option>').attr('value', value.path).text(value.path));//select
        chrome.serial.connect(preferredPort, {bitrate: 115200}, onConnect);//conect
      }
      else if (value.path != preferredPort && connectionId < 1) {
        //add other options
        $('#serial-select').append($('<option></option>').attr('value', value.path).text(value.path));
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
  $('#controller-warning').fadeOut();
});


var onReceiveCallback = function(info) {
  if (info.connectionId == connectionId && info.data) {
    incoming += ab2str(info.data);
    if (incoming.length < MIN_RESPONSE_LENGTH) {
        setTimeout(function() {
          //console.log('Data fragmented');
        }, 25);
        return;
    }
    var successRead = incoming.split(":01")[1];
    if (successRead) {
      reading = processCard(successRead);
      setRows(reading);
      if (!playing) {
        var startTime = ac.currentTime;
        playStop(startTime);
      }
    }
    else {
      console.log("Failed to read card.");
    }
    incoming = "";
  };
};

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
};

$("#play-stop").on('click', function() {
  playStop();
})
function setRows(rows) {
  //iterate over table rows
  $('tr').each(function(rowIndex, rowValue) {
    //iterate over columns
    $(this).find('td').each(function(colIndex, colValue){
      var currentCell = $(this).closest('td');
      if (rows[rowIndex][colIndex] == 1 ) {
        currentCell.addClass('beat-selected');
        steps[rowIndex][colIndex] = new TinyMusic.Note(scale[rowIndex] + ' e');
      }
      else if (rows[rowIndex][colIndex] == 0) {
        steps[rowIndex][colIndex] = new TinyMusic.Note('- e');
        currentCell.removeClass('beat-selected');
      }
    });
    voices[rowIndex].notes = steps[rowIndex];
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
    base2.reverse(); //reverse order
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

function changeTempo(tempoChange) {
  for (voice = 0; voice < numVoices; voice ++) {
    voices[voice].tempo = tempoChange;
  }
}

function playStop(startPlaying) {
  if (playing) {
    $("#play-stop").html("PLAY")
    for (voice = 0; voice < numVoices; voice ++) {
      voices[voice].stop();
      playing = false;
    }
  }
  else {
    $("#play-stop").html("STOP");
    for (voice = 0; voice < numVoices; voice ++) {
      voices[voice].play(startPlaying);
      playing = true;
    }
  }
}

chrome.serial.onReceive.addListener(onReceiveCallback);
