const fs = require('fs');
const path = require('path');
const request = require('request-promise');
const cheerio = require('cheerio');

const START_URL = 'https://books.toscrape.com';
const CACHE_PATH = path.join(__dirname, '.', 'cache');
const DATA_CACHE_PATH = path.join(CACHE_PATH, 'books.json');

const options = {
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

async function getPage(url, cachePath) {
    // Check cache first
    if (fs.existsSync(cachePath)) {
        const html = fs.readFileSync(cachePath, 'utf-8');

        console.log(`Cache hit: ${cachePath}`);
        console.log(
            `Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`
        );

        return html;
    }

    // Be polite between requests
    await sleep(500);

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

    console.log(`FETCH: ${url}`);
    console.log(
        `Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`
    );

    return html;
}

async function scrapeBook(url, bookNumber) {
    const cachePath = path.join(
        CACHE_PATH,
        `book-${bookNumber}.html`
    );

    const html = await getPage(url, cachePath);
    const $ = cheerio.load(html);

    const title = $('div.product_main h1')
        .text()
        .trim();

    const price = $('div.product_main p.price_color')
        .text()
        .trim();

    const availability = $('div.product_main p.instock.availability')
        .text()
        .trim();

    const ratingClasses = $('p.star-rating').attr('class').split(' ');
    const rating = ratingClasses[1];

    const descriptionElement = $('#product_description').next('p');

    const description = descriptionElement.length
        ? descriptionElement.text().trim()
        : null;

    return {
        title,
        price,
        availability,
        description,
        rating,
        url
    };
}

(async () => {
    try {
        let pageUrl = START_URL;

        const uniqueUrls = new Map();
        const books = [];

        for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
            const cachePath = path.join(
                CACHE_PATH,
                `catalogue-page-${pageNumber}.html`
            );

            const html = await getPage(pageUrl, cachePath);
            const $ = cheerio.load(html);

            $('article.product_pod h3 a').each((index, element) => {
                const href = $(element).attr('href');

                if (href) {
                    const absoluteUrl = new URL(
                        href,
                        pageUrl
                    ).href;

                    if (!uniqueUrls.has(absoluteUrl)) {
                        uniqueUrls.set(absoluteUrl, {
                            url: absoluteUrl,
                            source_page: pageUrl
                        });
                    }
                }
            });

            const nextHref = $('li.next a').attr('href');

            if (nextHref) {
                pageUrl = new URL(
                    nextHref,
                    pageUrl
                ).href;
            }
        }

        console.log(`catalogue_pages=3`);
        console.log(`unique_urls=${uniqueUrls.size}`);

        let bookNumber = 1;

        for (const bookInfo of uniqueUrls.values()) {
            const book = await scrapeBook(
                bookInfo.url,
                bookNumber
            );

            const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

            books.push({
                ...book,
                source_page: bookInfo.source_page,
                fetched_at: fetchedAt
            });

            bookNumber++;
        }

        fs.mkdirSync(CACHE_PATH, { recursive: true });

        fs.writeFileSync(
            DATA_CACHE_PATH,
            JSON.stringify(books, null, 2),
            'utf-8'
        );

        console.log(`books_scraped=${books.length}`);
        console.log(`Data cached to: ${DATA_CACHE_PATH}`);

    } catch (err) {
        console.log(`Error: ${err.message}`);
        process.exit(1);
    }
})();