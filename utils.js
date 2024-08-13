const { app } = require('electron');
const path = require('path');
const { execFile } = require('child_process');
const fs = require('fs');

/**
 * Get the path to an executable.
 * @param {string} executableName - Name of the executable.
 * @returns {string} Path to the executable.
 */
function getExecutablePath(executableName) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', executableName);
  } else {
    return path.join(__dirname, 'resources', executableName);
  }
}

/**
 * Runs an executable with the given arguments.
 * @param {string} executableName - Name of the executable.
 * @param {string[]} args - Arguments to pass to the executable.
 * @returns {Promise<string>} Output from the executable.
 */
function runExecutable(executableName, args) {
  const executablePath = getExecutablePath(executableName);
  console.log('Running:', executablePath, args.join(' '));
  return new Promise((resolve, reject) => {
    execFile(executablePath, args, (error, stdout, stderr) => {
      if (error) {
        reject(`${error.message}\n${stderr}`);
      } else {
        resolve(stdout + '\n' + stderr);
      }
    });
  });
}

/**
 * Cleans up temporary files in a directory.
 * @param {string} directory - Path to the directory to clean.
 * @returns {Promise<void>}
 */
function cleanupTempFiles(directory) {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) {
        console.error('Error reading directory for cleanup:', err);
        reject(err);
        return;
      }

      const deletePromises = files.map(file => {
        return new Promise((resolveFile, rejectFile) => {
          if (file.endsWith('_exiftool_tmp') || file.endsWith('_original')) {
            fs.unlink(path.join(directory, file), (err) => {
              if (err) {
                console.error(`Error deleting file ${file}:`, err);
                rejectFile(err);
              } else {
                console.log(`Deleted temporary file: ${file}`);
                resolveFile();
              }
            });
          } else {
            resolveFile();
          }
        });
      });

      Promise.all(deletePromises)
        .then(() => {
          console.log('Cleanup completed');
          resolve();
        })
        .catch(error => {
          console.error('Error during cleanup:', error);
          reject(error);
        });
    });
  });
}

module.exports = { getExecutablePath, runExecutable, cleanupTempFiles };
