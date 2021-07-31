class Popup {

    constructor() {
		
		var self = this;
		window.self = this;
		
		
		this.levels = 14;
		this.levelMatrix;
		this.backgroundScript = chrome.extension.getBackgroundPage();
		this.levelTracker = [];
		
		var strokeSliderStyle = {
			skin: "sharp",
			force_edges: true,
			postfix: "%",
			type: "double",
			min: 0,
			max: 100,
			step: 1,
			min_interval: 10,
			decorate_both: false,
			grid: false,
			onFinish: function (data) {
				self.updateStroke(data);
			},
		};
		
		var speedSliderStyle = {
			skin: "sharp",
			force_edges: true,
			postfix: "%",
			type: "single",
			min: 0,
			max: 100,
			step: 1,
			decorate_both: false,
			grid: false,
			onFinish: function (data) {
				self.updateVelocity(data);	
			},
		};
		
		var delaySliderStyle = {
			skin: "sharp",
			force_edges: true,
			postfix: "s",
			type: "single",
			min: 0,
			max: 120,
			step: 1,
			decorate_both: false,
			grid: false,
			onFinish: function (data) {
				self.updateDelay(data);	
			},
		};
		
		chrome.storage.sync.get(['notes'], function(result) {
			if ( !chrome.runtime.error && result != null && result.notes != undefined ) {
				var notes = result.notes;
				if (notes.length <= 0 ) return;
				for ( var i = 0 ; i < notes.length ; i++ ) {
					var key = "#level"+i+"NoteTextField";
					if( $(key).length ) $(key).val(notes[i]);
				}
			}
		});
		
		for ( var i = 0; i <= this.levels-1 ; i++ ) {
			$("#level"+i+"StrokeSlider").ionRangeSlider(strokeSliderStyle);
			$("#level"+i+"SpeedSlider").ionRangeSlider(speedSliderStyle);
			this.levelTracker[i] = [0];
			if ( $("#level"+i+"right").length ) $("#level"+i+"right").click(i, function(i) {
					self.rightButtonClick(i);
				});
			if ( $("#level"+i+"left").length ) $("#level"+i+"left").click(i, function(i) {
					self.leftButtonClick(i);
				});
				
			if ( $("#level"+i+"NoteTextField").length ) $("#level"+i+"NoteTextField").on('input', function() {
					self.onNoteChange();
				});
			if ($("#level"+i+"DelaySlider").length)	$("#level"+i+"DelaySlider").ionRangeSlider(delaySliderStyle);
		}
		$("#masterStrokeSlider").ionRangeSlider(strokeSliderStyle);
		

	
		chrome.storage.sync.get(['connectionKey'], function(result) {
			if ( !chrome.runtime.error && result != null && result.connectionKey != undefined) this.connectionKeyTextField.value = result.connectionKey;
		});


        $("#saveConnectionKeyButton").bind("click", () => {
            this.setConnectionKey($("#connectionKeyTextField").val() );
        });
		
		
		$("#handyPauseButton").bind("click", () => {
            chrome.runtime.sendMessage( [ "handyPause" ] );
        });
		
		$("#handySyncButton").bind("click", () => {
            chrome.runtime.sendMessage( [ "handySync" ] );
        });
		
		chrome.runtime.onMessage.addListener(function(message, messageSender, sendResponse) {
			if ( message.includes('update_popup' ) ) {
				self.updatePopup();
			}
		});
		
		this.getLevelMatrix();
		this.getMasterStroke();

        this.updatePopup();
    }
	
	rightButtonClick(data) {
		var index = data.data;
		var level = window.self.levelMatrix[index];
		if ( level[window.self.levelTracker[index]].delay > 0 ) {
			console.log('Index: ' + window.self.levelTracker[index]);
			console.log('Level length: ' + level.length);
			if ( window.self.levelTracker[index]+1 >= level.length ) {
				console.log(window.self.levelMatrix[index]);
				window.self.levelMatrix[index].push( { strokeStart: 0, strokeStop: 20, velocity: 20, delay: 0 } );
				console.log(window.self.levelMatrix[index]);
				chrome.storage.sync.set( { 'levelMatrix': window.self.levelMatrix } );
			}
			window.self.levelTracker[index]++;
		} else {
			window.self.levelTracker[index] = 0;
		}
		$("#level"+index+"title").text("Level "+index+"-"+window.self.levelTracker[index]);
		window.self.getLevelMatrix();
	}
	
	leftButtonClick(data) {
		var index = data.data;
		var level = window.self.levelMatrix[index];
		if ( window.self.levelTracker[index] == 0 ) {
			var ind = 0;
			for ( var i = 0 ; i < level.length ; i++ ) {
				if ( level[i].delay <= 0 ) {
					ind = i;
					break;
				}
			}
			window.self.levelTracker[index] = ind;
		} else {
			window.self.levelTracker[index]--;
		}
		$("#level"+index+"title").text("Level "+index+"-"+window.self.levelTracker[index]);
		window.self.getLevelMatrix();
	}
	
	updatePauseButton() {
		if ( this.backgroundScript.backgroundStatus.paused ) {
			$("#handyPauseButton").html('Unpause');
		} else {
			$("#handyPauseButton").html('Pause');
		}
    }

    updatePopup() {
        this.updatePauseButton();
    }

    setConnectionKey(connectionKey) {
		chrome.storage.sync.set( { 'connectionKey': connectionKey } );
    }

	getLevelMatrix() {
		chrome.storage.sync.get(['levelMatrix'], function(result) {
			if ( !chrome.runtime.error && result != null && result.levelMatrix != undefined) {
				var levelMatrix = result.levelMatrix;
				for ( var i=0 ; i <= window.self.levels-1 ; i++ ) {
					var step = window.self.levelTracker[i];
					var level = levelMatrix[i][step];
					$("#level"+i+"StrokeSlider").data("ionRangeSlider").update({ from: level.strokeStart , to: level.strokeStop});
					$("#level"+i+"SpeedSlider").data("ionRangeSlider").update({ from: level.velocity });
					if ( $("#level"+i+"DelaySlider").length ) $("#level"+i+"DelaySlider").data("ionRangeSlider").update({ from: level.delay });
				}
				window.self.levelMatrix = levelMatrix;
			} else {
				chrome.extension.getBackgroundPage().console.log('Error, speed matrix not found');
			}
			
		});
	}
	
	getMasterStroke() {
		chrome.storage.sync.get(['masterStroke'], function(result) {
			if ( !chrome.runtime.error && result != null && result.masterStroke != undefined) {
				var masterStroke = result.masterStroke;
				$("#masterStrokeSlider").data("ionRangeSlider").update({ from: masterStroke.strokeStart , to: masterStroke.strokeStop});
			} else {
				chrome.extension.getBackgroundPage().console.log('Error, master stroke not found');
			}
			
		});
	}
	
	updateStroke(data) {
		var index = data.input[0].name;
		if ( index == "master" ) {
			var masterStroke =  { strokeStart: data.from, strokeStop: data.to };
			chrome.storage.sync.set( { 'masterStroke': masterStroke } );
			return;
		}
		var step = window.self.levelTracker[index];
		window.self.levelMatrix[index][step].strokeStart = data.from;
		window.self.levelMatrix[index][step].strokeStop = data.to;
		chrome.storage.sync.set( { 'levelMatrix': window.self.levelMatrix } );
	}
	
	updateVelocity(data) {
		var index = data.input[0].name;
		var step = window.self.levelTracker[index];
		window.self.levelMatrix[index][step].velocity = data.from;
		chrome.storage.sync.set( { 'levelMatrix': window.self.levelMatrix } );
	}
	
	updateDelay(data) {
		var index = data.input[0].name;
		var step = window.self.levelTracker[index];
		window.self.levelMatrix[index][step].delay = data.from;
		chrome.storage.sync.set( { 'levelMatrix': window.self.levelMatrix } );
	}
	
	onNoteChange() {
		var notes = [];
		for ( var i = 0 ; i < window.self.levels ; i++ ) {
			var key = "#level"+i+"NoteTextField";
			if ( $(key.length) ) notes[i] = $(key).val();
		}
		chrome.storage.sync.set( { 'notes': notes } );
	}
	
}

new Popup();