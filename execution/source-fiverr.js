// SOURCE: Fiverr scraper — find people offering Discord bot building services and requests
// Targets: gigs, projects, and service listings related to Discord bots

async function scrapeFiverr() {
  try {
    const gigs = [];

    // Fiverr search queries
    const searchTerms = [
      "discord bot",
      "discord automation",
      "bot development",
      "custom bot",
    ];

    for (const term of searchTerms) {
      try {
        console.log(`[fiverr] searching: "${term}"...`);

        // Fiverr uses GraphQL API for search
        const response = await fetch("https://www.fiverr.com/graphql", {
          method: "POST",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operationName: "SearchGigs",
            query: `
              query SearchGigs($query: String!, $limit: Int) {
                searchGigs(query: $query, limit: $limit) {
                  gigs {
                    id
                    title
                    description
                    url
                    seller {
                      username
                    }
                    pricing
                    rating
                    reviews
                  }
                }
              }
            `,
            variables: {
              query: term,
              limit: 50,
            },
          }),
        });

        if (!response.ok) {
          console.log(`[fiverr] search returned ${response.status}`);
          // Try HTML scraping fallback
          const htmlResponse = await fetch(
            `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(
              term
            )}`,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
            }
          );

          if (!htmlResponse.ok) continue;

          const html = await htmlResponse.text();

          // Parse HTML for gig listings
          const gigRegex =
            /<a[^>]*href="\/gigs\/([^"]*)"[^>]*class="[^"]*gig[^"]*"[^>]*>([^<]+)<\/a>/gi;
          let match;

          while ((match = gigRegex.exec(html)) !== null) {
            const gigId = match[1];
            const title = match[2];

            gigs.push({
              text: `Fiverr Gig: ${title}`,
              url: `https://www.fiverr.com/gigs/${gigId}`,
              author: "fiverr_seller",
              score: 1,
              timestamp: Math.floor(Date.now() / 1000),
            });
          }
          continue;
        }

        const data = await response.json();

        if (data.data?.searchGigs?.gigs) {
          for (const gig of data.data.searchGigs.gigs) {
            gigs.push({
              text: `${gig.title}\n${gig.description || ""}`,
              url: gig.url,
              author: gig.seller?.username || "fiverr_seller",
              score: (gig.rating || 0) * 10 + (gig.reviews || 0),
              timestamp: Math.floor(Date.now() / 1000),
            });
          }
        }

        // Rate limit
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(`[fiverr] search "${term}" error:`, err.message);
        continue;
      }
    }

    console.log(`[fiverr] found ${gigs.length} relevant gigs`);
    return gigs;
  } catch (err) {
    console.error("[fiverr] scrape error:", err.message);
    return [];
  }
}

module.exports = { scrapeFiverr };
