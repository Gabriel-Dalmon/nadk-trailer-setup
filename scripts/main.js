//------------------------------------------------------------------------------
import config from "../config.js";

import Camera from "./camera.js";

import CharacterController from "./character-controller.js";

import { lockPointer } from "./utils.js";

import { 
  initDeviceDetection, 
  initControlKeySettings, 
  openSettingsModal,
  closeSettingsModal
} from "./settings.js";


//------------------------------------------------------------------------------
class App {

    _preloadAppPromise = null;

    //--------------------------------------------------------------------------
    // Initializes the main menu and starts joining the session.
    initApp() {    
        // Directly load the app to reduce loading times when the user clicks the
        // start button.
        this._preloadAppPromise = this.preloadApp();

        // When the user clicks the start button, we hide the main menu and wait 
        // for the session to be joined before calling startGame() to execute the 
        // game logic.
        document.getElementById("start-button").addEventListener('click', () => {
            document.getElementById("main-menu").classList.remove('active');
            this._preloadAppPromise.then(async () => {
                await this.startGame();
            });
        });
        
        // Initialize all browser events that are not session dependent.

        // TODO : We can take back the code from an old version of the fpcc 
        // template to dynamically load the keys from the actionMap directly.
        initControlKeySettings();


    }
    
    //--------------------------------------------------------------------------
    async preloadApp() {
        const canvas = document.getElementById("display-canvas");
        const sessionParameters = {
            userToken: config.accessIDs.publicToken,
            sceneUUID: config.accessIDs.mainSceneUUID,
            canvas: canvas,
            createDefaultCamera: true,
            showLoadingOverlay: false,
            connectToEditor: true,
            isTransient: true,
            onFindingSession: () => ChangeLoadingInfo("Looking for sessions..."),
            onStartingStreamer: () => ChangeLoadingInfo("Starting streamer..."),
            onLoadingAssets: () => ChangeLoadingInfo("Loading assets..."),
        };
        const isCreator = await SDK3DVerse.joinOrStartSession(sessionParameters);

        Camera.init();

        initDeviceDetection();
        initPointerLockEvents();
        initSettingsModalEvents();
        
        // Users are considered inactive after 5 minutes of inactivity and are
        // kicked after 30 seconds of inactivity. Setting an inactivity callback 
        // with a 30 seconds cooldown allows us to open a popup when the user gets
        // disconnected.
        SDK3DVerse.setInactivityCallback(showInactivityPopup);

        // The following does the same but in case the disconnection is 
        // requested by the server.
        SDK3DVerse.notifier.on("onConnectionClosed", this.onConnectionClosed);

        document.addEventListener('keydown', async (event) => {
            if(event.code === 'KeyF') {
                playFinalAnimation();
            }
        });
    }

    //--------------------------------------------------------------------------
    // TODO : Refactor into a cleaner management of both scenarios when the 
    // simulation has started and when it hasn't.
    async startGame() {
        if(this._preloadAppPromise === null) {
            closeDisconnectedPopup();
            closeInactivityPopup();
            await this.preloadApp();
        }
        this._preloadAppPromise = null;

        // Small hack to detect if the simulation is already started, there must 
        // be a better way to do this.
        const simulationStateEntity = (await SDK3DVerse.engineAPI.findEntitiesByNames("simulationStarted"))[0];
        if(simulationStateEntity === null) { // if simulation is not started yet

            // We purposedly wait before starting the simulation as it looks 
            // like there is still some conflict between texture loading and 
            // simulation starting. Should not be necessary on projects with
            // less or smaller textures
            ChangeLoadingInfo("Loading textures...")
            setTimeout(async () => {
                // Find entity by name "simulationOn"
                SDK3DVerse.engineAPI.startSimulation();
                ChangeLoadingInfo("Instantiating character controller...")
                const simulationStartedIndicator = new SDK3DVerse.EntityTemplate();
                await simulationStartedIndicator.instantiateTransientEntity(
                    "simulationStarted",
                    null,
                    false
                );
                ChangeLoadingInfo("Initializing character controller...")
                await CharacterController.init();
                ChangeLoadingInfo("Entering character controller...")
                await CharacterController.enter();
                await CharacterController.adjustDeviceSensitivity();
                document.getElementById("loading-screen").classList.remove('active');
            }, 9000);
        } else {
            // TODO : Setup a proper cinematic system that fetches the label entities 
            ChangeLoadingInfo("Loading cinematics...")
            const startLabel = (await SDK3DVerse.engineAPI.findEntitiesByEUID("ecbf7e22-5de9-4095-a202-17f7dc9d5a49"))[0].getComponent("label");
            const destinationLabel = (await SDK3DVerse.engineAPI.findEntitiesByEUID("2d48f684-6d41-4baa-adcc-f7219657f1c1"))[0].getComponent("label");
            const label3 = (await SDK3DVerse.engineAPI.findEntitiesByEUID("d612ce17-cad7-4b4a-a1b1-7a5541d0dc90"))[0].getComponent("label");
            const label4 = (await SDK3DVerse.engineAPI.findEntitiesByEUID("4ed5219c-a4ed-435c-b829-471219cce924"))[0].getComponent("label");
            let characterControllerInited = CharacterController.init();
            // When the cinematic data is retrieved, we hide the loading screen and play the cinematic shots.
            document.getElementById("loading-screen").classList.remove('active');
            await Camera.playCinematicShot(startLabel, destinationLabel);
            await Camera.playCinematicShot(label3, label4);
            characterControllerInited.then(() => {CharacterController.enter();});
        }
    }

    onConnectionClosed() {
        this._preloadAppPromise = null;
        showDisconnectedPopup();
    }
}


//------------------------------------------------------------------------------
// TODO : Bind with game logic instead of keybinding
async function playFinalAnimation() {
    const helicopterSceneEntity = await SDK3DVerse.engineAPI.findEntitiesByNames('helicopter');
    const helicopterMovementAnimScene = await SDK3DVerse.engineAPI.findEntitiesByNames('Amphitheatre + Props');
    await SDK3DVerse.engineAPI.playAnimationSequence("60be1b11-d192-42ce-913d-9ef930750ec9", { playbackSpeed: 0.5, seekOffset: 0 }, helicopterSceneEntity[0]);
    await SDK3DVerse.engineAPI.playAnimationSequence("46e60a89-f1ba-4f24-8b88-ee82a879cd70",{ playbackSpeed: 1, seekOffset: 0 }, helicopterMovementAnimScene[0])
    setTimeout(async()=>{await SDK3DVerse.engineAPI.playAnimationSequence("60be1b11-d192-42ce-913d-9ef930750ec9", { playbackSpeed: 1, seekOffset: 12 }, helicopterSceneEntity[0]);}, 500);
    setTimeout(async()=>{await SDK3DVerse.engineAPI.playAnimationSequence("60be1b11-d192-42ce-913d-9ef930750ec9", { playbackSpeed: 1.5, seekOffset: 41 }, helicopterSceneEntity[0]);}, 1500);
}

//------------------------------------------------------------------------------
async function ChangeLoadingInfo(newInfo) {
    document.getElementById("loading-info").innerHTML = newInfo;
  }

//------------------------------------------------------------------------------
function showInactivityPopup() {
    document.getElementById("resume").addEventListener('click', closeInactivityPopup);
    document.getElementById("inactivity-modal").parentNode.classList.add('active');
}

//------------------------------------------------------------------------------
function closeInactivityPopup() {
    document.getElementById("resume").removeEventListener('click', closeInactivityPopup);
    document.getElementById("inactivity-modal").parentNode.classList.remove('active');
}

//------------------------------------------------------------------------------
function showDisconnectedPopup() {
    // TODO : Make show and close DiconnectedPoput use the same reference to 
    // add/remove the reloadPage event listener.
    const reloadPage = window.location.reload.bind(window.location);
    document.getElementById("reload-session").addEventListener('click', reloadPage);
    document.getElementById("disconnected-modal").parentNode.classList.add('active');
}

//------------------------------------------------------------------------------
function closeDisconnectedPopup() {
    document.getElementById("reload-session").removeEventListener('click', window.location.reload);
    document.getElementById("disconnected-modal").parentNode.classList.remove('active');
}

//------------------------------------------------------------------------------
function initPointerLockEvents() {
    // Web browsers have a safety mechanism preventing the pointerlock to be
    // instantly requested after being naturally exited, if the user tries to
    // relock the pointer too quickly, we wait a second before requesting 
    // pointer lock again.
    document.addEventListener('pointerlockerror', async () => {
        if (document.pointerLockElement === null) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await lockPointer();
        }
    });
}

//------------------------------------------------------------------------------
function initSettingsModalEvents() {
    const closeSettingsButton = document.getElementById("close-settings");
    closeSettingsButton.addEventListener('click', () => {
        closeSettingsModal();
        SDK3DVerse.enableInputs();
    });

    // If the user leaves the pointerlock, we open the settings popup and
    // disable their influence over the character controller.
    document.addEventListener('keydown', handleKeyDown);
}

function handleKeyDown(event) {
    if(event.code === 'Escape') {
        const settingsContainer = document.getElementById("settings-modal").parentNode;
        if(settingsContainer.classList.contains('active')) {
            closeSettingsModal();
            SDK3DVerse.enableInputs();
        } else {
            SDK3DVerse.disableInputs();
            openSettingsModal();
        }
    }
}

//------------------------------------------------------------------------------
const instance = new App();
export default instance;
instance.initApp = instance.initApp.bind(instance);
window.addEventListener("load", instance.initApp);