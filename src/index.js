const fs = require('fs');

const path = require('path');

const request = require('request-promise');

const cheerio = require('cheerio');

const START_URL = 'https://books.toscrape.com';

const CACHE_PATH = path.join(__dirname, '..', 'cache');

const options = {
    uri: START_URL,

    headers: {
        'User-Agent':
            'FlyRankInternshipA9/1.0 (+https://github.com/bishoDev123/The-Polite-Scraper)'
    },

    timeout: 5000,

    resolveWithFullResponse: true,

    simple: false
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPage(url, pageNumber) {
    const cachePath = path.join(
        CACHE_PATH,
        `catalogue-page-${pageNumber}.html`
    );

    if (fs.existsSync(cachePath)) {
        const html = fs.readFileSync(cachePath, 'utf-8');

        console.log(`Cache hit page: ${pageNumber}`);

        console.log(
            `Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`
        );

        return html;
    }

    if (pageNumber > 1) {
        await sleep(500);
    }

    const response = await request({
        ...options,
        uri: url
    });

    if (response.statusCode !== 200) {
        throw new Error(
            `fetch failed with status code ${response.statusCode}`
        );
    }

    const html = response.body;

    fs.mkdirSync(CACHE_PATH, { recursive: true });

    fs.writeFileSync(cachePath, html, 'utf-8');

    console.log('FETCH');

    console.log(
        `Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`
    );

    return html;
}

(async () => {
    try {
        let pageUrl = START_URL;

        const discoveredUrls = new Set();

        for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
            const html = await getPage(pageUrl, pageNumber);

            const $ = cheerio.load(html);

            $('article.product_pod h3 a').each((index, element) => {
                const href = $(element).attr('href');

                if (href) {
                    const absoluteUrl = new URL(href, pageUrl).href;
                    discoveredUrls.add(absoluteUrl);
                }
            });

        }
        console.log(`catalogue_pages=3`);

        console.log(`discovered=${discoveredUrls.size}`);

        console.log(`unique_urls=${discoveredUrls.size}`);
    }
    catch (err) {
        console.log(`Error: ${err.message}`);
        process.exit(1);
    }
})();