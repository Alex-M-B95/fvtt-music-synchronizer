import { Logger } from './utils/logger.js'
import { Constants } from './utils/constants.js'
import { SyncablePlaylistDirectory } from './gui/playlist-directory.js'

const SoundSyncStatus = {
    none: 'none',
    downloading: 'downloading',
    holded: 'holded',
    playing: 'playing',
    deleted: 'deleted',
}

function clearAllFlags() {
    for (const user of game.users.contents) {
        const userFlags = user.flags[Constants.moduleName]
        if (userFlags) {
            for (const key of Object.keys(userFlags)) {
                user.unsetFlag(Constants.moduleName, key)
                Logger.log(`[clear] flag ${key} did unset for user ${user.name}`)
            }
        }
    }

    for (const playlist of game.playlists.values()) {
        for (const sound of playlist.sounds.values()) {
            const soundFlags = sound.flags[Constants.moduleName]
            if (soundFlags) {
                for (const key of Object.keys(soundFlags)) {
                    sound.unsetFlag(Constants.moduleName, key)
                    Logger.log(`[clear] flag ${key} did unset for sound`)
                }
            }
        }
    }
}

Hooks.once('init', _onInit)
Hooks.once('ready', _onReady)

Hooks.on('updateUser', async function (user, updateData, options, userId) {
    if (!game.user.isGM) { return }

    if (updateData.flags) {
        const sounds = updateData.flags[Constants.moduleName]?.sounds
        if (sounds && sounds.length > 0) {
            await updateSoundsOnUpdateUser(user.id, sounds)
            await clearDeletedSoundsFromUser(user)
            Logger.log(`User ${user.name} (${user.id}) have new flags:`, sounds)
        }
    }
})

Hooks.on('updatePlaylistSound', (sound, data, options, id) => {
    if (data.flags) {
        const status = sound.flags[Constants.moduleName]?.status
        Logger.log(`[sound.flags] ${sound.name} (${sound.id}):`, status)

        if (status) {
            Logger.log('[sound.flags] set status', status, 'for sound', sound.path)
            setSoundState(sound.path, status)
        }

        if (status === SoundSyncStatus.holded) {
            Logger.log('[steps] start play holder track at path:', sound.path)
            const args = popArgsForSound(sound.path)

            var isStarted = false
            for (const item of game.audio.playing.values()) {
                if (item.src === sound.path) {
                    item.play(args)
                    isStarted = true
                    return
                }
            }
            if (!isStarted) {
                game.audio.play(sound.path, args)
            }
        }
    }
})

//Hooks.on("userConnected", async function(user, connected) {
//    if (!game.user.isGM) { return }
//
//    if (connected === false) {
//        Logger.log('[Logout]', `User ${user.name} (${user.id}) is now offline`)
//        await clearUserFlagsOnLogout(user)
//        var tracks = []
//
//        for (const sound of game.audio.playing.values()) {
//            if (!tracks.includes(sound.src)) {
//                tracks = [...tracks, sound.src]
//            }
//            sound.stop()
//        }
//
//        for (const src in tracks) {
//            game.audio.play(src)
//        }
//    } else {
//        Logger.log('[Login]', `User ${user.name} (${user.id}) is now online`)
//    }
//})

async function clearUserFlagsOnLogout(user) {
    await user.unsetFlag(Constants.moduleName, 'sounds')
}

function _onInit() {
    Logger.log('on init')
//    CONFIG.debug.hooks = true
    CONFIG.ui.playlists = SyncablePlaylistDirectory
}

function _onReady() {
    Logger.log('on ready')

    if (game.user.isGM) {
        clearAllFlags()
    }

    libWrapper.register(Constants.moduleName, 'Playlist.prototype.playAll', async function (wrapped) {
        const result = await wrapped()
        handlePlaylistChanges(result)
        return result
    })

    libWrapper.register(Constants.moduleName, 'Playlist.prototype.stopAll', async function (wrapped) {
        const result = await wrapped()
        handlePlaylistChanges(result)
        return result
    })

    libWrapper.register(Constants.moduleName, 'Playlist.prototype.playSound', async function (wrapped, sound) {
        const result = await wrapped(sound)
        handlePlaylistChanges(result)
        return result
    })

    libWrapper.register(Constants.moduleName, 'Playlist.prototype.stopSound', async function (wrapped, sound) {
        const result = await wrapped(sound)
        handlePlaylistChanges(result)
        return result
    })

    libWrapper.register(Constants.moduleName, 'Playlist.prototype.playNext', async function (wrapped, ...args) {
        const result = await wrapped(...args)
        handlePlaylistChanges(result)
        return result
    })

    libWrapper.register(Constants.moduleName, 'Sound.prototype.load', async function (wrapped, ...args) {
        if (!game.audio.buffers.has(this.src)) {
            createInAudioHelperIfNeed(this.src)
            updateUserSoundStatus(this.src, SoundSyncStatus.downloading)
        }
        Logger.log('[steps] download:', this.src)
        try {
            return await wrapped(...args)
        } catch (error) {
            updateUserSoundStatus(this.src, SoundSyncStatus.none)
        }
    }, 'WRAPPER')

    libWrapper.register(Constants.moduleName, 'AudioContainer.prototype._unloadMediaNode', async function (wrapped, ...args) {
        updateUserSoundStatus(this.src, SoundSyncStatus.deleted)
//        removeFromAudioHelper(this.src)
        Logger.log('[steps] delete:', this.src)
        return wrapped(...args)
    }, 'WRAPPER')

    libWrapper.register(Constants.moduleName, 'Sound.prototype.play', function (wrapped, ...args) {
        const userStatus = userSoundState(this.src)
        if (userStatus === SoundSyncStatus.playing) {
            Logger.log('[steps] update alredy playing track:', this.src)
            removeAllDuplicatedSounds(this.src)
            return wrapped(...args)
        } else {
            const trackStatus = findSoundState(this.src)
            if (trackStatus !== SoundSyncStatus.playing && trackStatus !== SoundSyncStatus.holded) {
                Logger.log(`[steps] hold track (${trackStatus} | ${userStatus}):`, this.src)
                updateUserSoundStatus(this.src, SoundSyncStatus.holded)
                saveArgsForSound(this.src, args)
            } else {
                Logger.log(`[steps] start play track (with status ${trackStatus}):`, this.src)
                updateUserSoundStatus(this.src, SoundSyncStatus.playing)
                removeAllDuplicatedSounds(this.src)
                return wrapped(...args)
            }
        }
    }, 'MIXED')
}

function removeAllDuplicatedSounds(src) {
    let keys = [];
    for (let [key, value] of game.audio.playing) {
        if (value.src === src) {
            keys.push(key);
        }
    }
    keys.pop()

    for (const key in keys) {
        let sound = game.audio.playing.get(key)
        if (sound) {
            sound.stop()
        }
    }
}

function handlePlaylistChanges(playlist) {
    for (const sound of playlist.sounds.values()) {
        if (sound.playing) {
            sound.setFlag(Constants.moduleName, 'syncable', true)
        } else if (sound.getFlag(Constants.moduleName, 'syncable') === true) {
            sound.setFlag(Constants.moduleName, 'syncable', false)
            sound.unsetFlag(Constants.moduleName, 'status')
        }
    }
}

async function updateUserSoundStatus(src, status) {
    var sounds = game.user.getFlag(Constants.moduleName, 'sounds') || []
    var updated = false

    if (status) {
        for (const item of sounds) {
            if (item.src === src) {
                if (item.status === status) {
                    return
                }
                item.status = status
                updated = true
            }
        }
    } else {
        sounds = sounds.filter(item => item.src !== src)
        updated = true
    }

    if (updated) {
        await game.user.setFlag(Constants.moduleName, 'sounds', sounds)
    } else if (status) {
        sounds = [...sounds, { src: src, status: status }]
        await game.user.setFlag(Constants.moduleName, 'sounds', sounds)
    }
}

async function updateSoundsOnUpdateUser(id, sounds) {
    Logger.log('updateSoundsOnUpdateUser(id, sounds)')
    const statuses = sounds.reduce((dict, item) => {
        dict[item.src] = soundState(item.src)
        return dict
    }, {})
    for (const playlist of game.playlists.values()) {
        for (const sound of playlist.sounds.values()) {
            if (statuses[sound.path]) {
                let status = statuses[sound.path]
                if (sound.getFlag(Constants.moduleName, 'status') !== status) {
                    sound.setFlag(Constants.moduleName, 'status', status)
                }
                let color = colorForSyncStatus(status)
                if (sound.getFlag(Constants.moduleName, 'ui-indicator-color') !== color) {
                    sound.setFlag(Constants.moduleName, 'ui-indicator-color', color)
                }
                const users = game.users.contents.map(function (user) {
                    const items = user.getFlag(Constants.moduleName, 'sounds') || []
                    const status = items.filter(item => item.src === sound.path)[0]?.status
                    return {
                        userId: user.id,
                        name: user.name,
                        status: status,
                        color: colorForSyncStatus(status)
                    }
                })
                if (sound.getFlag(Constants.moduleName, 'sync-users') !== users) {
                    sound.setFlag(Constants.moduleName, 'sync-users', users)
                }
            }
        }
    }
}

async function clearDeletedSoundsFromUser(user) {
    var sounds = user.getFlag(Constants.moduleName, 'sounds')
    if (sounds) {
        sounds = sounds.filter(item => item.status !== SoundSyncStatus.deleted)
        await user.setFlag(Constants.moduleName, 'sounds', sounds)
    }
}

function colorForSyncStatus(status) {
    switch (status) {
        case SoundSyncStatus.downloading:
            return 'orange'
        case SoundSyncStatus.holded:
            return 'yellow'
        case SoundSyncStatus.playing:
            return 'green'
        default:
            return 'red'
    }
}

function userSoundState(src) {
    const sounds = game.user.getFlag(Constants.moduleName, 'sounds') || []
    for (const sound of sounds) {
        if (sound.src === src) {
            return sound.status
        }
    }
    return SoundSyncStatus.none
}

function soundState(src) {
    const userStatuses = game.users.contents.map(function (user) {
        const items = user.getFlag(Constants.moduleName, 'sounds') || []
        return items.filter(item => item.src === src)[0]?.status || SoundSyncStatus.none
    })

    if (userStatuses.every(item => item === SoundSyncStatus.holded)) {
        return SoundSyncStatus.holded
    } else if (userStatuses.every(item => item === SoundSyncStatus.playing)) {
        return SoundSyncStatus.playing
    } else if (userStatuses.every(item => item === SoundSyncStatus.deleted)) {
        return SoundSyncStatus.deleted
    } else if (userStatuses.includes(SoundSyncStatus.downloading)) {
        return SoundSyncStatus.downloading
    } else {
        return SoundSyncStatus.none
    }
}

function createInAudioHelperIfNeed(src) {
    if (!src) { return }
    if (!game.audio.holding) {
        game.audio.holding = {}
    }
    if (!game.audio.holding[src]) {
        game.audio.holding[src] = {
            args: undefined,
            status: SoundSyncStatus.none
        }
    }
}

function removeFromAudioHelper(src) {
    if (!src) { return }

    delete game.audio.holding[src]
}

function findSoundState(src) {
    if (!src || !game.audio.holding || !game.audio.holding[src] ) { return SoundSyncStatus.none }

    return game.audio.holding[src].status
}

function setSoundState(src, status) {
    if (!src) { return }

    createInAudioHelperIfNeed(src)
    Logger.log('set game.audio.holding status:', status)
    game.audio.holding[src].status = status
}

function saveArgsForSound(src, args) {
    if (!src) { return }

    createInAudioHelperIfNeed(src)
    game.audio.holding[src].args = args
}

function popArgsForSound(src) {
    if (!src) { return }

    const args = game.audio.holding[src].args
    game.audio.holding[src].args = undefined
    return args
}
