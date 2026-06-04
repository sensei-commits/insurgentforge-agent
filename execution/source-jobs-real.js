// SOURCE: Real job postings from Upwork/Freelancer
// Uses Playwright to bypass anti-bot and get actual customer jobs

const playwright = require("playwright");

async function scrapeUpworkJobs() {
  let browser;
  const jobs = [];

  try {
    console.log("[jobs] starting browser for Upwork scraping...");

    browser = await playwright.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // Set realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    // Search for Discord bot jobs on Upwork
    const searchTerms = [
      "discord bot",
      "discord automation",
      "custom bot development",
    ];

    for (const term of searchTerms) {
      try {
        console.log(`[jobs] searching Upwork: "${term}"...`);

        const url = `https://www.upwork.com/ab/jobs/search/?q=${encodeURIComponent(
          term
        )}&sort=recency&job_status=active`;

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

        // Wait for job listings to load
        await page.waitForSelector(
          '[data-test="JobCard-item"]',
          { timeout: 5000 }
        ).catch(() => {});

        // Extract job data
        const jobData = await page.evaluate(() => {
          const jobs = [];
          const jobElements = document.querySelectorAll('[data-test="JobCard-item"]');

          jobElements.forEach((el) => {
            try {
              const titleEl = el.querySelector("h2, [data-test*='title']");
              const descEl = el.querySelector("p, [data-test*='description']");
              const budgetEl = el.querySelector(
                "[data-test*='budget'], span:contains('$')"
              );
              const linkEl = el.querySelector("a[href*='/jobs/']");

              const title = titleEl ? titleEl.innerText.trim() : "";
              const description = descEl ? descEl.innerText.trim() : "";
              const budget = budgetEl ? budgetEl.innerText.trim() : "";
              const link = linkEl ? linkEl.href : "";

              if (title && link) {
                jobs.push({
                  title,
                  description,
                  budget,
                  link,
                  timestamp: new Date().getTime() / 1000,
                });
              }
            } catch (e) {
              // Skip on parse error
            }
          });

          return jobs;
        });

        // Add to results
        for (const job of jobData) {
          if (
            job.title &&
            (job.title.toLowerCase().includes("discord") ||
              job.title.toLowerCase().includes("bot") ||
              job.description.toLowerCase().includes("discord"))
          ) {
            jobs.push({
              text: `${job.title}\n${job.description}`,
              url: job.link,
              author: "upwork_client",
              score: job.budget ? parseInt(job.budget.replace(/[^0-9]/g, "")) : 500,
              timestamp: job.timestamp,
            });
          }
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.log(`[jobs] Upwork search error: ${err.message}`);
        continue;
      }
    }

    console.log(`[jobs] found ${jobs.length} Upwork jobs`);
  } catch (err) {
    console.error("[jobs] browser error:", err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return jobs;
}

async function scrapeFreelancerJobs() {
  let browser;
  const jobs = [];

  try {
    console.log("[jobs] starting browser for Freelancer scraping...");

    browser = await playwright.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Search for Discord bot jobs on Freelancer
    const searchTerms = ["discord bot", "discord automation"];

    for (const term of searchTerms) {
      try {
        console.log(`[jobs] searching Freelancer: "${term}"...`);

        const url = `https://www.freelancer.com/jobs/search/?q=${encodeURIComponent(
          term
        )}&sort=recency`;

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

        // Extract job listings
        const jobData = await page.evaluate(() => {
          const jobs = [];
          const jobElements = document.querySelectorAll(
            "[data-test-id='job-card'], .JobCard"
          );

          jobElements.forEach((el) => {
            try {
              const titleEl = el.querySelector("a[data-link-to='job-detail']");
              const descEl = el.querySelector(".JobCard-description");
              const budgetEl = el.querySelector("[data-test-id='budget']");

              const title = titleEl ? titleEl.innerText.trim() : "";
              const description = descEl ? descEl.innerText.trim() : "";
              const budget = budgetEl ? budgetEl.innerText.trim() : "";
              const link = titleEl ? titleEl.href : "";

              if (title && link) {
                jobs.push({
                  title,
                  description,
                  budget,
                  link,
                  timestamp: new Date().getTime() / 1000,
                });
              }
            } catch (e) {
              // Skip on error
            }
          });

          return jobs;
        });

        for (const job of jobData) {
          jobs.push({
            text: `${job.title}\n${job.description}`,
            url: job.link,
            author: "freelancer_client",
            score: job.budget ? parseInt(job.budget.replace(/[^0-9]/g, "")) : 300,
            timestamp: job.timestamp,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.log(`[jobs] Freelancer search error: ${err.message}`);
        continue;
      }
    }

    console.log(`[jobs] found ${jobs.length} Freelancer jobs`);
  } catch (err) {
    console.error("[jobs] browser error:", err.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return jobs;
}

async function scrapeJobBoards() {
  console.log("[jobs] scraping real job boards...");

  const upworkJobs = await scrapeUpworkJobs();
  const freelancerJobs = await scrapeFreelancerJobs();

  const allJobs = [...upworkJobs, ...freelancerJobs];
  console.log(`[jobs] total jobs found: ${allJobs.length}`);

  return allJobs;
}

module.exports = { scrapeJobBoards };
