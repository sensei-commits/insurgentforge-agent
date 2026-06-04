// SOURCE: Real job postings from Upwork/Freelancer
// Uses Playwright to bypass anti-bot and get actual customer jobs

const playwright = require("playwright");

async function scrapeUpworkJobs() {
  let browser;
  const jobs = [];

  try {
    console.log("[jobs] launching browser for Upwork...");

    browser = await playwright.chromium.launch({
      headless: true,
    });

    const page = await browser.newPage();

    // Search for Discord bot jobs
    const url = "https://www.upwork.com/ab/jobs/search/?q=discord+bot&sort=recency";

    console.log("[jobs] navigating to Upwork...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});

    // Extract visible job listings
    const jobData = await page.evaluate(() => {
      const jobs = [];
      try {
        // Try multiple selectors for job cards
        const selectors = [
          '[data-test="JobCard-item"]',
          'div[class*="JobCard"]',
          'section[class*="job"]',
          'article[class*="job"]',
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach((el) => {
              try {
                const text = el.innerText || el.textContent;
                const link = el.querySelector("a")?.href;

                if (text && text.length > 20) {
                  jobs.push({
                    text,
                    link: link || "",
                    source: "upwork",
                  });
                }
              } catch (e) {}
            });
            break;
          }
        }
      } catch (e) {}
      return jobs;
    });

    for (const job of jobData) {
      if (job.text && job.text.toLowerCase().includes("discord")) {
        jobs.push({
          text: job.text,
          url: job.link,
          author: "upwork_client",
          score: 500,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }
    }

    console.log(`[jobs] found ${jobs.length} Upwork listings`);
  } catch (err) {
    console.log(`[jobs] Upwork error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  return jobs;
}

async function scrapeFreelancerJobs() {
  let browser;
  const jobs = [];

  try {
    browser = await playwright.chromium.launch({
      headless: true,
    });

    const page = await browser.newPage();

    const url = "https://www.freelancer.com/jobs/search/?q=discord+bot&sort=recency";

    console.log("[jobs] navigating to Freelancer...");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});

    // Extract job listings
    const jobData = await page.evaluate(() => {
      const jobs = [];
      try {
        const selectors = [
          '[data-test-id="job-card"]',
          'div[class*="JobCard"]',
          'article[class*="job"]',
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach((el) => {
              try {
                const text = el.innerText || el.textContent;
                const link = el.querySelector("a")?.href;

                if (text && text.length > 20) {
                  jobs.push({
                    text,
                    link: link || "",
                    source: "freelancer",
                  });
                }
              } catch (e) {}
            });
            break;
          }
        }
      } catch (e) {}
      return jobs;
    });

    for (const job of jobData) {
      if (job.text && job.text.toLowerCase().includes("discord")) {
        jobs.push({
          text: job.text,
          url: job.link,
          author: "freelancer_client",
          score: 400,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }
    }

    console.log(`[jobs] found ${jobs.length} Freelancer listings`);
  } catch (err) {
    console.log(`[jobs] Freelancer error: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }

  return jobs;
}

async function scrapeJobBoards() {
  console.log("[jobs] scraping real job boards with browser automation...");

  const upworkJobs = await scrapeUpworkJobs();
  const freelancerJobs = await scrapeFreelancerJobs();

  const allJobs = [...upworkJobs, ...freelancerJobs];
  console.log(`[jobs] total real jobs found: ${allJobs.length}`);

  return allJobs;
}

module.exports = { scrapeJobBoards };
