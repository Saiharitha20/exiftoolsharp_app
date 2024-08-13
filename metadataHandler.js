const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const exifr = require('exifr');
const { getExecutablePath } = require('./utils');

function copyMetadata(rawDir, jpgDir) {
  return new Promise((resolve, reject) => {
    console.log('Starting metadata copy...');

    try {
      const rawFiles = fs.readdirSync(rawDir);
      const jpgFiles = fs.readdirSync(jpgDir);

      let processedFiles = 0;
      rawFiles.forEach((rawFile, index) => {
        const rawBase = path.basename(rawFile, path.extname(rawFile));
        const matchingJpg = jpgFiles.find(jpgFile => path.basename(jpgFile, '.jpg') === rawBase);

        if (matchingJpg) {
          const rawFilePath = path.join(rawDir, rawFile);
          const jpgFilePath = path.join(jpgDir, matchingJpg);
          const exiftoolPath = getExecutablePath('exiftool.exe');
          exec(`"${exiftoolPath}" -tagsFromFile "${rawFilePath}" -all:all -overwrite_original "${jpgFilePath}"`, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error copying metadata from ${rawFilePath} to ${jpgFilePath}:`, stderr);
            } else {
              console.log(`Copied metadata from ${rawFilePath} to ${jpgFilePath}:`, stdout);
            }
            processedFiles++;
            if (processedFiles === rawFiles.length) {
              console.log('Metadata copy completed');
              resolve({ success: true });
            }
          });
        } else {
          console.warn(`No matching JPG found for RAW file ${rawFile}`);
          processedFiles++;
          if (processedFiles === rawFiles.length) {
            console.log('Metadata copy completed');
            resolve({ success: true });
          }
        }
      });
    } catch (error) {
      console.error('Error processing directories:', error.message);
      reject({ success: false, error: error.message });
    }
  });
}

async function extractMetadata(directoryPath) {
  console.log('Starting metadata extraction...');

  const metadataList = [];

  try {
    const files = fs.readdirSync(directoryPath);
    console.log(`Found ${files.length} files in directory: ${directoryPath}`);

    for (const file of files) {
      if (file === 'metadata.json') continue;

      const filePath = path.join(directoryPath, file);
      console.log(`Processing file: ${filePath}`);
      
      if (isImage(filePath)) {
        try {
          console.log(`Attempting to extract metadata from: ${filePath}`);
          const metadata = await exifr.parse(filePath);
          if (metadata) {
            metadataList.push({ file, metadata });
            console.log(`Metadata extracted for ${file}`);
          } else {
            console.warn(`No metadata found for ${file}`);
          }
        } catch (error) {
          console.error(`Error extracting metadata from ${file}:`, error.message);
        }
      } else {
        console.warn(`${file} is not a supported image format`);
      }
    }

    const outputFilePath = path.join(directoryPath, 'metadata.json');
    fs.writeFileSync(outputFilePath, JSON.stringify(metadataList, null, 2));
    console.log(`Metadata saved to ${outputFilePath}`);
    console.log('Metadata extraction completed');
    return { success: true, outputFilePath };
  } catch (error) {
    console.error('Error during metadata extraction:', error.message);
    return { success: false, error: error.message };
  }
}

function isImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.tiff', '.cr2', '.arw', '.nef'].includes(ext);
}

module.exports = { copyMetadata, extractMetadata, isImage };
