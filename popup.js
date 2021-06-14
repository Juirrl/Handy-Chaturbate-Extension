class Popup {

    constructor() {
		
		var self = this;
		window.self = this;
		
		
		this.levels = 8;
		this.levelMatrix;
		this.backgroundScript = chrome.extension.getBackgroundPage();
		
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
			min_interval: 10,
			decorate_both: false,
			grid: false,
			onFinish: function (data) {
				self.updateVelocity(data);	
			},
		};
		
		for ( var i = 1; i <= this.levels ; i++ ) {
			$("#level"+i+"StrokeSlider").ionRangeSlider(strokeSliderStyle);
			$("#level"+i+"SpeedSlider").ionRangeSlider(speedSliderStyle);
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
				for ( var i=1 ; i <= window.self.levels ; i++ ) {
					$("#level"+i+"StrokeSlider").data("ionRangeSlider").update({ from: levelMatrix[i-1].strokeStart , to: levelMatrix[i-1].strokeStop});
					$("#level"+i+"SpeedSlider").data("ionRangeSlider").update({ from: levelMatrix[i-1].velocity });
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
		window.self.levelMatrix[index-1].strokeStart = data.from;
		window.self.levelMatrix[index-1].strokeStop = data.to;
		chrome.storage.sync.set( { 'levelMatrix': window.self.levelMatrix } );
	}
	
	updateVelocity(data) {
		var index = data.input[0].name;
		window.self.levelMatrix[index-1].velocity = data.from;
		chrome.storage.sync.set( { 'levelMatrix': window.self.levelMatrix } );
	}
}

new Popup();