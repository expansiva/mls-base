const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fetch = require('node-fetch');

const mainProjects = {
    "100554": {
        "repo": "https://github.com/expansiva/mls-100554.git"
    },
    "102020": {
        "repo": "https://github.com/expansiva/mls-102020.git"
    },
    "102025": {
        "repo": "https://github.com/expansiva/mls-102025.git"
    },
    "102027": {
        "repo": "https://github.com/expansiva/mls-102027.git"
    },
    "102029": {
        "repo": "https://github.com/expansiva/mls-102029.git"
    },
    "102032": {
        "repo": "https://github.com/expansiva/mls-102032.git"
    },
    "102033": {
        "repo": "https://github.com/expansiva/mls-102033.git"
    },
    "102034": {
        "repo": "https://github.com/expansiva/mls-102034.git"
    },
    "102036": {
        "repo": "https://github.com/expansiva/mls-102036.git"
    },
    "102040": {
        "repo": "https://github.com/expansiva/mls-102040.git"
    }

}

async function pullMainProjects() {
    for (const [projectId] of Object.entries(mainProjects)) {
        const destPath = path.join('.', `mls-${projectId}`);

        if (!fs.existsSync(destPath)) {
            console.log(`mls-${projectId} not found, skipping`);
            continue;
        }

        console.log(`Pulling mls-${projectId}...`);
        execSync(`git -C "${destPath}" pull`, { stdio: 'inherit' });
        console.log(`mls-${projectId} updated`);
    }
}

async function cloneMainProjects() {
    for (const [projectId, project] of Object.entries(mainProjects)) {
        const destPath = path.join('.', `mls-${projectId}`);

        if (fs.existsSync(destPath)) {
            console.log(`mls-${projectId} already exists, skipping`);
            continue;
        }

        console.log(`Cloning mls-${projectId} from ${project.repo}...`);
        execSync(`git clone "${project.repo}" "${destPath}"`, { stdio: 'inherit' });
        console.log(`mls-${projectId} cloned`);
    }
}

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

        await cloneMainProjects();

    } catch (error) {
        throw new Error('Erro dowloads files:' + error.message)
    }
}


module.exports = { runDownload, pullMainProjects };

const command = process.argv[2];

if (command === 'update') {
    pullMainProjects().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
} else {
    runDownload().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}
