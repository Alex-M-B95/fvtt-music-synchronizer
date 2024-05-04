import { Constants } from './constants.js'

export class Logger {
    static log(...args) {
        if (Constants.isDebugMode) {
            console.log(Constants.moduleName, '|', ...args)
        }
    }
    
    static error(...args) {
        console.error(Constants.moduleName, '|', ...args)
    }
}
