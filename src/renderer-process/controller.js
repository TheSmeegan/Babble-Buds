// This file handles communications between the various parts of the program

// Imports
const remote = require('electron').remote
const BrowserWindow = remote.BrowserWindow
const application = require('./application.js')
const editor = require('./editor.js')
const network = require('./network.js')
const status = require('./status.js')
const Stage = require('./stage.js').Stage
const path = require('path')
const url = require('url')

// Vars
var project
var stage
var puppet
var hotbar = []
var popout

exports.init = function() {
	project = remote.getGlobal('project').project
	status.init()
	status.log('Loading project...')
	application.init()
	network.init()
	stage = new Stage('screen', project.project, project.assets, project.assetsPath, loadPuppets)
}

exports.setPuppetLocal = function(index) {
	if (!hotbar[index]) return

	// Set Puppet
	stage.setPuppet(puppet.id, hotbar[index])
	puppet = hotbar[index]

	// Update Editor
	application.setPuppet(index, puppet.emotes)

	// Update Project
	project.actor.id = project.project.hotbar[index]

	// Update Server
	network.emit('set puppet', puppet.id, project.getPuppet())

	// Update popout
	if (popout) popout.webContents.send('set puppet', puppet.id, project.project.hotbar[index])
}

exports.setEmoteLocal = function(emote) {
	// Change Emote
	exports.setEmote(puppet.id, emote)

	// Update Editor
	application.setEmote(puppet.emote)

	// Update Project
	project.actor.emote = emote

	// Update Server
	network.emit('set emote', puppet.id, emote)
}

exports.moveLeftLocal = function() {
	// Move Left
	exports.moveLeft(puppet.id)

	// Update Project
	project.actor.facingLeft = puppet.facingLeft
	project.actor.position = ((puppet.target % (project.project.numCharacters + 1)) + (project.project.numCharacters + 1)) % (project.project.numCharacters + 1)

	// Update Server
	network.emit('move left', puppet.id)
}

exports.moveRightLocal = function() {
	// Move Right
	exports.moveRight(puppet.id)

	// Update Project
	project.actor.facingLeft = puppet.facingLeft
	project.actor.position = puppet.target % (project.project.numCharacters + 1)

	// Update Server
	network.emit('move right', puppet.id)
}

exports.startBabblingLocal = function() {
	// Start Babbling
	exports.startBabbling(puppet.id)

	// Update Editor
	application.setBabble(true)

	// Update Server
	network.emit('start babbling', puppet.id)
}

exports.stopBabblingLocal = function() {
	// Stop Babbling
	exports.stopBabbling(puppet.id)

	// Update Editor
	application.setBabble(false)

	// Update Server
	network.emit('stop babbling', puppet.id)
}

exports.setPuppet = function(id, puppet) {
	// Set Puppet
	stage.setPuppet(id, stage.createPuppet(puppet))

	// Update popout
	if (popout) popout.webContents.send('set puppet', id, puppet)
}

exports.setEmote = function(id, emote) {
	// Change Emote
	stage.getPuppet(id).changeEmote(emote)

	// Update popout
	if (popout) popout.webContents.send('set emote', id, emote)
}

exports.moveLeft = function(id) {
	var puppet = stage.getPuppet(id)

	// Move Left
	puppet.moveLeft()

	// Update popout
	if (popout) popout.webContents.send('move left', id)

	return puppet
}

exports.moveRight = function(id) {
	var puppet = stage.getPuppet(id)

	// Move Right
	puppet.moveRight()

	// Update popout
	if (popout) popout.webContents.send('move right', id)

	return puppet
}

exports.startBabbling = function(id) {
	// Start Babbling
	stage.getPuppet(id).setBabbling(true)

	// Update popout
	if (popout) popout.webContents.send('start babbling', id)
}

exports.stopBabbling = function(id) {
	// Stop Babbling
	stage.getPuppet(id).setBabbling(false)

	// Update popout
	if (popout) popout.webContents.send('stop babbling', id)
}

exports.popIn = function() {
	popout.close()
}

exports.popOut = function() {
	if (project.project.transparent)
		popout = new BrowserWindow({frame: false, parent: remote.getCurrentWindow(), transparent: true})
	else
		popout = new BrowserWindow({frame: false, parent: remote.getCurrentWindow(), backgroundColor: project.project.greenScreen})
	// popout.setIgnoreMouseEvents(true)
	popout.on('close', () => {
		application.closePopout()
		stage.reattach('screen')
		popout = null
	})
	popout.loadURL(url.format({
		pathname: path.join(__dirname, '../popout.html'),
		protocol: 'file:',
		slashes: true
	  }))
	application.openPopout()
}

exports.emitPopout = function(...args) {
	if (popout) popout.webContents.send(...args)
}

exports.resize = function() {
	stage.resize()
	exports.emitPopout('resize')
}

exports.updateHotbar = function(i, puppet) {
	project.project.hotbar[i] = parseInt(puppet)
	if (puppet === '') {
		hotbar[i] = null
	} else {
		hotbar[i] = stage.createPuppet(project.characters[puppet])
	}
}

exports.addAsset = function(asset) {
	exports.addAssetLocal(asset)
	network.emit('add asset', asset)
}

exports.addAssetLocal = function(asset) {
	project.addAsset(asset)
	stage.addAsset(asset)
	editor.addAsset(asset.tab, asset.hash)
	exports.emitPopout('add asset', asset)
}

exports.moveAsset = function(tab, asset, newTab) {
	exports.moveAssetLocal(tab, asset, newTab)
	network.emit('move asset', tab, asset, newTab)
}

exports.moveAssetLocal = function(tab, asset, newTab) {
    status.log("Moving asset to " + newTab + " list...")
	editor.migrateAsset(tab, asset, newTab)
	project.moveAsset(tab, asset, newTab)
	stage.addAsset({"tab": newTab, "hash": asset, "name": project.assets[newTab][asset].name})
    var characters = Object.keys(project.characters)
    for (var i = 0; i < characters.length; i++) {
    	var character = project.characters[characters[i]]
    	var topLevel = ["body", "head", "hat", "props"]
    	for (var j = 0; j < topLevel.length; j++)
	        for (var k = 0; k < character[topLevel[j]].length; k++)
	        	if (character[topLevel[j]][k].tab === tab && character[topLevel[j]][k].hash === asset)
	        		character[topLevel[j]][k].tab = newTab
	    var emotes = Object.keys(character.emotes)
	    for (var j = 0; j < emotes.length; j++)
	    	for (var k = 0; k < character.emotes[emotes[j]].length; k++)
	    		if (character.emotes[emotes[j]][k].tab === tab && character.emotes[emotes[j]][k].hash === asset)
	    			character.emotes[emotes[j]][k].tab = newTab
	    exports.saveCharacter(character)
    }
    status.log("Moved asset!")
}

exports.deleteAsset = function(tab, asset) {
	exports.deleteAssetLocal(tab, asset)
	network.emit('delete asset', tab, asset)
}

exports.deleteAssetLocal = function(tab, asset) {
    status.log("Deleting asset...")
	editor.deleteAsset(tab, asset)
	project.deleteAsset(tab, asset)
    var characters = Object.keys(project.characters)
    for (var i = 0; i < characters.length; i++) {
    	project.deleteCharAssets(characters[i], tab, asset)
	    exports.saveCharacter(project.characters[characters[i]])
    }
    status.log("Deleted asset!")
}

exports.deleteCharacter = function(character) {
	var index = project.project.hotbar.indexOf(character.id)
	if (index > -1) {
		hotbar[index] = null
		project.project.hotbar[index] = parseInt('')
		application.deleteCharacter(index)
	}
}

exports.updateCharacter = function(index, character) {
	hotbar[index] = stage.createPuppet(character)
}

exports.saveCharacter = function(character, thumbnail) {
    project.saveCharacter(character)
    application.updateCharacter(character, thumbnail)
}

exports.connect = function() {
    stage.clearPuppets()
	if (popout) popout.webContents.send('connect')
}

exports.disconnect = function() {
	stage.clearPuppets()
	puppet = stage.addPuppet(project.getPuppet(), 1)
	if (popout) popout.webContents.send('disconnect', project.getPuppet())
}

exports.host = function() {
	if (popout) {
		popout.webContents.send('connect')
		popout.webContents.send('assign puppet', project.getPuppet())
	}
}

exports.assign = function(id) {
	puppet = stage.addPuppet(project.getPuppet(), id)
	if (popout) popout.webContents.send('assign puppet', project.getPuppet(), id)
}

exports.addPuppet = function(puppet) {
	stage.addPuppet(puppet, puppet.charId)
	if (popout) popout.webContents.send('add puppet', puppet)
}

exports.removePuppet = function(id) {
	stage.removePuppet(id)
	if (popout) popout.webContents.send('remove puppet', id)
}

function loadPuppets() {
	status.log('Loading puppets...', true)

	// Add Puppet
	puppet = stage.addPuppet(project.getPuppet(), 1)

	// Puppet Editor
	editor.init()
	stage.registerPuppetListener('mousedown', (e) => {
		editor.setPuppet(JSON.parse(project.duplicateCharacter(e.target.puppet)))
	})

	// Create Hotbar Puppets
	for (var i = 0; i < project.project.hotbar.length; i++) {
		if (project.project.hotbar[i] !== '' && project.project.hotbar[i] > 0)
			hotbar[i] = stage.createPuppet(project.characters[project.project.hotbar[i]])
	}

	// Update editor
	application.setPuppet(project.project.hotbar.indexOf(project.actor.id), puppet.emotes)
	application.setEmote(puppet.emote)

	status.log('Project Loaded!', false)
}