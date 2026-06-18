const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fetch = require('node-fetch');

async function downloadFile(url, path) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const fileStream = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', err => {
            reject(err);
        });
        fileStream.on('finish', function () {
            resolve();
        });
        fileStream.on('error', function (err) {
            reject(err);
        });
    });

}

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao baixar o arquivo JSON:', error);
    }
}

async function runDownload() {
    try {

        fs.mkdirSync('./types', { recursive: true });

        const json = await fetchJson('https://s3.amazonaws.com/www.collab.codes/latest.json');
        console.log('Get version files');

        const urlMonaco = `https://collab.codes/monaco/${json.monaco}/monaco.d.ts`;
        const urlMls = `https://collab.codes/libs/${json.libs}/mls.d.ts`;

        await downloadFile(urlMonaco, './types/monaco.d.ts');
        console.log('Get monaco definition');

        await downloadFile(urlMls, './types/mls.d.ts');
        console.log('Get lib definition');

    } catch (error) {
        throw new Error('Erro dowloads files:' + error.message)
    }
}


module.exports = { runDownload };
