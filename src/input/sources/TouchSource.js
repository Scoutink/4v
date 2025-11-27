/**
 * TouchSource - Touch/gesture input handler
 *
 * @class TouchSource
 * @extends InputSource
 *
 * @description
 * Listens to touch events and recognizes gestures for mobile/tablet devices.
 *
 * Features:
 * - Single touch tracking
 * - Multi-touch detection
 * - Basic gesture recognition (tap, long-press, swipe)
 * - Touch state tracking
 * - Pinch/zoom detection (basic)
 *
 * Input Formats:
 *
 * Touch Start:
 * {
 *     source: 'touch',
 *     input: 'TouchStart',
 *     state: 'started',
 *     position: { x, y },
 *     touchCount: number,
 *     originalEvent: TouchEvent
 * }
 *
 * Touch Move (Pan):
 * {
 *     source: 'touch',
 *     input: 'TouchPan',
 *     state: 'moved',
 *     position: { x, y },
 *     delta: { x, y },
 *     touchCount: number,
 *     originalEvent: TouchEvent
 * }
 *
 * Tap:
 * {
 *     source: 'touch',
 *     input: 'Tap',
 *     state: 'completed',
 *     position: { x, y },
 *     duration: number (ms),
 *     originalEvent: TouchEvent
 * }
 *
 * Long Press:
 * {
 *     source: 'touch',
 *     input: 'LongPress',
 *     state: 'completed',
 *     position: { x, y },
 *     duration: number (ms),
 *     originalEvent: TouchEvent
 * }
 *
 * Swipe:
 * {
 *     source: 'touch',
 *     input: 'TouchSwipe',
 *     state: 'completed',
 *     direction: 'up' | 'down' | 'left' | 'right',
 *     distance: number,
 *     duration: number (ms),
 *     originalEvent: TouchEvent
 * }
 *
 * Pinch:
 * {
 *     source: 'touch',
 *     input: 'TouchPinch',
 *     state: 'changed',
 *     value: number (scale factor),
 *     originalEvent: TouchEvent
 * }
 *
 * @example
 * const touchSource = new TouchSource(inputManager, canvas);
 *
 * @tags [INP.3]
 * @version 1.0.0
 */

import InputSource from './InputSource.js';

export default class TouchSource extends InputSource {
    /**
     * [INP.3] Constructor - Initialize touch listeners
     *
     * @param {InputManager} inputManager - Reference to InputManager
     * @param {HTMLCanvasElement} canvas - Render canvas
     */
    constructor(inputManager, canvas) {
        super(inputManager, 'touch');

        // [INP.3.1] Core reference
        this.canvas = canvas;

        // [INP.3.2] Touch state tracking
        // Map<touchId, TouchState>
        this.touches = new Map();

        // [INP.3.3] Gesture thresholds
        this.thresholds = {
            tap: {
                maxDuration: 200,   // ms
                maxDistance: 10     // pixels
            },
            longPress: {
                minDuration: 500,   // ms
                maxDistance: 10     // pixels
            },
            swipe: {
                minDistance: 50,    // pixels
                maxDuration: 300    // ms
            },
            pinch: {
                minDistance: 10     // pixels
            }
        };

        // [INP.3.4] Pinch tracking
        this.pinchStart = null;

        // [INP.3.5] Bind event handlers
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleTouchCancel = this.handleTouchCancel.bind(this);

        // [INP.3.6] Register event listeners
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });

        console.log('[INP.3] TouchSource ready');
    }

    /**
     * [INP.3] Handle touch start
     *
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        // [INP.3.1] Prevent default (stop page scroll/zoom)
        event.preventDefault();

        // [INP.3.2] Track each new touch
        for (const touch of event.changedTouches) {
            this.touches.set(touch.identifier, {
                id: touch.identifier,
                startX: touch.clientX,
                startY: touch.clientY,
                currentX: touch.clientX,
                currentY: touch.clientY,
                startTime: Date.now()
            });
        }

        // [INP.3.3] Send touch start event
        if (event.touches.length === 1) {
            // Single touch
            this.sendInput({
                source: 'touch',
                input: 'TouchStart',
                state: 'started',
                position: {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                },
                touchCount: 1,
                originalEvent: event
            });
        } else if (event.touches.length === 2) {
            // Two finger touch - start tracking pinch
            this.startPinch(event.touches);
        }
    }

    /**
     * [INP.3] Handle touch move
     *
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        // [INP.3.1] Prevent default
        event.preventDefault();

        // [INP.3.2] Update touch positions
        for (const touch of event.changedTouches) {
            const tracked = this.touches.get(touch.identifier);
            if (tracked) {
                tracked.currentX = touch.clientX;
                tracked.currentY = touch.clientY;
            }
        }

        // [INP.3.3] Single finger - pan
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const tracked = this.touches.get(touch.identifier);

            if (tracked) {
                this.sendInput({
                    source: 'touch',
                    input: 'TouchPan',
                    state: 'moved',
                    position: {
                        x: touch.clientX,
                        y: touch.clientY
                    },
                    delta: {
                        x: touch.clientX - tracked.startX,
                        y: touch.clientY - tracked.startY
                    },
                    touchCount: 1,
                    originalEvent: event
                });
            }
        }

        // [INP.3.4] Two fingers - pinch/zoom
        if (event.touches.length === 2) {
            this.handlePinch(event.touches);
        }
    }

    /**
     * [INP.3] Handle touch end
     *
     * @param {TouchEvent} event - Touch event
     */
    handleTouchEnd(event) {
        // [INP.3.1] Process each ended touch
        for (const touch of event.changedTouches) {
            const tracked = this.touches.get(touch.identifier);
            if (!tracked) continue;

            const duration = Date.now() - tracked.startTime;
            const distance = Math.hypot(
                touch.clientX - tracked.startX,
                touch.clientY - tracked.startY
            );

            // [INP.3.2] Detect tap (short touch, minimal movement)
            if (duration < this.thresholds.tap.maxDuration &&
                distance < this.thresholds.tap.maxDistance) {

                this.sendInput({
                    source: 'touch',
                    input: 'Tap',
                    state: 'completed',
                    position: {
                        x: touch.clientX,
                        y: touch.clientY
                    },
                    duration: duration,
                    originalEvent: event
                });
            }

            // [INP.3.3] Detect long press (long touch, minimal movement)
            else if (duration > this.thresholds.longPress.minDuration &&
                     distance < this.thresholds.longPress.maxDistance) {

                this.sendInput({
                    source: 'touch',
                    input: 'LongPress',
                    state: 'completed',
                    position: {
                        x: touch.clientX,
                        y: touch.clientY
                    },
                    duration: duration,
                    originalEvent: event
                });
            }

            // [INP.3.4] Detect swipe (fast movement)
            else if (duration < this.thresholds.swipe.maxDuration &&
                     distance > this.thresholds.swipe.minDistance) {

                const angle = Math.atan2(
                    touch.clientY - tracked.startY,
                    touch.clientX - tracked.startX
                );

                this.sendInput({
                    source: 'touch',
                    input: 'TouchSwipe',
                    state: 'completed',
                    direction: this.getSwipeDirection(angle),
                    distance: distance,
                    duration: duration,
                    velocity: distance / duration,  // pixels per ms
                    originalEvent: event
                });
            }

            // [INP.3.5] Remove from tracking
            this.touches.delete(touch.identifier);
        }

        // [INP.3.6] Reset pinch if no more touches
        if (event.touches.length < 2) {
            this.pinchStart = null;
        }
    }

    /**
     * [INP.3] Handle touch cancel (interrupted)
     *
     * @param {TouchEvent} event - Touch event
     */
    handleTouchCancel(event) {
        // [INP.3.1] Remove all canceled touches
        for (const touch of event.changedTouches) {
            this.touches.delete(touch.identifier);
        }

        // [INP.3.2] Reset pinch
        this.pinchStart = null;
    }

    /**
     * [INP.3] Start tracking pinch gesture
     *
     * @param {TouchList} touches - Two touches
     */
    startPinch(touches) {
        if (touches.length !== 2) return;

        const distance = Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
        );

        this.pinchStart = distance;
    }

    /**
     * [INP.3] Handle pinch gesture
     *
     * @param {TouchList} touches - Two touches
     */
    handlePinch(touches) {
        if (touches.length !== 2 || !this.pinchStart) return;

        const distance = Math.hypot(
            touches[1].clientX - touches[0].clientX,
            touches[1].clientY - touches[0].clientY
        );

        const scale = distance / this.pinchStart;

        // [INP.3.1] Send pinch event
        this.sendInput({
            source: 'touch',
            input: 'TouchPinch',
            state: 'changed',
            value: scale,  // Scale factor (< 1 = pinch in, > 1 = pinch out)
            distance: distance,
            startDistance: this.pinchStart,
            originalEvent: null  // No single event for this
        });
    }

    /**
     * [INP.3] Get swipe direction from angle
     *
     * @param {number} angle - Angle in radians
     * @returns {string} Direction ('up', 'down', 'left', 'right')
     */
    getSwipeDirection(angle) {
        const degrees = angle * 180 / Math.PI;

        if (degrees > -45 && degrees <= 45) {
            return 'right';
        } else if (degrees > 45 && degrees <= 135) {
            return 'down';
        } else if (degrees > 135 || degrees <= -135) {
            return 'left';
        } else {
            return 'up';
        }
    }

    /**
     * [INP.3] Get all active touches
     *
     * @returns {Map} Touch states
     */
    getActiveTouches() {
        return new Map(this.touches);
    }

    /**
     * [INP.3] Get touch count
     *
     * @returns {number}
     */
    getTouchCount() {
        return this.touches.size;
    }

    /**
     * [INP.3] Dispose and cleanup
     */
    dispose() {
        // [INP.3.1] Remove event listeners
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.handleTouchCancel);

        // [INP.3.2] Clear touch tracking
        this.touches.clear();
        this.pinchStart = null;

        // [INP.3.3] Call parent dispose
        super.dispose();

        console.log('[INP.3] TouchSource disposed');
    }
}
