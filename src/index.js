const fs = require('fs');
const path = require('path');
const request = require('request-promise');
const cheerio = require('cheerio');
const { error } = require('console');

const URL = 'https://books.toscrape.com';
const CACHE_PATH = path.join(__dirname, 'cache', 'catalog-page-1.html'); 

const options = {
    uri: URL,
    headers: {
        'User-Agent': 'FlyRankInternshipA9/1.0 (https://github.com/bishoDev123/The-Polite-Scraper)'
    },
    timeout: 5000,
    resolveWithFullResponse: true,
    simple: false
};

(async () => {
    try {
        let html;

        if(fs.existsSync(CACHE_PATH)) {
            html = fs.readFileSync(CACHE_PATH, 'utf-8');

            console.log('Cache hit');
            console.log(`Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`)
        }
        else {
            const response = await request(options);

            if (response.statusCode !== 200) {
                throw new Error(`fetch failed with status code ${responsse.statusCode}`);
            }
            
            html = response.body;

            fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
            fs.writeFileSync(CACHE_PATH, html, 'utf-8');

            console.log('FETCH');
            console.log(`Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`)
        }
    }
    catch(err) {
        console.log(`Error: ${error.message}`);
        process.exit(1);
    }
})();