//------------------------------------------------------------------------------
// Helper class to handle the active cameras more easily between the camera used 
// for the character controller and the camera used for the cinematics.
class Camera {
    //--------------------------------------------------------------------------
    _mainCamera = null;

    //--------------------------------------------------------------------------
    get mainCamera() {
        return this._mainCamera;
    }

    //--------------------------------------------------------------------------
    async init() {
        this._mainCamera = SDK3DVerse.engineAPI.cameraAPI.getViewports()[0].getCamera();
        this._mainCamera.setComponent("camera", {dataJSON: {grid: false}});
    }

    //--------------------------------------------------------------------------
    async restoreMainCamera() {
        await this.setCamera(this.mainCamera);
    }

    //--------------------------------------------------------------------------
    async setCamera(camera) {
        await SDK3DVerse.setMainCamera(camera);
    }

    //--------------------------------------------------------------------------
    async playCinematicShot(startLabelComponent, destinationLabelComponent) {
        const viewport = SDK3DVerse.engineAPI.cameraAPI.getViewports()[0];

        const startTransform = startLabelComponent.camera;
        const startPosition = startTransform.slice(0, 3);
        const startOrientation = startTransform.slice(3, 7);

        const { speed } = destinationLabelComponent;
        const destinationTransform = destinationLabelComponent.camera;
        const destinationPosition = destinationTransform.slice(0, 3);
        const destinationOrientation = destinationTransform.slice(3, 7);
        await SDK3DVerse.engineAPI.cameraAPI.travel(viewport, destinationPosition, destinationOrientation, speed, startPosition, startOrientation);
    }
}

//------------------------------------------------------------------------------
const instance = new Camera();
export default instance;