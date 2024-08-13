document.getElementById('processImages').addEventListener('click', async () => {
  const folderPath = await window.electronAPI.selectFolder();
  if (folderPath) {
    window.electronAPI.processImages(folderPath);
    document.getElementById('output').textContent = 'Processing images...';
  }
});

window.electronAPI.onSelectedFolder((folderPath) => {
  document.getElementById('output').textContent = `Selected folder: ${folderPath}\nProcessing images...`;
});

window.electronAPI.onProcessingUpdate((message) => {
  const outputElement = document.getElementById('output');
  outputElement.textContent += message + '\n';
  outputElement.scrollTop = outputElement.scrollHeight;
});

window.electronAPI.onProcessingComplete((data) => {
  const outputElement = document.getElementById('output');
  if (data.results) {
    // This is for the mapping results
    outputElement.innerHTML = `<h3>${data.message}</h3>`;
    
    if (data.results.length > 0) {
      const table = document.createElement('table');
      table.innerHTML = `
        <tr>
          <th>File Name</th>
          <th>Album Name</th>
          <th>Status</th>
        </tr>
      `;
      
      data.results.forEach(result => {
        const row = table.insertRow();
        row.insertCell(0).textContent = result.fileName;
        row.insertCell(1).textContent = result.albumName;
        row.insertCell(2).textContent = result.status;
      });
      
      outputElement.appendChild(table);
    }
  } else {
    // This is for the image processing results
    outputElement.textContent += `
Processing complete!
Output path: ${data.outputPath}
Resize Log: ${data.resizeLog}
Exif Log: ${data.exifLog}
Metadata Copy Result: ${JSON.stringify(data.metadataCopyResult, null, 2)}
Metadata Extraction Result: ${JSON.stringify(data.metadataExtraction, null, 2)}

Execution Times:
ExifTool Time: ${data.exifToolTime}
Metadata Time: ${data.metadataTime}
Total ExifTool and Metadata Time: ${data.totalTime}
    `;
  }
  outputElement.scrollTop = outputElement.scrollHeight;
});

window.electronAPI.onProcessingError((error) => {
  document.getElementById('output').textContent += `Error: ${error}\n`;
});

let csvData, photoFolderPath;

document.getElementById('csvFile').addEventListener('change', (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        csvData = e.target.result;
        console.log('CSV data loaded');
    };
    reader.readAsText(file);
});

document.getElementById('photoFolder').addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        photoFolderPath = files[0].path;
        // Extract the directory path
        photoFolderPath = photoFolderPath.split('\\').slice(0, -1).join('\\');
        console.log('Photo folder selected:', photoFolderPath);
    }
});

document.getElementById('processButton').addEventListener('click', () => {
    if (!csvData || !photoFolderPath) {
        document.getElementById('output').textContent += 'Please select both CSV file and photo folder.\n';
        return;
    }

    console.log('CSV data to be sent:', csvData);
    console.log('Photo folder path to be sent:', photoFolderPath);

    // Use IPC to send data to main process
    window.electronAPI.sendProcessFiles({ csvData, photoFolderPath });
});