import deepmerge from 'deepmerge';
import PluginRegistry from 'asset/script/helper/plugin/plugin.registry';
import DomAccess from 'asset/script/helper/dom-access.helper';

/**
 * this file handles the plugin functionality of shopware
 *
 * to use the PluginManager import:
 * ```
 *     import PluginManager from 'asset/script/helper/plugin/plugin.manager.js';
 *
 *     PluginManager.register(.....);
 *
 *     PluginManager.executePlugins(.....);
 * ```
 *
 * to extend from the base plugin import:
 * ```
 *     import Plugin from 'asset/script/helper/plugin/plugin.class.js';
 *
 *     export default MyFancyPlugin extends Plugin {}
 * ```
 *
 * methods:
 *
 * // Registers a plugin to the plugin mananger.
 * PluginManager.register(name: String, pluginClass: Plugin, selector: String | NodeList | HTMLElement, options?: Object): *;
 *
 * // Removes a plugin from the plugin manager.
 * PluginManager.deregister(name: String): *;
 *
 * // Extends an already existing plugin with a new class or function.
 * // If both names are equal, the plugin will be overridden.
 * PluginManager.extend(fromName: String, newName: String, pluginClass: Plugin, selector: String | NodeList | HTMLElement, options?: Object): boolean;
 *
 * // Returns a list of all registered plugins.
 * PluginManager.getPlugins(): *;
 *
 * // Returns the plugin instance from the passed element selected by plugin Name.
 * PluginManager.getPluginInstance(el: HTMLElement, name: String): Object | null;
 *
 * // Returns all plugin instances from the passed element.
 * PluginManager.getPluginInstances(el: HTMLElement): Map : null;
 *
 * // Starts all plugins which are currently registered.
 * PluginManager.executePlugins(): *;
 *
 * // Starts a single plugin.
 * PluginManager.executePlugin(name: String|boolean, selector: String | NodeList | HTMLElement, options?: Object): *;
 *
 */
class PluginManagerSingleton {

    constructor() {
        this._registry = new PluginRegistry();
    }

    /**
     * Registers a plugin to the plugin mananger.
     *
     * @param {string} name
     * @param {Plugin} pluginClass
     * @param {string|NodeList|HTMLElement} selector
     * @param {Object} options
     *
     * @returns {*}
     */
    register(name, pluginClass, selector = document, options = {}) {
        if (this._registry.has(name)) {
            throw new Error(`Plugin "${name}" is already registered.`);
        }

        return this._registry.set(name, pluginClass, selector, options);
    }

    /**
     * Removes a plugin from the plugin manager.
     *
     * @param {string} name
     * @returns {*}
     */
    deregister(name) {
        if (!this._registry.has(name)) {
            throw new Error(`The plugin "${name}" is not registered.`);
        }

        return this._registry.delete(name);
    }

    /**
     * Extends an already existing plugin with a new class or function.
     * If both names are equal, the plugin will be overridden.
     *
     * @param {string} fromName
     * @param {string} newName
     * @param {Plugin} pluginClass
     * @param {string|NodeList|HTMLElement} selector
     * @param {Object} options
     *
     * @returns {boolean}
     */
    extend(fromName, newName, pluginClass, selector, options = {}) {
        // Register the plugin under a new name
        // If the name is the same, replace it
        if (fromName === newName) {
            this.deregister(fromName);
            return this.register(newName, pluginClass, selector, options);
        }

        return this._extendPlugin(fromName, newName, pluginClass, selector, options);
    }

    /**
     * Returns a list of all registered plugins.
     *
     * @returns {*}
     */
    getPlugins() {
        return this._registry.keys();
    }

    /**
     * Returns the plugin instance from the passed element selected by plugin Name.
     *
     * @param {HTMLElement} el
     * @param {String} name
     *
     * @returns {Object|null}
     */
    getPluginInstance(el, name) {
        const instances = this.getPluginInstances(el);

        return instances.get(name);
    }

    /**
     * Returns all plugin instances from the passed element.
     *
     * @param {HTMLElement} el
     *
     * @returns {Map|null}
     */
    getPluginInstances(el) {
        el.__plugins = el.__plugins || new Map();

        return el.__plugins;
    }

    /**
     * Starts all plugins which are currently registered.
     */
    executePlugins() {
        const plugins = Object.keys(this.getPlugins());
        plugins.forEach((pluginName) => {
            if (pluginName) {
                if (!this._registry.has(pluginName)) {
                    throw new Error(`The plugin "${pluginName}" is not registered.`);
                }

                const definition = this._registry.get(pluginName);
                this.executePlugin(definition.name, definition.selector, definition.options);
            }
        });
    }

    /**
     * Starts a single plugin.
     *
     * @param {Object} name
     * @param {String|NodeList|HTMLElement} selector
     * @param {Object} options
     */
    executePlugin(name, selector, options) {
        if (!this._registry.has(name)) {
            throw new Error(`The plugin "${name}" is not registered.`);
        }

        const definition = this._registry.get(name);
        const mergedOptions = deepmerge(definition.options, options);
        this._executePlugin(definition.plugin, selector, mergedOptions, definition);
    }

    /**
     * Executes a vanilla plugin class.
     *
     * @param {Plugin} pluginClass
     * @param {String|NodeList|HTMLElement} selector
     * @param {Object} options
     * @param {Object|boolean} definition
     */
    _executePlugin(pluginClass, selector, options, definition = false) {
        if (DomAccess.isNode(selector)) {
            return PluginManagerSingleton._executePluginOnElement(selector, pluginClass, options, definition);
        }

        if (typeof selector === 'string') {
            selector = document.querySelectorAll(selector);
        }

        return selector.forEach((el) => {
            PluginManagerSingleton._executePluginOnElement(el, pluginClass, options, definition);
        });
    }

    /**
     * Executes a vanilla plugin class on the passed element.
     *
     * @param {String|NodeList|HTMLElement} el
     * @param {Plugin} pluginClass
     * @param {Object} options
     * @param {Object|boolean} definition
     * @private
     */
    static _executePluginOnElement(el, pluginClass, options, definition) {
        if (typeof pluginClass !== 'function') {
            throw new Error('The passed plugin is not a function or a class.');
        }

        new pluginClass(el, options, definition.name); // eslint-disable-line no-new
    }

    /**
     * extends a plugin class with another class or function.
     *
     * @param {string} fromName
     * @param {string} newName
     * @param {Plugin} pluginClass
     * @param {string|NodeList|HTMLElement} selector
     * @param {Object} options
     *
     * @returns {*}
     * @private
     */
    _extendPlugin(fromName, newName, pluginClass, selector, options = {}) {
        if (!this._registry.has(fromName)) {
            throw new Error(`The plugin "${fromName}" is not registered.`);
        }

        // get current plugin
        const extendFrom = this._registry.get(fromName);
        const parentPlugin = extendFrom.plugin;
        const mergedOptions = deepmerge(deepmerge(parentPlugin.options, extendFrom.options), options);

        // Create plugin
        class InternallyExtendedPlugin extends parentPlugin {
        }

        // Extend the plugin with the new definitions
        InternallyExtendedPlugin.prototype = Object.assign(InternallyExtendedPlugin.prototype, pluginClass);
        InternallyExtendedPlugin.prototype.constructor = InternallyExtendedPlugin;

        return this.register(newName, InternallyExtendedPlugin, selector, mergedOptions);
    }

}

/**
 * Make the PluginManager being a Singleton
 * @type {PluginManagerSingleton}
 */
const PluginManagerInstance = new PluginManagerSingleton();
Object.freeze(PluginManagerInstance);

export default class PluginManager {

    constructor() {
        window.PluginManager = this;
    }

    /**
     * Registers a plugin to the plugin mananger.
     *
     * @param {string} name
     * @param {Plugin} pluginClass
     * @param {string|NodeList|HTMLElement} selector
     * @param {Object} options
     *
     * @returns {*}
     */
    static register(name, pluginClass, selector = document, options = {}) {
        return PluginManagerInstance.register(name, pluginClass, selector, options);
    }

    /**
     * Removes a plugin from the plugin manager.
     *
     * @param {string} name
     * @returns {*}
     */
    static deregister(name) {
        return PluginManagerInstance.deregister(name);
    }

    /**
     * Extends an already existing plugin with a new class or function.
     * If both names are equal, the plugin will be overridden.
     *
     * @param {string} fromName
     * @param {string} newName
     * @param {Plugin} pluginClass
     * @param {string|NodeList|HTMLElement} selector
     * @param {Object} options
     *
     * @returns {boolean}
     */
    static extend(fromName, newName, pluginClass, selector, options = {}) {
        return PluginManagerInstance.extend(fromName, newName, pluginClass, selector, options);
    }

    /**
     * Returns a list of all registered plugins.
     *
     * @returns {*}
     */
    static getPlugins() {
        return PluginManagerInstance.getPlugins();
    }

    /**
     * Returns the plugin instance from the passed element selected by plugin Name.
     *
     * @param {HTMLElement} el
     * @param {String} name
     *
     * @returns {Object|null}
     */
    static getPluginInstance(el, name) {
        return PluginManagerInstance.getPluginInstance(el,name)
    }

    /**
     * Returns all plugin instances from the passed element.
     *
     * @param {HTMLElement} el
     *
     * @returns {Map|null}
     */
    static getPluginInstances(el) {
        return PluginManagerInstance.getPluginInstances(el);
    }

    /**
     * Starts all plugins which are currently registered.
     */
    static executePlugins() {
        PluginManagerInstance.executePlugins();
    }

    /**
     * Starts a single plugin.
     *
     * @param {Object} name
     * @param {String|NodeList|HTMLElement} selector
     * @param {Object} options
     */
    static executePlugin(name, selector, options) {
        PluginManagerInstance.executePlugin(name, selector, options);
    }
}

window.PluginManager = PluginManager;
