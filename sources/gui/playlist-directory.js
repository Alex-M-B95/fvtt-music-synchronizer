import { Constants } from '../utils/constants.js'

export class SyncablePlaylistDirectory extends PlaylistDirectory {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.template = `modules/${Constants.moduleName}/templates/playlists-directory.html`;
        return options;
    }
    
    async getData() {
        var data = await super.getData()
        return data
    }
    
    activateListeners(html) {
        super.activateListeners(html)
    }
}
