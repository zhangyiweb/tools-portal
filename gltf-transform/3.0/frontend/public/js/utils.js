const AppUtils = {
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    },

    setupDropZone(dropZone, fileInput, onFiles) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'));
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
        });

        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) onFiles(e.target.files);
        });
    },

    buildResultTable(tbody, rows) {
        tbody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.label}</td>
                <td>${row.original}</td>
                <td>${row.result}</td>
                <td>${row.change}</td>
            </tr>
        `).join('');
    }
};
