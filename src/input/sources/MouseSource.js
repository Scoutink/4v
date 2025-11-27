/**
 * MouseSource - Mouse input handler with Babylon.js integration
 *
 * @class MouseSource
 * @extends InputSource
 *
 * @description
 * Listens to mouse events and integrates with Babylon.js for 3D picking.
 *
 * Features:
 * - Click detection (left, right, middle buttons)
 * - Mouse movement with delta tracking
 * - Mouse wheel scrolling
 * - Raycast integration for 3D object picking
 * - Pointer lock support
 * - Button state tracking
 *
 * Input Formats:
 *
 * Click:
 * {
 *     source: 'mouse',
 *     input: 'LeftClick' | 'RightClick' | 'MiddleClick',
 *     state: 'pressed' | 'released',
 *     position: { x, y },
 *     hitInfo: { hit, pickedMesh, pickedPoint, distance },
 *     originalEvent: PointerEvent
 * }
 *
 * Move:
 * {
 *     source: 'mouse',
 *     input: 'MouseMove',
 *     state: 'moved',
 *     position: { x, y },
 *     delta: { x, y },
 *     originalEvent: MouseEvent
 * }
 *
 * Wheel:
 * {
 *     source: 'mouse',
 *     input: 'MouseWheel',
 *     state: 'scrolled',
 *     value: number (deltaY),
 *     originalEvent: WheelEvent
 * }
 *
 * @example
 * const mouseSource = new MouseSource(inputManager, scene, canvas);
 *
 * @tags [INP.3]
 * @version 1.0.0
 */

import InputSource from './InputSource.js';

export default class MouseSource extends InputSource {
    /**
     * [INP.3] Constructor - Initialize mouse listeners
     *
     * @param {InputManager} inputManager - Reference to InputManager
     * @param {BABYLON.Scene} scene - Babylon.js scene for raycasting
     * @param {HTMLCanvasElement} canvas - Render canvas
     */
    constructor(inputManager, scene, canvas) {
        super(inputManager, 'mouse');

        // [INP.3.1] Core references
        this.scene = scene;
        this.canvas = canvas;

        // [INP.3.2] Mouse state
        this.position = { x: 0, y: 0 };
        this.deltaPosition = { x: 0, y: 0 };
        this.buttons = new Set(); // Currently pressed buttons

        // [INP.3.2.1] Click detection state
        // Used to distinguish between click, double-click, drag, and hold
        this.clickStartPosition = null;  // Where button was pressed
        this.clickStartTime = null;      // When button was pressed
        this.lastClickTime = null;       // Last click time (for double-click)
        this.lastClickButton = null;     // Last button clicked (for double-click)
        this.isDragging = false;         // Is user currently dragging?
        this.holdTimer = null;           // Timer for hold detection

        // [INP.3.2.2] Detection thresholds (tuned for good UX)
        this.dragThreshold = 5;          // Pixels - ignore hand shake/tiny movements
        this.doubleClickWindow = 300;    // Milliseconds - time window for double-click
        this.holdThreshold = 500;        // Milliseconds - time before it's a "hold"

        // [INP.3.3] Bind event handlers
        this.handlePointer = this.handlePointer.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);

        // [INP.3.4] Register Babylon.js pointer observable
        if (this.scene) {
            this.pointerObserver = this.scene.onPointerObservable.add(
                this.handlePointer
            );
        }

        // [INP.3.5] Register DOM event listeners
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });

        // [INP.3.6] Prevent context menu on right-click
        // This allows right-click+drag for camera rotation without context menu interruption
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);

        console.log('[INP.3] MouseSource ready');
    }

    /**
     * [INP.3] Handle Babylon.js pointer events
     *
     * Babylon's pointer system gives us clicks and raycast results.
     *
     * @param {BABYLON.PointerInfo} pointerInfo - Babylon pointer info
     */
    handlePointer(pointerInfo) {
        const type = pointerInfo.type;
        const event = pointerInfo.event;

        switch (type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
                this.handlePointerDown(pointerInfo);
                break;

            case BABYLON.PointerEventTypes.POINTERUP:
                this.handlePointerUp(pointerInfo);
                break;

            case BABYLON.PointerEventTypes.POINTERPICK:
                // POINTERPICK only fires on actual clicks (not drags)
                // Babylon automatically distinguishes click from drag
                this.handlePointerPick(pointerInfo);
                break;

            case BABYLON.PointerEventTypes.POINTERMOVE:
                // We handle movement via DOM mousemove for smoother tracking
                break;
        }
    }

    /**
     * [INP.3] Handle pointer down (mouse button press)
     *
     * @param {BABYLON.PointerInfo} pointerInfo - Babylon pointer info
     */
    handlePointerDown(pointerInfo) {
        const event = pointerInfo.event;
        const button = event.button;
        const buttonName = this.getButtonName(button);

        // [INP.3.1] Track button state
        this.buttons.add(buttonName);

        // [INP.3.1.1] Record click start for drag detection
        this.clickStartPosition = {
            x: this.scene.pointerX,
            y: this.scene.pointerY
        };
        this.clickStartTime = performance.now();
        this.isDragging = false;

        // [INP.3.1.2] Start hold timer
        // If button is held for > holdThreshold ms without dragging, it's a "hold"
        this.holdTimer = setTimeout(() => {
            if (!this.isDragging && this.buttons.has(buttonName)) {
                // Send hold event
                this.sendInput({
                    source: 'mouse',
                    input: buttonName + 'Hold',
                    state: 'held',
                    position: {
                        x: this.scene.pointerX,
                        y: this.scene.pointerY
                    },
                    duration: performance.now() - this.clickStartTime,
                    originalEvent: event
                });
            }
        }, this.holdThreshold);

        // [INP.3.2] Perform raycast to get 3D hit info
        const pickInfo = this.scene.pick(
            this.scene.pointerX,
            this.scene.pointerY
        );

        // [INP.3.3] Send button pressed event to InputManager
        this.sendInput({
            source: 'mouse',
            input: buttonName,
            state: 'pressed',
            position: {
                x: this.scene.pointerX,
                y: this.scene.pointerY
            },
            hitInfo: {
                hit: pickInfo.hit,
                pickedMesh: pickInfo.pickedMesh,
                pickedPoint: pickInfo.pickedPoint,
                distance: pickInfo.distance,
                faceId: pickInfo.faceId,
                normal: pickInfo.getNormal ? pickInfo.getNormal() : null
            },
            originalEvent: event
        });
    }

    /**
     * [INP.3] Handle pointer pick (actual click event)
     *
     * POINTERPICK only fires when user clicks (not drags).
     * Babylon automatically distinguishes click from drag.
     *
     * @param {BABYLON.PointerInfo} pointerInfo - Babylon pointer info with pickInfo
     */
    handlePointerPick(pointerInfo) {
        const event = pointerInfo.event;
        const button = event.button;
        const buttonName = this.getButtonName(button);
        const pickInfo = pointerInfo.pickInfo;

        // [INP.3.1] Detect double-click
        let isDoubleClick = false;
        if (this.lastClickTime && this.lastClickButton === buttonName) {
            const timeSinceLastClick = performance.now() - this.lastClickTime;
            if (timeSinceLastClick < this.doubleClickWindow) {
                isDoubleClick = true;
            }
        }

        // [INP.3.2] Update last click time for double-click detection
        this.lastClickTime = performance.now();
        this.lastClickButton = buttonName;

        // [INP.3.3] Send appropriate click event to InputManager
        if (isDoubleClick) {
            // Send double-click event
            this.sendInput({
                source: 'mouse',
                input: buttonName + 'Double',
                state: 'double-clicked',
                position: {
                    x: this.scene.pointerX,
                    y: this.scene.pointerY
                },
                hitInfo: {
                    hit: pickInfo.hit,
                    pickedMesh: pickInfo.pickedMesh,
                    pickedPoint: pickInfo.pickedPoint,
                    distance: pickInfo.distance,
                    faceId: pickInfo.faceId,
                    normal: pickInfo.getNormal ? pickInfo.getNormal() : null
                },
                originalEvent: event
            });
        } else {
            // Send single click event
            this.sendInput({
                source: 'mouse',
                input: buttonName,
                state: 'clicked',
                position: {
                    x: this.scene.pointerX,
                    y: this.scene.pointerY
                },
                hitInfo: {
                    hit: pickInfo.hit,
                    pickedMesh: pickInfo.pickedMesh,
                    pickedPoint: pickInfo.pickedPoint,
                    distance: pickInfo.distance,
                    faceId: pickInfo.faceId,
                    normal: pickInfo.getNormal ? pickInfo.getNormal() : null
                },
                originalEvent: event
            });
        }
    }

    /**
     * [INP.3] Handle pointer up (mouse button release)
     *
     * @param {BABYLON.PointerInfo} pointerInfo - Babylon pointer info
     */
    handlePointerUp(pointerInfo) {
        const event = pointerInfo.event;
        const button = event.button;
        const buttonName = this.getButtonName(button);

        // [INP.3.1] Clear hold timer
        if (this.holdTimer) {
            clearTimeout(this.holdTimer);
            this.holdTimer = null;
        }

        // [INP.3.2] Calculate click duration
        const clickDuration = this.clickStartTime ? performance.now() - this.clickStartTime : 0;

        // [INP.3.3] Remove from button state
        this.buttons.delete(buttonName);

        // [INP.3.4] Send button released event if was dragging
        // Note: Click events are now handled by POINTERPICK, not here
        if (this.isDragging) {
            this.sendInput({
                source: 'mouse',
                input: buttonName,
                state: 'released',
                position: {
                    x: this.scene.pointerX,
                    y: this.scene.pointerY
                },
                duration: clickDuration,
                wasDragging: true,
                originalEvent: event
            });
        }

        // [INP.3.5] Reset drag state
        this.clickStartPosition = null;
        this.clickStartTime = null;
        this.isDragging = false;
    }

    /**
     * [INP.3] Handle mouse move
     *
     * Using DOM mousemove instead of Babylon's for smoother tracking.
     *
     * IMPORTANT: Only sends MouseMove when a mouse button is held.
     * This prevents unwanted camera rotation when just moving the cursor.
     *
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        // [INP.3.1] Update position
        const previousPosition = { ...this.position };
        this.position.x = event.clientX;
        this.position.y = event.clientY;

        // [INP.3.2] Calculate delta (movement since last frame)
        this.deltaPosition.x = event.movementX;
        this.deltaPosition.y = event.movementY;

        // [INP.3.3] Check if we should detect dragging
        if (this.clickStartPosition && !this.isDragging) {
            // Button is held but we haven't started dragging yet
            // Calculate distance from click start position
            const dx = this.position.x - this.clickStartPosition.x;
            const dy = this.position.y - this.clickStartPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // [INP.3.3.1] If moved beyond threshold, it's a drag (not a click)
            if (distance >= this.dragThreshold) {
                this.isDragging = true;

                // Clear hold timer since user is dragging
                if (this.holdTimer) {
                    clearTimeout(this.holdTimer);
                    this.holdTimer = null;
                }
            } else {
                // Still within threshold - might be hand shake, ignore movement
                return;
            }
        }

        // [INP.3.4] Only send MouseMove if dragging or no button held
        if (this.buttons.size === 0 && !this.isDragging) {
            // No buttons pressed and not dragging, don't send movement
            return;
        }

        // [INP.3.5] Determine which button is held (if any)
        let heldButton = null;
        if (this.buttons.has('LeftClick')) {
            heldButton = 'LeftClick';
        } else if (this.buttons.has('RightClick')) {
            heldButton = 'RightClick';
        } else if (this.buttons.has('MiddleClick')) {
            heldButton = 'MiddleClick';
        }

        // [INP.3.6] Send MouseMove event to InputManager
        this.sendInput({
            source: 'mouse',
            input: 'MouseMove',
            state: 'moved',
            position: { ...this.position },
            delta: { ...this.deltaPosition },
            previousPosition: previousPosition,
            heldButton: heldButton,      // Which button is held during movement
            isDragging: this.isDragging,  // Is this a drag operation?
            originalEvent: event
        });
    }

    /**
     * [INP.3] Handle context menu event
     *
     * Prevents the browser's context menu from appearing on right-click.
     * This allows right-click+drag for camera rotation without interruption.
     *
     * @param {MouseEvent} event - Context menu event
     */
    handleContextMenu(event) {
        // [INP.3.1] Prevent context menu
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    /**
     * [INP.3] Handle mouse wheel
     *
     * @param {WheelEvent} event - Wheel event
     */
    handleWheel(event) {
        // [INP.3.1] Prevent default (stop page scroll)
        event.preventDefault();

        // [INP.3.2] Send to InputManager
        // deltaY is positive when scrolling down, negative when up
        this.sendInput({
            source: 'mouse',
            input: 'MouseWheel',
            state: 'scrolled',
            value: event.deltaY,  // Amount scrolled
            delta: {
                x: event.deltaX,
                y: event.deltaY,
                z: event.deltaZ
            },
            mode: event.deltaMode,  // 0 = pixels, 1 = lines, 2 = pages
            originalEvent: event
        });
    }

    /**
     * [INP.3] Convert button number to name
     *
     * @param {number} button - Button number (0, 1, 2, ...)
     * @returns {string} Button name
     */
    getButtonName(button) {
        switch (button) {
            case 0: return 'LeftClick';
            case 1: return 'MiddleClick';
            case 2: return 'RightClick';
            case 3: return 'Button3';
            case 4: return 'Button4';
            default: return `Button${button}`;
        }
    }

    /**
     * [INP.3] Check if a button is currently pressed
     *
     * @param {string} buttonName - Button name ('LeftClick', etc.)
     * @returns {boolean}
     */
    isButtonPressed(buttonName) {
        return this.buttons.has(buttonName);
    }

    /**
     * [INP.3] Get all currently pressed buttons
     *
     * @returns {Set<string>}
     */
    getPressedButtons() {
        return new Set(this.buttons);
    }

    /**
     * [INP.3] Get current mouse position
     *
     * @returns {Object} Position { x, y }
     */
    getPosition() {
        return { ...this.position };
    }

    /**
     * [INP.3] Get last mouse delta
     *
     * @returns {Object} Delta { x, y }
     */
    getDelta() {
        return { ...this.deltaPosition };
    }

    /**
     * [INP.3] Request pointer lock (for FPS-style camera)
     *
     * @returns {Promise}
     */
    async requestPointerLock() {
        try {
            await this.canvas.requestPointerLock();
            console.log('[INP.3] Pointer lock acquired');
        } catch (e) {
            console.error('[INP.3] Pointer lock failed:', e);
        }
    }

    /**
     * [INP.3] Exit pointer lock
     */
    exitPointerLock() {
        if (document.pointerLockElement === this.canvas) {
            document.exitPointerLock();
            console.log('[INP.3] Pointer lock released');
        }
    }

    /**
     * [INP.3] Check if pointer is locked
     *
     * @returns {boolean}
     */
    isPointerLocked() {
        return document.pointerLockElement === this.canvas;
    }

    /**
     * [INP.3] Dispose and cleanup
     */
    dispose() {
        // [INP.3.1] Remove Babylon observer
        if (this.scene && this.pointerObserver) {
            this.scene.onPointerObservable.remove(this.pointerObserver);
            this.pointerObserver = null;
        }

        // [INP.3.2] Remove DOM event listeners
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('wheel', this.handleWheel);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

        // [INP.3.3] Clear button state
        this.buttons.clear();

        // [INP.3.4] Exit pointer lock if active
        this.exitPointerLock();

        // [INP.3.5] Call parent dispose
        super.dispose();

        console.log('[INP.3] MouseSource disposed');
    }
}
