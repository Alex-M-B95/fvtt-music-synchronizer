import { Constants } from '../utils/constants.js'
import { Logger } from '../utils/logger.js'
import { MusicSyncerCustomSettings } from '../gui/custom-settings.js'

export class ModuleSettings {
    static registerVttSettings() {
        game.settings.register(Constants.moduleName, Constants.settings.enable, {
            name: game.i18n.localize('music-syncer.enable-sync-label'),
            hint: game.i18n.localize('music-syncer.enable-sync-description'),
            scope: 'world',
            config: true,
            restricted: true,
            type: Boolean,
            default: true,
            onChange: value => Logger.log(value)
        })
        
        game.settings.register(Constants.moduleName, Constants.settings.users, {
            name: `${Constants.moduleName}.${Constants.settings.users}`,
            scope: 'world',
            config: false,
            restricted: true,
            type: Array,
            default: [],
            onChange: value => Logger.log(value)
        })
        
        game.settings.registerMenu(Constants.moduleName, Constants.settings.menu, {
            name: game.i18n.localize('music-syncer.custom-settings-title'),
            label: game.i18n.localize('music-syncer.settings-button-title'),
            hint: game.i18n.localize('music-syncer.custom-settings-description'),
            icon: "fas fa-tools",
            type: MusicSyncerCustomSettings,
            restricted: true
        })
    }
    
    static toggleEnabledPlayer(id, isEnabled) {
        var data = game.settings.get(Constants.moduleName, Constants.settings.users) || []
        if (isEnabled) {
            data = [...data, id]
        } else {
            data = data.filter(item => item !== id)
        }
        game.settings.set(Constants.moduleName, Constants.settings.users, data)
    }
    
    static get enabledPlayers() {
        var data = game.settings.get(Constants.moduleName, Constants.settings.users) || []
        return game.users.contents.filter(item => data.includes(item.id))
    }
    
    static isEnabledUser(user) {
        var data = game.settings.get(Constants.moduleName, Constants.settings.users) || []
        return data.includes(user.id)
    }
    
    static setEnableSync(isEnabled) {
        game.settings.set(Constants.moduleName, Constants.settings.enable, isEnabled)
    }
    
    static get isEnableSync() {
        const result = game.settings.get(Constants.moduleName, Constants.settings.enable)
        if (result) {
            return result
        } else {
            return false
        }
    }
}
