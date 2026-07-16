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
        fs.mkdirSync('./static/libs', { recursive: true });

        const json = await fetchJson('https://s3.amazonaws.com/www.collab.codes/latest.json');
        console.log('Get version files');

        const libsBase = `https://collab.codes/libs/${json.libs}`;
        const urlMonaco = `https://collab.codes/monaco/${json.monaco}/monaco.d.ts`;

        // Type defs consumed by Studio/monaco and mls-base tsc.
        await downloadFile(urlMonaco, './types/monaco.d.ts');
        console.log('Get monaco definition');

        await downloadFile(`${libsBase}/mls.d.ts`, './types/mls.d.ts');
        console.log('Get lib definition');

        // Runtime lib served on the VM at /libs/* (window.mls). The cbe static
        // handler serves this disk cache first and the on.collab.codes origin has
        // no /libs/mls.js fallback, so the VM depends on these files being current.
        await downloadFile(`${libsBase}/mls.js`, './static/libs/mls.js');
        await downloadFile(`${libsBase}/mls.js.map`, './static/libs/mls.js.map');
        await downloadFile(`${libsBase}/mls.d.ts`, './static/libs/mls.d.ts');
        await downloadFile(`${libsBase}/global.d.ts`, './static/libs/global.d.ts');
        console.log('Get runtime lib (static/libs)');

    } catch (error) {
        throw new Error('Erro dowloads files:' + error.message)
    }
}


module.exports = { runDownload };

// Run the download when invoked directly (postInstall and the publish refresh),
// while still allowing `require()` to only import runDownload.
if (require.main === module) {
    runDownload().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}
