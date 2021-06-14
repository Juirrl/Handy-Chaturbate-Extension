class Background {
	
    constructor() {
		
		window.tipList = undefined;
		window.xhrRequests = [];
		var self = this;
		window.self = this;

		window.backgroundStatus = {
			connectionKey: undefined,
			handyConnected: false,
			contentScriptCount: 0,
			paused: false,
			mode: -1, // These are the theoretical things the machine should be doing
			level: -1,
			pattern: -1,
			strokeStart: -1,
			strokeStop: -1,
			velocity: -1,
			errorMessages: [],
			offset: 0,
			patternsUrl: undefined,
		};
		
		window.sha256 = 'f10fb07e14335324f252a83545b48b9f677e5581b261f981e1734bd82a490ddf';
		window.retryAttempts = 2;
		window.KEY_serverTime = 'Get Server Time';
		window.KEY_HSSPSetup = 'Upload Patterns';
		window.KEY_getSync = 'Get Sync';
		window.KEY_HSSPPlay = 'Starting Pattern';
		window.KEY_setSlide = 'Set Slide'; // this is the stroke length
		window.KEY_startSlide = 'Start Slide'; 
		window.KEY_stopSlide = 'Stop Slide'; 
		window.KEY_setVelocity = 'Set Velocity'; 
		window.KEY_setMode = 'Set Mode'; 
		window.KEY_getMode = 'Get Mode'; 
		window.KEY_stopHAMP = 'Stop HAMP'; 
		window.KEY_stopHSSP = 'Stop HSSP'; 
		window.KEY_setXPVP = 'Set XPVP';
		window.KEY_getConnected = 'Get Connected';
		
		window.patternLength = 59;

		chrome.storage.sync.get(['connectionKey'], function(result) {
			if ( !chrome.runtime.error && result != null ) window.backgroundStatus.connectionKey = result.connectionKey;
		});
			
		window.APIUrl = "https://www.handyfeeling.com/api/handy/v2";

		window.levelMatrix;
		
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if ( message.includes('setStop' ) ) {
				window.self.stop();
			}
			if ( message.includes('handyPause' ) ) {
				window.self.pause();
			}
			if ( message.includes('handySync' ) ) {
				window.self.syncPrepare();
			}
			if ( message.includes('setLevel' ) ) {
				window.self.setLevel(message[1]);
			}
			if ( message.includes('setPattern' ) ) {
				window.self.setPattern(message[1]);
			}
			if ( message.includes('contentScriptInitialized' ) ) {
				window.self.updateStatus(1);
			}  
			if ( message.includes('contentScriptUnloaded' ) ) {
				window.self.updateStatus(-1);
			}  
		});
		
		chrome.storage.sync.get(['levelMatrix'], function(result) {
			if ( !chrome.runtime.error && result != null && result.levelMatrix != undefined) {
				window.levelMatrix = result.levelMatrix;	
			} else {
				window.levelMatrix = window.self.getDefaultLevelMatrix();
				chrome.storage.sync.set( { 'levelMatrix': levelMatrix } );
			}
		});	
		
		chrome.storage.sync.get(['masterStroke'], function(result) {
			if ( !chrome.runtime.error && result != null && result.levelMatrix != undefined) {
				window.masterStroke = result.masterStroke;	
			} else {
				window.masterStroke = window.self.getDefaultMasterStroke();
				chrome.storage.sync.set( { 'masterStroke': window.masterStroke } );
			}
		});	
		
		chrome.storage.onChanged.addListener(function(changes, namespace) {
			for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
				if(key === 'levelMatrix') {
					window.levelMatrix = newValue;
					if ( window.backgroundStatus.mode == 0 ) window.self.startAutomatic(window.backgroundStatus.level);
				}
				if(key === 'masterStroke') window.masterStroke = newValue;
				if(key === 'connectionKey') {
					window.backgroundStatus.connectionKey = newValue;
					window.self.checkConnected();
				}
			}
		});
		
		setInterval( window.self.checkConnected, 1500);
		window.self.syncPrepare();
    }
	
	getDefaultMasterStroke() {
		return { strokeStart: 0, strokeStop: 100 };
	}
	
	getDefaultLevelMatrix() {
		return [
			{ strokeStart: 0, strokeStop: 30, velocity: 30 },
			{ strokeStart: 0, strokeStop: 40, velocity: 40 },
			{ strokeStart: 0, strokeStop: 50, velocity: 50 },
			{ strokeStart: 0, strokeStop: 60, velocity: 60 },
			{ strokeStart: 0, strokeStop: 70, velocity: 70 },
			{ strokeStart: 0, strokeStop: 80, velocity: 80 },
			{ strokeStart: 0, strokeStop: 85, velocity: 85 },
			{ strokeStart: 0, strokeStop: 95, velocity: 95 },
		];
	}
	
	validateResponse(response) {
		if (!response.ok) {
			throw Error(response.statusText);
		}
		return response;
	}
	
	setLevel(level) {
		window.self.startAutomatic(parseInt(level));
	}
	
	getPatternTime(pattern) {
		var patterns = window.self.getDefaultPatterns();
		for ( var i = 0 ; i < patterns.length ; i++ ) {
			if ( patterns[i].name === pattern ) {
				return patterns[i].startTime * 1000;
			}
		}
		return -1;
	}

    getDefaultPatterns() {
        return [
            {
                name: "Head tease",
                startTime: 0
            },
            {
                name: "Fast down, slow up",
				startTime: 60
            },
            {
                name: "Slow down, fast up",
				startTime: 120
            },
            {
                name: "Alternating top & bottom",
				startTime: 180
            },
            {
                name: "Alternating speed",
				startTime: 240    
            },
            {
                name: "Alternating long and short",
				startTime: 300  
            },
            {
                name: "Gradually stroke longer and shorter",
				startTime: 360  
            },
            {
                name: "Gradually speed up and slow down",
				startTime: 420  
            }
        ];
    }
	
	handyStatusHandler(xhr, requestType) {
			if (xhr.status === 200) {
				var response = JSON.parse(xhr.response);
				switch( requestType ) {
					case window.KEY_HSSPSetup:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success, patterns already downloaded');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success, patterns downloaded');
								return true;
							break;							
							case -1:
								console.log(requestType + ' Error, unable to download script');
								return false;
							break;							
							case -2:
								console.log(requestType + ' Error, unknown error');
								return false;
							break;							
							case -20:
								console.log(requestType + ' Error, sync required');
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;							
						}
					break;
					case window.KEY_getSync:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;		
					case window.KEY_HSSPPlay:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case -1:
								console.log(requestType + ' Error');
								console.log(xhr);
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;						
					case window.KEY_setSlide:
						switch( response.result ) {
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
							// The API doesn't actually list the result codes for set slide
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;	
					case window.KEY_startSlide:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;	
					case window.KEY_stopSlide:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;	
					case window.KEY_setMode:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_getMode:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_setVelocity:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_stopHAMP:
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					
					case window.KEY_getConnected:
						window.backgroundStatus.handyConnected = response.connected;
						switch( response.connected ) {
							case true:
								//console.log(requestType + ' True');
								return true;
							break;
							case false:
								//console.log(requestType + ' False');
								return false;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_stopHAMP:
					// The API doesn't define these, assuming same as HSSP for now
						switch( response.result ) {
							case -1:
								console.log(requestType + ' Error');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
					case window.KEY_serverTime:
						if ( response != undefined && response.serverTime != undefined ) {
							console.log(requestType + ' Success');
							return true;
						} else {
							console.log(requestType + ' Error');
							return false;
						}
					break;
					case window.KEY_setXPVP:
						switch( response.result ) {
							case -3:
								console.log(requestType + ' Error. Device failed processing the command');
								return false;
							break;
							case 0:
								console.log(requestType + ' Success. Position reached.');
								return true;
							break;
							case 1:
								console.log(requestType + ' Success. Position not reached');
								return true;
							break;
							case 2:
								console.log(requestType + ' Success. Already at position.');
								return true;
							break;
							case 3:
								console.log(requestType + ' Success. Interupted.');
								return true;
							break;
							default:
								console.log(requestType + ' Error');
								return false;
							break;
						}
					break;
				}
			}
			if (xhr.status === 400) {
				console.log(requestType + ' Error: Bad Request');
				window.self.checkConnected();
				return false;
			}
			if (xhr.status === 502) {
				console.log(requestType + ' Error: Machine not connected');
				window.self.checkConnected();
				return false;
			}
			if (xhr.status === 504) {
				console.log(requestType + ' Error: Machine timeout');
				window.self.checkConnected();
				return false;
			}
	}
			
	handyGetMode(callback, retries) {
		var url = window.APIUrl + "/mode";
		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if ( window.self.handyStatusHandler(xhr, window.KEY_getMode)   ) {
					var mode = JSON.parse(xhr.response).mode;
					if (callback && typeof(callback) === "function") {
						callback(mode);
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyGetMode( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Get mode failed.');
					}
				}
			}
		};
		
		xhr.send( );
	}
	
	handySetMode(mode, callback, retries) {
		var url = window.APIUrl + "/mode";
		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_setMode) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handySetMode( mode, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Set Mode failed.');
					}
				}
			}
		};
		var data =  {
			'mode': mode
		};
		xhr.send( JSON.stringify(data) );
	}
	
	handyStopSlide(callback, retries) {
		var url = window.APIUrl + "/hamp/stop";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Length", "0");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_stopSlide) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStopSlide( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Stop Slide failed.');
					}
				}
			}
		};
		xhr.send();
	}
	
	handyStartSlide(callback, retries) {
		var url = window.APIUrl + "/hamp/start";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE  ) {
				if( window.self.handyStatusHandler(xhr, KEY_startSlide) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStartSlide( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Start Slide failed.');
					}
				}
			}
		};
		xhr.send();
	}
	
	handySetVelocity(vel, callback, retries) {
		var url = window.APIUrl + "/hamp/velocity";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_setVelocity) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handySetVelocity( vel, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Set Velocity failed.');
					}
				}
			}
		};
		
		var data =  {
			'velocity': vel
		};
		xhr.send( JSON.stringify(data) );
	}
	

	
	handySetSlide(min, max, callback, retries) {
		function scaleSlideNumber(x) {
			// NewValue = (((OldValue - OldMin) * (NewMax - NewMin)) / (OldMax - OldMin)) + NewMin
			return ((( x - 0 ) * (window.masterStroke.strokeStop - window.masterStroke.strokeStart)) / (100 - 0)) + window.masterStroke.strokeStart;
		}
		var url = window.APIUrl + "/slide";

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
					if( window.self.handyStatusHandler(xhr, KEY_setSlide) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handySetSlide( min, max, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Set Slide failed.');
					}
				}
			}
		};
		
		var data =  {
			'min': scaleSlideNumber(min),
			'max': scaleSlideNumber(max),
		};
		xhr.send( JSON.stringify(data) );
	}
	
	
	
	handyHSSPPlay(time, callback, retries) {
		var url = 'https://www.handyfeeling.com/api/handy/v2/hssp/play';

		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");

		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_HSSPPlay) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
					clearTimeout(window.patternTimeout);
					window.patternTimeout = setTimeout(window.self.handyHSSPPlay, window.patternLength * 1000, time);
					// The patterns are only 60 seconds long in the pattern file, so we have to reset to the beginning every so often.
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyHSSPPlay( time, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Start pattern failed.');
					}
				}
			}
		};
		var data =  {
			'tserver': Math.trunc( new Date().getTime() + window.backgroundStatus.offset ), 
			'tstream': time
		};
		xhr.send( JSON.stringify(data) );

		
	}
	
	handyGetSync(callback, retries) {
		var count = 2;
		var url = window.APIUrl + "/hssp/sync?syncCount="+count;
		var xhr = new XMLHttpRequest();
		if ( retries == undefined || retries <= 0 ) retries = 0;
		window.xhrRequests.push(xhr);
		xhr.open("GET", url);
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("accept", "application/json");
		
		xhr.onreadystatechange = function () {
			// Can't figure out what the return value means so not using it.
			// Here's how to get the return value in case we need it: JSON.parse(xhr.response).dtserver;
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, KEY_getSync) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyGetSync( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Get Sync Time failed.');
					}
				}
			}
		};
		
		xhr.send();
	}
	
	handyHSSPSetup(patternsUrl, callback, retries) {
		var url = window.APIUrl + "/hssp/setup";
		var xhr = new XMLHttpRequest();
		window.xhrRequests.push(xhr);
		if ( retries == undefined || retries <= 0 ) retries = 0;
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_HSSPSetup) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyHSSPSetup( window.backgroundStatus.patternsUrl, callback, retries+1 );
					} else {
						window.self.addErrorMessage('Upload patterns failed.');
					}
				}
			}
		};
		var data = 
		{
			'url': window.backgroundStatus.patternsUrl, 
			'sha256': window.sha256,
		};
		xhr.send( JSON.stringify(data) );
	}
	
	handyStopHAMP(callback, retries) {
		var url = window.APIUrl + "/hamp/stop";

		var xhr = new XMLHttpRequest();
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_stopHAMP ) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStopHAMP( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Stop Alternating Mode failed.');
					}
				}
			}
		};

		xhr.send();
	}
	
	handyStopHSSP(callback, retries) {
		var url = window.APIUrl + "/hssp/stop";

		var xhr = new XMLHttpRequest();
		xhr.open("PUT", url);

		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		xhr.setRequestHeader("Content-Type", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_stopHSSP ) ) {
					if (callback && typeof(callback) === "function") {
						callback();
					}
				} else {
					if ( retries < window.retryAttempts ) {
						window.self.handyStopHSSP( callback, retries+1 );
					} else {
						window.self.addErrorMessage('Stop Pattern failed.');
					}
				}
			}
		};

		xhr.send();
	}
	
	handyGetConnected(callback) {
		var url = window.APIUrl + "/connected";
		var xhr = new XMLHttpRequest();
	
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		xhr.setRequestHeader("X-Connection-Key", window.backgroundStatus.connectionKey);
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				window.self.handyStatusHandler(xhr, window.KEY_getConnected);
				if (callback && typeof(callback) === "function") {
					callback();
				}
			}
		};
		xhr.send();
	}
	
	handyServerTime(callback, remaining, offsets) {
	
		function calculateOffset(offsets) {
			var offsetAg = 0;
			if ( offsets.length <= 0 ) return;
			for ( var i = 0; i < offsets.length ; i++ )
				offsetAg += offsets[i];
			return offsetAg / offsets.length;
		}
		var url = window.APIUrl + "/servertime";
		var xhr = new XMLHttpRequest();
		var startTime = new Date().getTime();
		if ( remaining <= 0 ) {
			if (callback && typeof(callback) === "function") callback();
			return;
		}
		remaining--;
		if ( offsets == undefined ) offsets = [];
		xhr.open("GET", url);
		xhr.setRequestHeader("accept", "application/json");
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState === XMLHttpRequest.DONE ) {
				if( window.self.handyStatusHandler(xhr, window.KEY_serverTime ) ) {
					var Treceive = new Date().getTime();
					var RTD =  Treceive - startTime;
					var Ts_est = JSON.parse(xhr.response).serverTime + RTD/2;
					var offset = Ts_est - Treceive;
					offsets.push(offset);
					window.backgroundStatus.offset = calculateOffset(offsets);
					window.self.handyServerTime(callback, remaining);
				} else {
					window.self.handyServerTime(callback, remaining);
				}
				if (callback && typeof(callback) === "function") callback();
			}
		};
		xhr.send();
	}
	
	syncServerTime() {
		window.self.handyServerTime(window.self.updateOverlay, 10);
	}
	
	
	cancelCurrentRequests() {
		for ( var i = 0 ; i < window.xhrRequests.length ; i++ ) window.xhrRequests[i].abort();
		clearTimeout(window.patternTimeout);
		window.xhrRequests = [];
	}

    stop() {
		window.self.cancelCurrentRequests();
        window.self.handyStop();
    }
	
	syncPrepare() {
		window.self.syncServerTime();
		window.self.uploadPatternFile();
		window.self.checkConnected();
		setInterval(window.self.uploadPatternFile, 45 * 60 * 1000);
	}

    uploadPatternFile() {
		fetch(chrome.runtime.getURL('/patterns.csv') )
		.then(
			function(response) {
			    response.text().then(function(patterns) {
					const csv = new File([patterns], 'patterns.csv', { type: 'text/csv' });
					const data = new FormData();
					data.append('syncFile', csv);
					fetch('https://www.handyfeeling.com/api/sync/upload', {
						method: 'POST',
						body: data,
					})
						.then(
							function(response) {
								if (response.status !== 200) {
									console.log('Error uploading patterns: ' + response.status);
									return;
								}

							// Examine the text in the response
								response.json().then(function(data) {
									if ( data.success ) {
										window.backgroundStatus.patternsUrl = data.url;
										window.self.updateOverlay();
									} else {
										console.log('Error uploading patterns: ' + response.status);
									}
								});
							}
						)
						.catch(function(err) {
							window.isSyncPreparing = false;
							console.log('Fetch Error :-S', err);
						});
							});
						}
					)
		.catch(function(err) {
			console.log('Fetch Error :-S', err);
		});
    }
		
    startAutomatic(level) {
		var levelEntry = window.levelMatrix[level];
		if ( levelEntry == undefined ) return;
		
		window.backgroundStatus.level = level;
		window.backgroundStatus.mode = 0;
		window.backgroundStatus.pattern = -1;
		window.backgroundStatus.strokeStart = levelEntry.strokeStart;
		window.backgroundStatus.strokeStop = levelEntry.strokeStop;
		window.backgroundStatus.velocity = levelEntry.velocity;
		window.self.sendMessageToContent( { "updateOverlay": window.backgroundStatus } );
		
		window.self.cancelCurrentRequests();
		if ( window.backgroundStatus.paused ) return;
		
		window.self.handyGetMode(function(mode) {
			if ( mode == 0 ) {
				window.self.handyStartSlide();
				window.self.handySetVelocity(levelEntry.velocity);
				window.self.handySetSlide(levelEntry.strokeStart, levelEntry.strokeStop);
			} else {
				window.self.handySetMode(0, function() {
					window.self.handyStartSlide();
					window.self.handySetVelocity(levelEntry.velocity);
					window.self.handySetSlide(levelEntry.strokeStart, levelEntry.strokeStop);
				});
			}
		});
	}
	
    setPattern(pattern) {
		var timeIndex = window.self.getPatternTime(pattern);
		if ( timeIndex == -1 ) return;
		
		window.backgroundStatus.level = -1;
		window.backgroundStatus.mode = 1;
		window.backgroundStatus.pattern = pattern;
		window.self.sendMessageToContent( { "updateOverlay": window.backgroundStatus } );
		
		var patternsUrl = 'https://raw.githubusercontent.com/Toddmccollam/handyex/main/patterns.csv';
		window.self.cancelCurrentRequests();
		if ( window.backgroundStatus.paused ) return;
		
		
		window.self.handyGetMode(function(mode) {
			if ( mode == 1 ) {
				window.self.handyHSSPPlay(timeIndex);
			} else {
				window.self.handySetMode(1, function() {
					window.self.handyGetSync(function() {
						window.self.handyHSSPSetup(patternsUrl, function() {	
							window.self.handySetSlide(0,100);				
							window.self.handyHSSPPlay(timeIndex);
						});
					});
				});
			}
		});
    }
	
	stopHandy() {
		window.self.cancelCurrentRequests();
		window.self.handyGetMode(function(mode) {
			switch ( mode ) {
				case 0:
					window.self.handyStopHAMP();
				break;
				case 1:
					window.self.handyStopHSSP();
				break;
			}
		});
	}
	
	stop() {
		// This is a stop message from chaturbate
		window.backgroundStatus.level = -1;
		window.backgroundStatus.mode = -1;
		window.backgroundStatus.pattern = -1;
		window.self.stopHandy();
		window.self.sendMessageToContent( { "updateOverlay": window.backgroundStatus } );
	}
	
	pause() {
		// This is a pause in the extension
		window.backgroundStatus.paused = !window.backgroundStatus.paused;
		chrome.runtime.sendMessage( [ 'update_popup' ] );
		if ( window.backgroundStatus.paused ) {
			window.self.stopHandy();
		} else {
			if ( window.backgroundStatus.mode ==  0 ) {
				window.self.startAutomatic(window.backgroundStatus.level);
			}
			if ( window.backgroundStatus.mode ==  1 ) {
				window.self.setPattern(window.backgroundStatus.pattern);
			}
		}
		window.self.sendMessageToContent( { "updateOverlay": window.backgroundStatus } );
	}
	
	sendMessageToContent(message, callback) {
		// I wonder if this can be linked back to the manifest list
		// query doesn't seem to accept regex expressions, so have to loop through urls
		const urls = ["*://testbed.cb.dev/b/*", "*://chaturbate.com/b/*"];
		for ( var i=0 ; i < urls.length; i++ ) {
			chrome.tabs.query({url: urls[i]}, function(tabs) { 
				for ( var j=0 ; j < tabs.length; j++ ) {
					chrome.tabs.sendMessage(tabs[j].id, message, callback);
				}
			});
		}
	}
	
	updateStatus(count) {
		window.backgroundStatus.contentScriptCount += count;
		window.self.checkConnected();
	}
	
	addErrorMessage(error) {
		var time = new Date();
		window.backgroundStatus.errorMessages.push( time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds() + ": " + error );
		if ( window.backgroundStatus.length > 3 ) window.backgroundStatus.shift();
		window.self.checkConnected();
	}
	
	updateOverlay() {
		window.self.sendMessageToContent( { "updateOverlay": window.backgroundStatus } );
	}
	
	checkConnected() {
		if ( window.backgroundStatus.contentScriptCount <= 0 ) return;
		var connected = window.backgroundStatus.handyConnected;
		window.self.handyGetConnected(function() {
			//if ( connected != window.backgroundStatus.handyConnected)
			window.self.updateOverlay();
		});
	}
}

new Background();