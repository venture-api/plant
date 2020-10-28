import fs from 'fs';
import path from 'path';
import url from 'url';
import Logger from './Logger.js';


export default class {

    constructor(name, servicePath, kojo) {

        this._methodFiles = fs.readdirSync(servicePath);
        this._servicePath = servicePath;
        this._name = name;
        this._kojo = kojo;
    }

    async ready() {

        await Promise.all(this._methodFiles.map(async (methodFilename) => {

            const methodName = path.basename(methodFilename, '.js');

            // reserved for unit tests
            if (methodName === 'test')
                return;

            const importPath = path.join(this._servicePath, methodFilename);

            if (fs.lstatSync(importPath).isDirectory())
                return;

            let { default: wrapper } = await import(url.pathToFileURL(importPath));

            const kojo = this._kojo;
            const loggerId = kojo.config.loggerIdSuffix ? [ kojo.name, kojo.id ].join('.') : kojo.name;
            const logger = new Logger({
                id: loggerId,
                icon: kojo.config.icon,
                level: kojo.config.logLevel,
                tagPieces: [ this._name, methodName ],
                color: 'yellow' });
            const fnType = Object.getPrototypeOf(wrapper).constructor.name;

            if (fnType === 'AsyncFunction')
                this[methodName] = this._wrapAsync(wrapper, logger);

            if (fnType === 'Function')
                this[methodName] = this._wrapSync(wrapper, logger);

        }));

        return this;
    }

    _wrapAsync(wrapper, logger) {
        return async (...params) => {

            const context = [ this._kojo, logger ];
            return Promise
            .resolve(wrapper.call(context, ...params))
            .catch(error => {
                logger.error(error.message);
                throw error;
            });
        }
    };

    _wrapSync (wrapper, logger) {
        return (...params) => {

            const context = [ this._kojo, logger ];
            try {
                return wrapper.call(context, ...params)
            } catch (error) {
                logger.error(error.message);
                throw error;
            }
        }
    };
};
