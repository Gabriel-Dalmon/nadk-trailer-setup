import Camera from "./camera.js";
import config from "../config.js";
import { lockPointer, unlockPointer, getSensitivity } from "./utils.js";
//------------------------------------------------------------------------------
class CharacterController {

    //--------------------------------------------------------------------------
    _controllerEntity = null;
    _lampEntity = null;
    _isLampOn = false;
    _cameraEntity = null;
    _isActive = false;

    _highlightedEntity = null;
    _highlightInteractableInterval = null;

    //--------------------------------------------------------------------------
    get controllerEntity() {
        return this._controllerEntity;
    }

    //--------------------------------------------------------------------------
    get lampEntity() {
        return this._lampEntity;
    }

    //--------------------------------------------------------------------------
    get cameraEntity() {
        return this._cameraEntity;
    }

    //--------------------------------------------------------------------------
    get isLampOn() {
        return this._isLampOn;
    }

    //--------------------------------------------------------------------------
    get isActive() {
        return this._isActive;
    }

    set isActive(value) {
        this._isActive = value;
    }

    //--------------------------------------------------------------------------
    get highlightedEntity() {
        return this._highlightedEntity;
    }

    set highlightedEntity(value) {
        this._highlightedEntity = value;
    }

    //--------------------------------------------------------------------------
    async init() {
        const playerTemplate = new SDK3DVerse.EntityTemplate();
        const sceneUUID = config.accessIDs.characterControllerSceneUUID;
        const spawnPosition = [19, 11.4, 0];
        playerTemplate.attachComponent("scene_ref", { value: sceneUUID });
        playerTemplate.attachComponent("local_transform", { position: spawnPosition });
        const parentEntity = null; // null = root of the main scene
        const deleteOnClientDisconnection = true;
        const playerSceneLinker = await playerTemplate.instantiateTransientEntity(
            "Player",
            parentEntity,
            deleteOnClientDisconnection
        );
        
        // The character controller scene is setup as having a single entity at its
        // root which is the first person controller itself.
        this._controllerEntity = (await playerSceneLinker.getChildren())[0];

        // Initialize the character controller server side asset script. 
        SDK3DVerse.engineAPI.fireEvent(
            "a25ea293-d682-45d3-962f-bd63e870a7d3", 
            "call_constructor", 
            [this.controllerEntity]
        );

        await this.loadChildren();
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
    }

    //--------------------------------------------------------------------------
    /**
     * Gets cameraEntity and lampEntity from the character controller entity
     * and makes them accessible through class fields.
     * @returns
     */
    async loadChildren() {
        if(!this.controllerEntity) {
            return;
        }
        const children = await this.controllerEntity.getChildren();
        for(let child of children) {
            if(child.isAttached("camera")) {
                this._cameraEntity = child;
                this._lampEntity = (await this.cameraEntity.getChildren())[0];
            }
        };
        console.log(this.cameraEntity, this.lampEntity, this.controllerEntity, (await this.cameraEntity).getChildren());
    }

    //--------------------------------------------------------------------------
    /**
     * Bind character controller controls.
     * @returns
     */
    async bindControls() {
        // Assign the client to the server-side asset scripts of the character 
        // controller entity.
        SDK3DVerse.engineAPI.assignClientToScripts(this.controllerEntity);

        // Adjust the action map controls for the character controller.
        SDK3DVerse.actionMap.values["JUMP"] = [["KEY_32"]];
        SDK3DVerse.actionMap.values["SPRINT"] = [["KEY_16"]];
        // Moving the mouse will control the camera without the need of more 
        // actions.
        SDK3DVerse.actionMap.values["LOOK_LEFT"][0] = ["MOUSE_AXIS_X_POS"];
        SDK3DVerse.actionMap.values["LOOK_RIGHT"][0] = ["MOUSE_AXIS_X_NEG"];
        SDK3DVerse.actionMap.values["LOOK_DOWN"][0] = ["MOUSE_AXIS_Y_NEG"];
        SDK3DVerse.actionMap.values["LOOK_UP"][0] = ["MOUSE_AXIS_Y_POS"];
        SDK3DVerse.actionMap.propagate();

        // Bind the character controller actions to the client side events.
        document.addEventListener('keydown', this.handleKeyDown);

        // Lock the mouse pointer
        lockPointer();

        const canvas = document.getElementById("display-canvas");
        this._highlightInteractableInterval = setInterval(async () => {
            this.highlightInteractable(canvas)
        }, 400);

        // Could be canvas.addEventListener('mousedown', this.interact) 
        // instead. Would need to retrieve the canvas reference, but maybe 
        // it brings more advantages/clarity than what it costs.
        document.addEventListener('mousedown', this.interact);
    }

    //--------------------------------------------------------------------------
    /**
     * Unbind character controller controls.
     * @returns
     */
    async unbindControls() {
        // Detach the client from the server-side asset scripts of the character
        // controller entity.
        SDK3DVerse.engineAPI.detachClientFromScripts(this.controllerEntity);
        document.removeEventListener('keydown', this.handleKeyDown);

        // Unlock the mouse pointer
        unlockPointer();

        clearInterval(this._highlightInteractableInterval);

        // Unselect the highlighted entity if there is one.
        this.highlightedEntity?.unselect();
        this.highlightedEntity = null;

        document.removeEventListener('mousedown', this.interact);
    }


    //--------------------------------------------------------------------------
    /**
     * To toggle the character's lamp on and off.
     * @returns
     */
    async toggleLamp() {
        if (!this.isActive) {
            return;
        }
        this.lampEntity.setComponent("point_light", {intensity: this.isLampOn ? 0 : 10});
        this._isLampOn = !this.isLampOn;
    }

    //--------------------------------------------------------------------------
    /**
     * Handle keydown events for the character controller.
     */
    async handleKeyDown(event) {
        if (event.code === "KeyE") {
            this.toggleLamp();
        }
    }

    //--------------------------------------------------------------------------
    /**
     * Handle mousedown events for the character controller.
     */
    async handleMouseDown(event) {
        if (event.button === 0) {
            this.interact();
        }
    }

    //--------------------------------------------------------------------------
    /**
     * Highlight the interactable object that the player is looking at.
     * @returns
     */
    async highlightInteractable(canvas) {
        const [selectEntity, keepOldSelection, seekExternalLinker] = [false, false, false];
        const { entity } = await SDK3DVerse.engineAPI.castScreenSpaceRay(
            canvas.width/2, 
            canvas.height/2, 
            selectEntity, 
            keepOldSelection, 
            seekExternalLinker
        );
        if(entity && entity.isAttached("tags")) {
            const tags = entity.getComponent("tags").value;
            if(tags.includes("interactable")){
                entity.select(keepOldSelection);
                this.highlightedEntity = entity
                return;
            }
        }
        // No interactable entity detected, unselect the highlighted entity.
        this.highlightedEntity?.unselect();
        this.highlightedEntity = null;
    }
    
    //--------------------------------------------------------------------------
    /**
     * Interact with the highlighted entity.
     */
    async interact() {
        /*if(this.highlightedEntity === null) {
            return;
        }
        const scriptMapComponent = this.highlightedEntity.getComponent('script_map'); // Will probably not be needed anymore if the script is placed on the characterController directly.
        if(this.highlightedEntity.isAttached("tags")){//scriptMapComponent && "a5ef8dfe-8b72-497c-97b7-2e65a211d6fe" in scriptMapComponent.elements) {
            let entity = (await SDK3DVerse.engineAPI.findEntitiesByEUID("9fa45d12-24cd-4b4c-b2f1-c875336efc4a"))[0];
            SDK3DVerse.engineAPI.assignClientToScripts(entity);
            SDK3DVerse.engineAPI.detachClientFromScripts(characterController);
            SDK3DVerse.actionMap.values["LOOK_LEFT"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_X_POS"];
            SDK3DVerse.actionMap.values["LOOK_RIGHT"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_X_NEG"];
            SDK3DVerse.actionMap.values["LOOK_DOWN"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_Y_NEG"];
            SDK3DVerse.actionMap.values["LOOK_UP"][0] = ["MOUSE_BTN_LEFT","MOUSE_AXIS_Y_POS"];
            SDK3DVerse.actionMap.propagate();
            SDK3DVerse.engineAPI.fireEvent("191b5072-b834-40f0-a616-88a6fc2bd7a3", "enter_interaction", [entity]);
            canvas.addEventListener('mouseup', unlockPointer);
        }
        else if (objectClicked.entity.getComponent("debug_name").value === "Code") {
            showLockModal(characterController);
        }*/
    }

    //------------------------------------------------------------------------------
    adjustDeviceSensitivity() {
        // We recover the device and the sensitivity from the settings modal inputs.
        const sensitivitySetting = getSensitivity();
        
        // We adjust the sensitivity depending on the device. The joysticks on 
        // gamepads produce less sensitive values than the mouse. The new 
        // sensitivity for gamepad has to be higher. Around ~0.x sensitivity for 
        // mouse and ~x.0 for gamepad within the current asset script for character 
        // controller camera management.
        let newSensitivity;
        const device = "mouse"; // Should update device place
        if(device ===  "gamepad"){
            newSensitivity = sensitivitySetting / 5;
        } else { //if(device === "mouse"){
            newSensitivity = sensitivitySetting / 100;
        }

        // We update the inputs of the Asset Script attached to the character 
        // controller, specifically the sensitivity. Asset Scripts inputs are 
        // accessed through the "script_map" component of an entity.
        const characterControllerScriptUUID = Object.keys(this.controllerEntity.getComponent("script_map").elements)[0];
        this.controllerEntity.setScriptInputValues(
            characterControllerScriptUUID, 
            {
                sensitivity: newSensitivity,
            }
        );
    }

    //--------------------------------------------------------------------------
    /**
     * To enter the character controller, call CharacterController.exit() when
     * leaving character controller view mode.
     * @returns
     */
    async enter() {
        if (this.isActive) {
            return;
        }
        if (!this.controllerEntity) {
            await this.init();
        }
        await Camera.setCamera(this.cameraEntity);
        await this.bindControls();
        this.isActive = true;
    }

    //--------------------------------------------------------------------------
    /**
     * To exit the character controller cleanly, detachingFromScripts and setup
     * its state for the next time it is entered.
     * @param changeMainCamera - If true, the main camera will be set to
     * Camera.mainCamera.
     * @param hide - If true, the character controller entity will be hidden.
     * @returns
     */
    async exit() {
        // isActive also prevents to call exit when the controller is not intantiated
        if (this.isActive === false) {
            return;
        }
        this.lastCameraGlobalTransform = Helper.viewport.getGlobalTransform();
        Helper.engineAPI.detachClientFromScripts(this.controllerEntity);
        this.isActive = false;
    }

}

const instance = new CharacterController();
export default instance;