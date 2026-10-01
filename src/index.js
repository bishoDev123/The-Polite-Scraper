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
const RUN_REPORT_PATH = path.join(OUTPUT_PATH, 'run-report.json');

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

function isRetryableError(err) {
    return (
        err.code === 'ETIMEDOUT' ||
        err.code === 'ESOCKETTIMEDOUT' ||
        (err.statusCode >= 500 && err.statusCode <= 599)
    );
}

async function requestPage(url) {
    let response;

    try {
        response = await request({
            ...options,
            uri: url
        });
    } catch (err) {
        if (!isRetryableError(err)) {
            throw err;
        }

        await sleep(1000);

        response = await request({
            ...options,
            uri: url
        });
    }

    if (response.statusCode >= 500 && response.statusCode <= 599) {
        await sleep(1000);

        response = await request({
            ...options,
            uri: url
        });
    }

    return response;
}

async function getPage(url, cachePath, stats) {
    if (fs.existsSync(cachePath)) {
        const html = fs.readFileSync(cachePath, 'utf-8');

        stats.cache_hits++;

        console.log(`Cache hit: ${cachePath}`);
        console.log(
            `Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`
        );

        return html;
    }

    await sleep(500);

    const response = await requestPage(url);

    if (response.statusCode !== 200) {
        throw new Error(
            `fetch failed with status code ${response.statusCode}`
        );
    }

    const html = response.body;

    fs.mkdirSync(CACHE_PATH, { recursive: true });
    fs.writeFileSync(cachePath, html, 'utf-8');

    stats.pages_fetched++;

    console.log(`FETCH: ${url}`);
    console.log(
        `Response size: ${Buffer.byteLength(html, 'utf-8')} bytes`
    );

    return html;
}

async function scrapeBook(productUrl, bookNumber, stats) {
    const cachePath = path.join(
        CACHE_PATH,
        `book-${bookNumber}.html`
    );

    const html = await getPage(
        productUrl,
        cachePath,
        stats
    );

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
    const startTime = new Date();

    const stats = {
        pages_fetched: 0,
        cache_hits: 0,
        valid_records: 0,
        invalid_records: 0,
        failed_pages: []
    };

    const uniqueUrls = new Map();
    const books = new Map();
    const errors = [];

    try {
        let pageUrl = START_URL;

        for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
            const currentPageUrl = pageUrl;

            const cachePath = path.join(
                CACHE_PATH,
                `catalogue-page-${pageNumber}.html`
            );

            try {
                const html = await getPage(
                    currentPageUrl,
                    cachePath,
                    stats
                );

                const $ = cheerio.load(html);

                $('article.product_pod h3 a').each((index, element) => {
                    const href = $(element).attr('href');

                    if (href) {
                        const absoluteUrl = new URL(
                            href,
                            currentPageUrl
                        ).href;

                        if (!uniqueUrls.has(absoluteUrl)) {
                            uniqueUrls.set(absoluteUrl, {
                                product_url: absoluteUrl,
                                source_page: currentPageUrl
                            });
                        }
                    }
                });

                const nextHref = $('li.next a').attr('href');

                if (nextHref) {
                    pageUrl = new URL(
                        nextHref,
                        currentPageUrl
                    ).href;
                }
            } catch (err) {
                stats.failed_pages.push({
                    page: pageNumber,
                    url: currentPageUrl,
                    reason: err.message
                });

                console.log(
                    `Page ${pageNumber} failed: ${err.message}`
                );

                if (pageNumber < 3) {
                    pageUrl = new URL(
                        `catalogue/page-${pageNumber + 1}.html`,
                        START_URL + '/'
                    ).href;
                }
            }
        }

        uniqueUrls.set(
            'https://books.toscrape.com/catalogue/this-book-does-not-exist/index.html',
            {
                product_url:
                    'https://books.toscrape.com/catalogue/this-book-does-not-exist/index.html',
                source_page: START_URL
            }
        );

        console.log(`catalogue_pages=3`);
        console.log(`unique_urls=${uniqueUrls.size}`);

        let bookNumber = 1;

        for (const bookInfo of uniqueUrls.values()) {
            try {
                const book = await scrapeBook(
                    bookInfo.product_url,
                    bookNumber,
                    stats
                );

                const record = {
                    ...book,
                    source_page: bookInfo.source_page,
                    fetched_at: new Date().toISOString()
                };

                const result = BookSchema.safeParse(record);

                if (result.success) {
                    books.set(
                        result.data.product_url,
                        result.data
                    );

                    stats.valid_records++;
                } else {
                    errors.push({
                        product_url: bookInfo.product_url,
                        reason: result.error.issues
                    });

                    stats.invalid_records++;
                }
            } catch (err) {
                errors.push({
                    product_url: bookInfo.product_url,
                    reason: err.message
                });

                stats.invalid_records++;
            }

            bookNumber++;
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
        process.exitCode = 1;
    } finally {
        const endTime = new Date();

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

        const runReport = {
            start_time: startTime.toISOString(),
            duration_ms: endTime.getTime() - startTime.getTime(),
            pages_fetched: stats.pages_fetched,
            cache_hits: stats.cache_hits,
            valid_records: stats.valid_records,
            invalid_records: stats.invalid_records,
            failed_pages: stats.failed_pages
        };

        fs.writeFileSync(
            RUN_REPORT_PATH,
            JSON.stringify(runReport, null, 2),
            'utf-8'
        );

        console.log(`books_scraped=${books.size}`);
        console.log(`errors=${errors.length}`);
        console.log(`Books written to: ${BOOKS_OUTPUT_PATH}`);
        console.log(`Errors written to: ${ERRORS_OUTPUT_PATH}`);
        console.log(`Run report written to: ${RUN_REPORT_PATH}`);
    }
})();