var config = {attributes: false, childList: true, characterData: false};

var htmlBody = $("body")[0];

var ROOT_DIV_ID = "root_container_cbhandy_overlay";
var CSS_LINK_ID = "root_container_cbhandy_overlay_css";
var observing = false;
var debugMode = false; // Whether or not debug mode is on in chaturbate

window.addEventListener('load', () => {
    onContentScriptInitialized();
});

window.addEventListener('unload', () => {
    onContentScriptUnloaded();
});

function onContentScriptUnloaded() {
	chrome.runtime.sendMessage( [ "contentScriptUnloaded" ] );
}

function onContentScriptInitialized() {
    injectOverlayContent();
	chrome.runtime.sendMessage( [ "contentScriptInitialized" ] );
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if ( message.updateOverlay != undefined ) {
			updateOverlay( message.updateOverlay );
		}
	});
}

function removeOverlayContent() {
    var existingRootNode = document.getElementById(ROOT_DIV_ID);
    existingRootNode.remove();
}

function injectOverlayContent() {
	var existingRootNode = document.getElementById(ROOT_DIV_ID);
    if (existingRootNode) {
        return;
    }

	// injecting the html root
	fetch(chrome.runtime.getURL('/overlay.html') )
		.then(
			function(response) {
			    response.text().then(function(innerHTML) {
					var div = document.createElement("div");
					div.id = ROOT_DIV_ID;
					// inject styles directly so we don't get classname collisions or removing of style sheet
					div.style.pointerEvents = "none";
					div.style.width = "300px";
					div.style.height = "200px";
					div.style.position = "fixed";
					div.style.opacity = "0.75"; 
					div.style.zIndex = "1000000";
					div.style.display = "list-item";
					div.style.top = "2%";
					div.style.right = "2%";
					div.style.backgroundColor = "#D3D3D3";
					div.style.fontSize = "15px";
					div.innerHTML = innerHTML;
					document.body.appendChild(div);
				});
			}
		)
		.catch(function(err) {
			console.log('Fetch Error :-S', err);
		});
}

function updateSyncOverlay(backgroundStatus) {
	var syncNode = $("#syncStatusText");
	if ( syncNode ) {
		if ( backgroundStatus.offset != 0 && backgroundStatus.patternsUrl != undefined ) {
			syncNode.text('Synced');
			syncNode.css("color", "green");
		} else {
			syncNode.text('Unsynced');
			syncNode.css("color", "red");
		}
	}
}

function updateDebugOverlay() {
	var debugNode = $("#debugStatusText");
	if ( debugMode ) {
		debugNode.text('On');
		debugNode.css("color", "green");
	} else {
		debugNode.text('Off');
		debugNode.css("color", "red");
	}
}

function updateErrorOverlay(backgroundStatus) {
	for ( var i=0; i < backgroundStatus.errorMessages.length ; i++ )
		$('#errorMessageText'+i).text(backgroundStatus.errorMessages[i]);
}

function updateOverlay(backgroundStatus) {
	var statusNode = $('#handyStatusText');
	if ( statusNode != null ) {
		if ( backgroundStatus.connectionKey == undefined ) {
			statusNode.text('No Connection Key');
			statusNode.css("color", "red");
		} else {
			if ( ! backgroundStatus.handyConnected ) {
				statusNode.text('Disconnected');
				statusNode.css("color", "red");
			} else {
				if ( backgroundStatus.paused ) {
					statusNode.text('Paused');
					statusNode.css("color", "red");
				} else {
					statusNode.text('Connected');
					statusNode.css("color", "green");
				}
			}
		}
	}
	var chatboxNode = $('#chatboxStatusText');
	if ( chatboxNode != null ) {
		if ( backgroundStatus.contentScriptCount > 1 ) {
			chatboxNode.text('Multiple Tabs');
			chatboxNode.css("color", "red");
		} else {
			if ( observing ) {
				chatboxNode.text('Detected');
				chatboxNode.css("color", "green");
			} else {
				chatboxNode.text('Not Detected');
				chatboxNode.css("color", "green");
			}
		}
	}
	var actionNode = $('#actionStatusText');
	if ( actionNode != null ) {
		switch ( backgroundStatus.mode ) {
			case -1: 
				actionNode.text('Stopped');
			break;
			case 0: 
				actionNode.text('Level: ' + backgroundStatus.level + ' Strk:' + backgroundStatus.strokeStart + '-' +  
					backgroundStatus.strokeStop + ' Vel:' + backgroundStatus.velocity);
			break;
			case 1:
				actionNode.text('Pattern: ' + backgroundStatus.pattern);
			break;
			default:
				actionNode.text('Unknown');
			break;
		}
	}
	updateSyncOverlay(backgroundStatus);
	updateDebugOverlay();
	updateErrorOverlay(backgroundStatus);
}

function sendDebugMessage() {
	// This function isn't very robust. For one this isn't an API, chaturbate can change these elements
	// without notification. And for two we're assuming the first element in these arrays is the one we want.
	trySendDebug(1);
}
		 
var chatLoadedObserver = new MutationObserver(function (mutations, observer) {
    mutations.forEach(function (mutation) {
		chrome.storage.sync.get('broadcasterName', function(broadcasterName) {
			
			if ( broadcasterName == null ) {
				console.log('Broadcaster name = null');
				return;
			}
			console.log('Broadcaster name = ' + broadcasterName );
			sleep(2000);
			var chatSelector;
			chatSelector = $(".msg-list-fvm");
			var url = document.location.href;
			
			function sleep(ms) {
				return new Promise(resolve => setTimeout(resolve, ms));
			}
			
			sleep(500).then(() => {
				if (chatSelector.length > 0 && url.length > 0) {
					console.log('Chat window found' );
					// Select the node element.
					var target = chatSelector[0];
					var chatboxNode = document.getElementById('chatboxStatusText');
					if ( chatboxNode != null ) {
						chatboxNode.textContent = 'Detected';
						chatboxNode.style.color = 'green';
						console.log('status set' )
					} else {
						console.log('Failed to set status' )
						console.log(chatboxNode)
					}

					// Pass in the target node, as well as the observer options
					tipFinder.observe(target, config);
					// Unregister chatLoadedObserver. We don't need to check for the chat element anymore.
					observing = true;
					//sendDebugMessage();
					observer.disconnect();
				};
			});
		});
    })
});

chatLoadedObserver.observe(htmlBody, config);

// Tip Search
// Attach listener that acts when a new chat message appears.
var tipFinder = new MutationObserver(function (mutations) 
{
  // For each mutation object, we look for the addedNode object
    mutations.forEach(function (mutation) {
    // A chat message would be an added node
		mutation.addedNodes.forEach(function (addedNode) {
			var prefix = "DEBUG: ";
			/*
			if ( window.location.href.includes('testbed') ) {
				prefix = 'Debug: ';
			}
			*/
			const levelSuffix = 'Handy Set Level:';
			const patternSuffix = 'Handy Set Pattern:';
			const stopSuffix = 'Handy:Stop';
			
			// At this point it's potentially a chatMessage object.
			var chatMessage = $(addedNode);
			if ( addedNode.length <= 0) return;

			var innerText = chatMessage[0].innerText;
			if ( typeof(innerText) == 'string' ) {
				if ( innerText == "connection established") {
					sendDebugMessage();
				}
				if ( innerText == "You were disconnected because you have joined this room again." ) {
					observing = false;
				}
				if ( innerText == "Debug mode disabled." ) {
					debugMode = false;
					updateDebugOverlay();
				}
				if ( innerText == "Debug mode enabled. Type /debug again to disable." ) {
					debugMode = true;
					updateDebugOverlay();
				}
				if ( innerText.search(prefix) === 0 && innerText.search(stopSuffix) >= 0 ) {
					chrome.runtime.sendMessage( [ "setStop", speed ] )
				}
				if ( innerText.search(prefix) === 0 && innerText.search(levelSuffix) >= 0 ) {
					var level = innerText.slice(innerText.search(levelSuffix)+levelSuffix.length);
					chrome.runtime.sendMessage( [ "setLevel", level ] );
				}
				if ( innerText.search(prefix) === 0 && innerText.search(patternSuffix) >= 0 ) {
					var speed = innerText.slice(innerText.search(patternSuffix)+patternSuffix.length);
					chrome.runtime.sendMessage( [ "setPattern", speed ] );
				}
			}
			
		});
	});
});




