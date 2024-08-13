const fs = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');
const { runExecutable, cleanupTempFiles } = require('./utils');
const { copyMetadata, extractMetadata } = require('./metadataHandler');

function formatTime(seconds) {
  if (seconds < 60) {
    return `${seconds.toFixed(1)} seconds`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(1);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} seconds`;
  }
}

async function processImages(folderPath, sendUpdate) {
  let exifToolStartTime, exifToolEndTime, metadataStartTime, metadataEndTime;

  try {
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, 'haritha');

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath);
    }

    sendUpdate(`Output files will be stored in: ${outputPath}`);

    sendUpdate('Starting image resize...');
    const resizeLog = await runExecutable('resize.exe', ['-i', folderPath, '-o', outputPath]);
    sendUpdate(`Resize Log: ${resizeLog}`);

    sendUpdate('Processing CR2 and ARW files...');
    exifToolStartTime = performance.now();
    const exifToolArgs = [
      '-ext', 'cr2', '-ext', 'arw', '-b', '-previewimage',
      '-w!', path.join(outputPath, '%f.jpg'), '-r', folderPath
    ];
    const exifLog = await runExecutable('exiftool.exe', exifToolArgs);
    sendUpdate(`ExifTool Log (CR2 and ARW): ${exifLog}`);

    sendUpdate('Processing NEF files...');
    const nefArgs = [
      '-b', '-jpgfromraw', '-w', path.join(outputPath, '%f.jpg'),
      '-ext', 'nef', '-r', folderPath,
    ];
    const nefLog = await runExecutable('exiftool.exe', nefArgs);
    exifToolEndTime = performance.now();
    sendUpdate(`ExifTool NEF Log: ${nefLog}`);

    sendUpdate('Copying metadata...');
    metadataStartTime = performance.now();
    const metadataCopyResult = await copyMetadata(folderPath, outputPath);
    sendUpdate(`Metadata copy ${metadataCopyResult.success ? 'succeeded' : 'failed'}`);

    sendUpdate('Cleaning up temporary files...');
    await cleanupTempFiles(outputPath);

    sendUpdate('Extracting metadata...');
    const metadataResult = await extractMetadata(outputPath);
    metadataEndTime = performance.now();
    sendUpdate(`Metadata extraction ${metadataResult.success ? 'succeeded' : 'failed'}`);

    const exifToolTime = (exifToolEndTime - exifToolStartTime) / 1000;
    const metadataTime = (metadataEndTime - metadataStartTime) / 1000;
    const totalExifAndMetadataTime = exifToolTime + metadataTime;

    sendUpdate({
      type: 'processing-complete',
      data: {
        resizeLog,
        exifLog: exifLog + '\n' + nefLog,
        outputPath,
        metadataCopyResult,
        metadataExtraction: metadataResult,
        exifToolTime: formatTime(exifToolTime),
        metadataTime: formatTime(metadataTime),
        totalTime: formatTime(totalExifAndMetadataTime)
      }
    });

  } catch (error) {
    console.error('Unhandled error in processImages:', error);
    sendUpdate('processing-error', error.message || 'An unknown error occurred');
  }
}

module.exports = { processImages };
