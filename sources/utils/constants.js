export class Constants {
    static get moduleName() { return 'alexs-music-syncer' }

    static get settings() {
        return {
            enable: 'enable-syncer',
            menu: 'custom-settings-menu',
            users: 'syncable-users'
        }
    }

    static isDebugMode = true
}
