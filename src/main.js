const {app, BrowserWindow} = require('electron')
const settings = require('./main-process/settings')
const project = require('./main-process/project')

const path = require('path')
const url = require('url')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Load application settings
  settings.load()

  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1280, height: 720, backgroundColor: '#2a323d', minWidth: 1280, minHeight: 720})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, project.project ? 'application.html' : 'welcome.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })

  // Create the application menu
  require('./main-process/menus/application-menu.js')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('before-quit', function (e) {
  if (!project.checkChanges())
    e.preventDefault()
})

exports.redirect = function (file) {
  mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, file),
        protocol: 'file:',
        slashes: true
    }))
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
