const fs = require('fs');
const path = require('path');
const request = require('request-promise');
const cheerio = require('cheerio');
const { z } = require('zod');

const START_URL = 'https://books.toscrape.com';

const CACHE_PATH = path.join(__dirname, '.', 'cache');
const OUTPUT_PATH = path.join(__dirname, '.', 'output');

const BOOKS_OUTPUT_PATH = path.join(OUTPUT_PATH, 'books.json');
const ERRORS_OUTPUT_PATH = path.join(OUTPUT_PATH, 'errors.json');

const BookSchema = z.object({
    title: z.string(),
    price: z.string(),
    parsedPrice: z.number(),
    availability: z.string(),
    description: z.string().nullable(),
    rating: z.string(),
    product_url: z.string().url(),
    source_page: z.string().url(),
    fetched_at: z.string().datetime({ offset: true })
});

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
    if (fs.existsSync(cachePath)) {
        const html = fs.readFileSync(cachePath, 'utf-8');

        console.log(`Cache hit: ${cachePath}`);
        console.log(
            `Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`
        );

        return html;
    }

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

async function scrapeBook(productUrl, bookNumber) {
    const cachePath = path.join(
        CACHE_PATH,
        `book-${bookNumber}.html`
    );

    const html = await getPage(productUrl, cachePath);
    const $ = cheerio.load(html);

    const title = $('div.product_main h1')
        .text()
        .trim();

    const price = $('div.product_main p.price_color')
        .text()
        .trim();

    const cleanedPrice = price.replace(/[^0-9.-]+/g, '');
    const parsedPrice = Number.parseFloat(cleanedPrice);

    const availability = $('div.product_main p.instock.availability')
        .text()
        .trim();

    const ratingClasses = $('p.star-rating')
        .attr('class')
        .split(' ');

    const rating = ratingClasses[1];

    const descriptionElement = $('#product_description').next('p');

    const description = descriptionElement.length
        ? descriptionElement.text().trim()
        : null;

    return {
        title,
        price,
        parsedPrice,
        availability,
        description,
        rating,
        product_url: productUrl
    };
}

(async () => {
    try {
        let pageUrl = START_URL;

        const uniqueUrls = new Map();

        const books = new Map();

        const errors = [];

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
                            product_url: absoluteUrl,
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
            try {
                const book = await scrapeBook(
                    bookInfo.product_url,
                    bookNumber
                );

                const fetchedAt = new Date().toISOString();

                const record = {
                    ...book,
                    source_page: bookInfo.source_page,
                    fetched_at: fetchedAt
                };

                const result = BookSchema.safeParse(record);

                if (result.success) {
                    books.set(
                        result.data.product_url,
                        result.data
                    );
                } else {
                    errors.push({
                        product_url: bookInfo.product_url,
                        reason: result.error.issues
                    });
                }
            } catch (err) {
                errors.push({
                    product_url: bookInfo.product_url,
                    reason: err.message
                });
            }

            bookNumber++;
        }

        fs.mkdirSync(OUTPUT_PATH, { recursive: true });

        fs.writeFileSync(
            BOOKS_OUTPUT_PATH,
            JSON.stringify([...books.values()], null, 2),
            'utf-8'
        );

        fs.writeFileSync(
            ERRORS_OUTPUT_PATH,
            JSON.stringify(errors, null, 2),
            'utf-8'
        );

        console.log(`books_scraped=${books.size}`);
        console.log(`errors=${errors.length}`);
        console.log(`Books written to: ${BOOKS_OUTPUT_PATH}`);
        console.log(`Errors written to: ${ERRORS_OUTPUT_PATH}`);
    } catch (err) {
        console.log(`Error: ${err.message}`);
        process.exit(1);
    }
})();