const fs = require('fs-extra')
const remote = require('electron').remote
const dialog = remote.dialog
const main = remote.require('./main')
const settings = remote.require('./main-process/settings')
const menu = remote.require('./main-process/menus/application-menu')
const controller = require('./controller')
const editor = require('./editor')

const path = require('path')

module.exports = {
    // project: {},
    // characters: {},
    // assets: {},
    // charactersPath: "",
    // assetsPath: "",
    // numCharacters: 0,
    // actor: {},
	readProject: function() {
		if (!this.checkChanges()) return

        let filepath = remote.getGlobal('project').filepath
		fs.readJson(filepath, (err, proj) => {
			if (err) {
				main.redirect('welcome.html')
				return
			}

			remote.getGlobal('project').project = this
			this.project = proj
			this.oldProject = JSON.stringify(proj)
			this.characters = {}
			this.assets = {}
			this.charactersPath = path.join(filepath, '..', 'characters')
			this.assetsPath = path.join(filepath, '..', 'assets')
			this.numCharacters = 0
			for (let i = 0; i < proj.characters.length; i++) {
				let character = this.characters[proj.characters[i].id] = fs.readJsonSync(path.join(this.charactersPath, proj.characters[i].location))
				character.name = proj.characters[i].name
				character.id = proj.characters[i].id
				if (proj.characters[i].id > this.numCharacters)
					this.numCharacters = proj.characters[i].id
				if (Object.prototype.toString.call(character.emotes) === "[object Object]") {
					// Convert from object to array
					let arr = []
					let emotes = ['default', 'happy', 'wink', 'kiss', 'angry', 'sad', 'ponder', 'gasp', 'veryangry', 'verysad', 'confused', 'ooo']
					for (let i = 0; i < emotes.length; i++) {
						if (character.emotes[emotes[i]]) {
							let emote = character.emotes[emotes[i]]
							emote.name = emotes[i]
							arr.push(emote)
						} else {
							arr.push({
								enabled: false,
								mouth: [],
								eyes: [],
								name: emotes[i]
							})
						}
					}
					character.emotes = arr
					character.emote = emotes.indexOf(character.emote || "default")
					if (proj.actor.id === character.id) {
						proj.actor.emote = emotes.indexOf(character.emote || "default")
					}
					for (let i = 0; i < character.eyes.length; i++) {
						character.eyes[i] = emotes.indexOf(character.eyes[i] || "default")
					}
					for (let i = 0; i < character.mouths.length; i++) {
						character.mouths[i] = emotes.indexOf(character.mouths[i] || "default")
					}
				}
			}
			this.oldCharacters = JSON.stringify(this.characters)
			this.actor = proj.actor
			for (let i = 0; i < proj.assets.length; i++) {
				this.assets[proj.assets[i].name] = fs.readJsonSync(path.join(this.assetsPath, proj.assets[i].location))
			}
			this.oldAssets = JSON.stringify(this.assets)

			for (let i = 0; i < this.project.characters.length; i++) {
				fs.removeSync(path.join(this.assetsPath, '..', 'thumbnails', 'new-' + this.project.characters[i].id + '.png'))
				fs.removeSync(path.join(this.assetsPath, '..', 'thumbnails', 'new-' + this.project.characters[i].id))
			}

			settings.settings.openProject = filepath
			settings.save()
            controller.init()
			menu.updateMenu()
		})
	},
	saveProject: function() {
		fs.writeFile(settings.settings.openProject, JSON.stringify(this.project, null, 4))
		for (let i = 0; i < this.project.assets.length; i++)
			fs.writeFile(path.join(settings.settings.openProject, '..', 'assets', this.project.assets[i].location), JSON.stringify(this.assets[this.project.assets[i].name], null, 4))
		for (let i = 0; i < this.project.characters.length; i++) {
			fs.writeFile(path.join(settings.settings.openProject, '..', 'characters', this.project.characters[i].location), JSON.stringify(this.characters[this.project.characters[i].id], null, 4))
			if (fs.existsSync(path.join(this.assetsPath, '..', 'thumbnails', 'new-' + this.project.characters[i].id + '.png')))
                fs.renameSync(path.join(this.assetsPath, '..', 'thumbnails', 'new-' + this.project.characters[i].id + '.png'), 
                	path.join(this.assetsPath, '..', 'thumbnails', this.project.characters[i].id + '.png'))
            if (fs.existsSync(path.join(this.assetsPath, '..', 'thumbnails', 'new-' + this.project.characters[i].id))) {
            	if (fs.existsSync(path.join(this.assetsPath, '..', 'thumbnails', '' + this.project.characters[i].id)))
            		fs.removeSync(path.join(this.assetsPath, '..', 'thumbnails', '' + this.project.characters[i].id))
                fs.renameSync(path.join(this.assetsPath, '..', 'thumbnails', 'new-' + this.project.characters[i].id), 
                	path.join(this.assetsPath, '..', 'thumbnails', "" + this.project.characters[i].id))
            }
		}
		settings.addRecentProject(controller.getThumbnail())
		this.oldProject = JSON.stringify(this.project)
		this.oldAssets = JSON.stringify(this.assets)
		this.oldCharacters = JSON.stringify(this.characters)
	},
	closeProject: function() {
		if (!this.checkChanges()) return

		this.project = null
		this.assets = null
		this.characters = null
		this.oldProject = 'null'
		this.oldAssets = 'null'
		this.oldCharacters = 'null'
		settings.settings.openProject = ""
		settings.save()
		editor.clear()
		menu.updateMenu()

		main.redirect('welcome.html')
	},
	// Returns true if its okay to close the project
	checkChanges: function() {
		if (!editor.checkChanges())
        	return false
		let changes = this.oldProject !== JSON.stringify(this.project)
		changes = changes || this.oldAssets !== JSON.stringify(this.assets)
		changes = changes || this.oldCharacters !== JSON.stringify(this.characters)
		if (changes) {
			let response = dialog.showMessageBox({
				"type": "question",
				"buttons": ["Don't Save", "Cancel", "Save"],
				"defaultId": 2,
				"title": "Save Project?",
				"message": "Do you want to save the changes to your project?",
				"detail": "If you don't save, your changes will be lost.",
				"cancelId": 1
			})

			switch (response) {
				default:
					break
				case 1:
					return false
				case 2:
					this.saveProject()
					break
			}
		}

		return true
	},
	addAsset: function(asset) {
		this.addAssetList(asset.tab)
		let newAsset = JSON.parse(JSON.stringify(asset))
		delete newAsset.tab
		delete newAsset.hash
		this.assets[asset.tab][asset.hash] = newAsset
	},
	addAssetList: function(tab) {
		if (this.assets[tab]) return
		this.project.assets.push({"name": tab, "location": tab + '.json'})
		this.assets[tab] = {}
	},
	moveAsset: function(tab, asset, newTab) {
		this.assets[newTab][asset] = this.assets[tab][asset]
		this.assets[newTab][asset].location = path.join(newTab, asset + '.png')
		delete this.assets[tab][asset]
	},
	renameAsset: function(tab, hash, name) {
		this.assets[tab][hash].name = name
	},
	renameAssetList: function(tab, newTab) {
		this.assets[newTab] = this.assets[tab]
		delete this.assets[tab]
		let list = this.project.assets.find((x) => x.name === tab)
		list.name = newTab
		list.location = newTab + ".json"
	},
    deleteAsset: function(tab, asset) {
        delete this.assets[tab][asset]
    },
    deleteAssetList: function(tab) {
        delete this.assets[tab]
        this.project.assets.splice(this.project.assets.indexOf(this.project.assets.find((x) => x.name === tab)), 1)
    },
    saveCharacter: function(character) {
        let char = null
        for (let i = 0; i < this.project.characters.length; i++) {
            if (this.project.characters[i].id == character.id) {
                char = this.project.characters[i]
                break
            }
        }
        if (char === null)
            this.project.characters.push({"name": character.name, "id": character.id, "location": character.id + '.json'})
        else
        	char.name = character.name
        this.characters[character.id] = character
    },
    duplicateCharacter: function(character) {
        this.numCharacters++
        let char = JSON.parse(JSON.stringify(character))
        char.id = this.numCharacters
        return JSON.stringify(char)
    },
    deleteCharacter: function(character) {
        for (let i = 0; i < this.project.characters.length; i++) {
            if (this.project.characters[i].id == character.id) {
                this.project.characters.splice(i, 1)
                delete this.characters[character.id]
                if (character.id == this.numCharacters) this.numCharacters--
                break
            }
        }
	},
    getEmptyCharacter: function() {
        this.numCharacters++
        return JSON.stringify({
            "deadbonesStyle": false,
            "body": [],
            "head": [],
            "hat": [],
            "mouths": [],
            "eyes": [],
            "emotes": [
		        {
		            "enabled": true,
		            "mouth": [],
		            "eyes": [],
		            "name": "default"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "happy"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "wink"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "kiss"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "angry"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "sad"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "ponder"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "gasp"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "veryangry"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "verysad"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "confused"
		        },
		        {
		            "enabled": false,
		            "mouth": [],
		            "eyes": [],
		            "name": "ooo"
		        }
		    ],
            "props": [],
            "name": "New Puppet",
            "id": this.numCharacters
        })
    },
    getPuppet: function() {
        let puppet = JSON.parse(JSON.stringify(this.characters[this.actor.id]))
        puppet.position = this.actor.position
        puppet.emote = this.actor.emote
        puppet.facingLeft = this.actor.facingLeft
        return puppet
    }
}
