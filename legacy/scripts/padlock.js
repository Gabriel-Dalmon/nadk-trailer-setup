//----------------------------------------------------------------------------------
class Padlock {
    _lockEntity;
    _expectedCombination;
    _currentCombination;
    _currentCombinationTagIndex;
    _isLocked;

    //------------------------------------------------------------------------------
    get lockEntity() {
        return this._lockEntity;
    }

    //------------------------------------------------------------------------------
    get expectedCombination() {
        return this._expectedCombination;
    }

    //------------------------------------------------------------------------------
    get currentCombination() {
        return this._currentCombination;
    }

    set currentCombination(value) {
        this._currentCombination = value;
    }

    //------------------------------------------------------------------------------
    get isLocked() {
        return this._isLocked;
    }

    set isLocked(value) {
        this._isLocked = value;
    }

    //------------------------------------------------------------------------------
    bindControls() {
        /*document.getElementById("lock-modal").addEventListener('click', (event) => {
            event.stopPropagation();
        });*/

        // Add event listeners to the lock inputs to call the onLockInputUpdated 
        // method when one of the combination value changes.
        const domLockInputs = document.getElementsByClassName("lock-input");
        for( lockInput of domLockInputs) {
            lockInput.addEventListener("input", this.onLockInputUpdated);
        }
        
        // Add event listener to the lock modal container to close the lock modal
        // when the user clicks outside of the modal.
        document.getElementById("lock-modal-container").addEventListener('click', () => {
            document.getElementById("lock-modal").parentNode.classList.remove('active');
            lockPointer();
            SDK3DVerse.engineAPI.assignClientToScripts(characterController);
        });
    
        const incrementArrows = document.getElementsByClassName('increment-arrow');
        for (let i = 0; i < incrementArrows.length; i++) {
            incrementArrows[i].addEventListener('click', (event) => {
                const input = document.getElementById('lock-input-'+(i+1).toString());
                input.value = (parseInt(input.value) + 1) % 10;
                input.dispatchEvent(new Event('input'));
            });
        }
    
        const decrementArrows = document.getElementsByClassName('decrement-arrow');
        for (let i = 0; i < decrementArrows.length; i++) {
            decrementArrows[i].addEventListener('click', (event) => {
                const input = document.getElementById('lock-input-'+(i+1).toString());
                input.value = (parseInt(input.value) - 1) % 10;
                input.dispatchEvent(new InputEvent('input'));
            });
        }
    };

    //------------------------------------------------------------------------------
    unbindControls() {
        
    }

    //------------------------------------------------------------------------------
    enter(lockEntity) {
        this._lockEntity = lockEntity;
        const tags = this._lockEntity.getComponent("tags").value;
        this._expectedCombination = tags.find(tag => tag.startsWith("expectedCombination:") === true).split(":")[1];
        this._currentCombinationTagIndex = tags.findIndex(tag => tag.startsWith("expectedCombination:"));
        this._currentCombination = tags[this._currentCombinationTagIndex].split(":")[1];
        this._isLocked = tags.includes("unlocked") ? false : true;

        this.showLockModal();
    }

    //----------------------------------------------------------------------------------
    exit() {
        this.updateTags();
        this._lockEntity = null;
        this._expectedCombination = null;
        this._currentCombination = null;
        this._currentCombinationTagIndex = null;
        this._isLocked = null;

        this.hideLockModal();
    }

    //------------------------------------------------------------------------------
    onLockInputUpdated() {
        const inputs = Array.from(document.getElementsByClassName("lock-input"));
        const currentCombination = inputs.reduce((acc, input) => acc + input.value, "");
        this.currentCombination = currentCombination;
        this.updateTags();
    }

    //------------------------------------------------------------------------------
    
    async checkLockCode(characterController) {
        var code = "1234"; // Replace with your correct code
        var input1 = document.getElementById("lock-input-1").value;
        var input2 = document.getElementById("lock-input-2").value;
        var input3 = document.getElementById("lock-input-3").value;
        var input4 = document.getElementById("lock-input-4").value;

        //concat the code
        var enteredCode = input1 + input2 + input3 + input4;

        if (enteredCode === code) {
            document.getElementById("lock-modal").parentNode.classList.remove('active');
            lockPointer();
            SDK3DVerse.engineAPI.assignClientToScripts(characterController);
            const chestSceneEntity = await SDK3DVerse.engineAPI.findEntitiesByNames('chest');
            await SDK3DVerse.engineAPI.playAnimationSequence("a16461db-aa16-4e2e-8cb0-fe123a6d8d7c", { playbackSpeed: 1, seekOffset: 0 }, chestSceneEntity[0]);
        } else {
            console.log("Code is incorrect!");
        }
    }


    //------------------------------------------------------------------------------
    // This probably doesn't work because of the weird behavior state entity
    // components have. It will probably only affect the client this function was 
    // called on.
    updateTags() {
        const tags = SDK3DVerse.utils.clone(this._lockEntity.getComponent("tags").value);

        // Update the current combination
        const currentCombinationTagIndex = tags.findIndex(tag => tag.startsWith("expectedCombination:"));
        tags[currentCombinationTagIndex] = `currentCombination:${this._currentCombination}`;

        // Update the current lock state, by removing or adding the "unlocked" tag.
        if(_isLocked === true && tags.includes("unlocked") === true) {
            tags.splice(tags.indexOf("unlocked"), 1);
        } else if(_isLocked === false && tags.includes("unlocked") === false) {
            tags.push("unlocked");
        }

        this.lockEntity.setComponent("tags", tags);
    }

    //------------------------------------------------------------------------------
    showLockModal(characterController) {
        document.getElementById("lock-modal").parentNode.classList.add('active');
        SDK3DVerse.engineAPI.detachClientFromScripts(characterController);
        unlockPointer();
    }

    //------------------------------------------------------------------------------
    hideLockModal() {
        document.getElementById("lock-modal").parentNode.classList.remove('active');
    }

}