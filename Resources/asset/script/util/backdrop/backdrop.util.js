import DeviceDetection from 'asset/script/helper/device-detection.helper';

const SELECTOR_CLASS = 'modal-backdrop';
const BACKDROP_OPEN_CLASS = 'modal-backdrop-open';
const NO_SCROLL_CLASS = 'no-scroll';
const REMOVE_BACKDROP_DELAY = 350;

export const BACKDROP_EVENT = {
    ON_CLICK: 'backdrop/onclick'
};

class BackdropSingleton {

    /**
     * Constructor
     * @returns {BackdropSingleton|*}
     */
    constructor() {
        if (!BackdropSingleton.instance) {
            BackdropSingleton.instance = this;
        }
        return BackdropSingleton.instance;
    }

    /**
     * Insert a backdrop to document.body and set a class
     * to the body to override default scrolling behaviour
     * @param {function|null} callback
     */
    open(callback) {
        // avoid multiple backdrops
        this._removeExistingBackdrops();

        document.body.insertAdjacentHTML('beforeend', this._getTemplate());
        const backdrop = document.body.lastChild;

        // override body scroll behaviour
        document.documentElement.classList.add(NO_SCROLL_CLASS);

        // add open class afterwards to make any css animation effects possible
        setTimeout(function() {
            backdrop.classList.add(BACKDROP_OPEN_CLASS);

            // if a callback function is being injected execute it after opening the backdrop
            if (typeof callback === 'function') {
                callback();
            }
        }, 1);

        this._dispatchEvents();
    }

    /**
     * Close backdrop
     * @param {number} delay
     */
    close(delay = REMOVE_BACKDROP_DELAY) {
        // remove open class to make any css animation effects possible
        this._getBackdrops().forEach(backdrop => backdrop.classList.remove(BACKDROP_OPEN_CLASS));

        // wait before removing backdrop to let css animation effects take place
        setTimeout(this._removeExistingBackdrops.bind(this), delay);

        // remove body scroll behaviour override
        document.documentElement.classList.remove(NO_SCROLL_CLASS);
    }

    /**
     * Dispatch events
     * @private
     */
    _dispatchEvents() {
        const event = (DeviceDetection.isTouchDevice()) ? 'touchstart' : 'click';

        document.addEventListener(event, function(e) {
            if (e.target.classList.contains(SELECTOR_CLASS)) {
                document.dispatchEvent(new Event(BACKDROP_EVENT.ON_CLICK));
            }
        });
    }

    /**
     * Determine list of existing backdrops
     * @returns {NodeListOf<Element>}
     * @private
     */
    _getBackdrops() {
        return document.querySelectorAll(`.${SELECTOR_CLASS}`);
    }

    /**
     * Remove all existing backdrops from DOM
     * @private
     */
    _removeExistingBackdrops() {
        if (this._exists() === false) return;
        this._getBackdrops().forEach(backdrop => backdrop.remove());
    }

    /**
     * Checks if a backdrop already exists
     * @returns {boolean}
     * @private
     */
    _exists() {
        return (document.querySelectorAll(`.${SELECTOR_CLASS}`).length > 0);
    }

    /**
     * The backdrops HTML template definition
     * @returns {string}
     * @private
     */
    _getTemplate() {
        return `<div class="${SELECTOR_CLASS}"></div>`;
    }
}

/**
 * Make the Backdrop being a Singleton
 * @type {BackdropSingleton}
 */
const instance = new BackdropSingleton();
Object.freeze(instance);

export default class BackdropUtil {

    /**
     * Open the Backdrop
     * @param {function|null} callback
     */
    static open(callback = null) {
        instance.open(callback);
    }

    /**
     * Close the Backdrop
     * @param {number} delay
     */
    static close(delay = REMOVE_BACKDROP_DELAY) {
        instance.close(delay);
    }

    /**
     * Expose constant
     * @returns {string}
     */
    static SELECTOR_CLASS() {
        return SELECTOR_CLASS;
    }
}
