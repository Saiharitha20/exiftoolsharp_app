const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const fsExtra = require('fs-extra');
const { processImages } = require('./imageProcessor');
const AutoLaunch = require('auto-launch');
const fastGlob = require('fast-glob');

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('haritha', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('haritha');
}

let mainWindow;
let tray = null;

function setupAutoLaunch() {
  const autoLauncher = new AutoLaunch({
    name: 'Haritha Image Processor',
    path: app.getPath('exe'),
  });

  autoLauncher.isEnabled().then((isEnabled) => {
    if (!isEnabled) autoLauncher.enable();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'resources', 'haritha.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    openFolderDialog();
  });
}

function createTray() {
  let trayIconPath;
  if (app.isPackaged) {
    trayIconPath = path.join(process.resourcesPath, 'resources', 'tray.png');
  } else {
    trayIconPath = path.join(__dirname, 'resources', 'tray.png');
  }

  console.log('Tray Icon Path:', trayIconPath);

  const trayIcon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Haritha Image Processor', click: () => mainWindow.show() },
    { label: 'Process New Images', click: () => openFolderDialog() },
    { type: 'separator' },
    { label: 'Quit Haritha Image Processor', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);
  tray.setToolTip('Haritha Image Processor');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoLaunch();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', (event) => {
  if (process.platform !== 'darwin') {
    event.preventDefault();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function openFolderDialog() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  }).then((result) => {
    if (!result.canceled) {
      const folderPath = result.filePaths[0];
      mainWindow.webContents.send('selected-folder', folderPath);
      const sendUpdate = (message) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (typeof message === 'object' && message.type === 'processing-complete') {
            mainWindow.webContents.send('processing-complete', message.data);
          } else {
            mainWindow.webContents.send('processing-update', message);
          }
        }
      };
      processImages(folderPath, sendUpdate);
    }
  }).catch((err) => {
    console.error(err);
  });
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.on('process-images', (event, folderPath) => {
  const sendUpdate = (message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (typeof message === 'object' && message.type === 'processing-complete') {
        mainWindow.webContents.send('processing-complete', message.data);
      } else {
        mainWindow.webContents.send('processing-update', message);
      }
    }
  };

  processImages(folderPath, sendUpdate);
});

ipcMain.on('process-files', async (event, { csvData, photoFolderPath }) => {
  console.log('Received photo folder path:', photoFolderPath);
  console.log('Received CSV data:', csvData);
  
  try {
      const parsedCsvData = parse(csvData, { columns: true, skip_empty_lines: true });
      console.log('Parsed CSV data:', parsedCsvData);

      if (parsedCsvData.length === 0) {
          throw new Error('No data found in CSV file');
      }

      // Use FastGlob to get all image files in the folder
      const imageFiles = await fastGlob(['**/*.{jpg,jpeg,png,gif,bmp,nef,cr2,arw}'], {
          cwd: photoFolderPath,
          onlyFiles: true,
          caseSensitiveMatch: false
      });

      console.log('Found image files:', imageFiles);

      const results = [];

      for (const row of parsedCsvData) {
          const albumName = row['album name'];
          const fileName = row['file name'];

          console.log('Processing row:', row);

          if (typeof albumName !== 'string' || typeof fileName !== 'string') {
              console.error('Invalid album name or file name:', albumName, fileName);
              results.push({ fileName, albumName, status: 'Error: Invalid album name or file name' });
              continue;
          }

          // Create album folder
          const albumPath = path.join(path.dirname(photoFolderPath), albumName);
          fsExtra.ensureDirSync(albumPath);
          console.log('Created album folder:', albumPath);

          // Find the file (case-insensitive)
          const matchedFile = imageFiles.find(file => file.toLowerCase() === fileName.toLowerCase());

          if (matchedFile) {
              const sourcePath = path.join(photoFolderPath, matchedFile);
              const destPath = path.join(albumPath, matchedFile);
              fsExtra.copySync(sourcePath, destPath);
              console.log(`Copied ${matchedFile} to ${albumPath}`);
              results.push({ fileName: matchedFile, albumName, status: 'Copied successfully' });
          } else {
              console.log(`File not found: ${fileName}`);
              results.push({ fileName, albumName, status: 'Error: File not found' });
          }
      }

      event.reply('processing-complete', {
          message: 'Photo organization complete! Photos have been copied to their respective albums while remaining in their original location.',
          results: results
      });
  } catch (error) {
      console.error('Error processing files:', error);
      event.reply('processing-complete', {
          message: `Error: ${error.message}`,
          results: []
      });
  }
});
