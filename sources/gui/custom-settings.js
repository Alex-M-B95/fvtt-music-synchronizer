import { Constants } from '../utils/constants.js'
import { Logger } from '../utils/logger.js'
import { ModuleSettings } from '../data/module-settings.js'

export class MusicSyncerCustomSettings extends FormApplication {
    static open() {
        const window = new MusicSyncerCustomSettings()
        window.render(true)
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "alexs-music-syncer-users-settings",
            title: game.i18n.localize('music-syncer.custom-settings-title'),
            template: `modules/${Constants.moduleName}/templates/custom-settings.html`,
            classes: [Constants.moduleName, "settings-window"],
            popOut: true,
        });
    }
    
    getData() {
        return {
            players: game.users.contents.map(user => ({
                id: user.id,
                name: user.name,
                enabled: ModuleSettings.isEnabledUser(user)
            })),
            enableSync: ModuleSettings.isEnableSync,
        }
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find(".player-checkbox").click(this.#onTapPlayer.bind(this))
        html.find("#enable-syncer").click(this.#onTapEnableSyncer.bind(this))
    }
    
    #onTapPlayer(event) {
        const id = event.target.getAttribute('data-player-id')
        const isChecked = event.currentTarget.checked
        ModuleSettings.toggleEnabledPlayer(id, isChecked)
    }
    
    #onTapEnableSyncer(event) {
        const isChecked = event.currentTarget.checked
        ModuleSettings.setEnableSync(isChecked)
    }
}
