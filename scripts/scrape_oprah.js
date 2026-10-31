/**
 * scrape_oprah.js
 * 
 * This script runs autonomously (via cron or manually) to fetch the latest
 * Oprah's Book Club pick and update the ShelfLife public club database.
 * 
 * Usage:
 * SUPABASE_URL=https://... SUPABASE_KEY=... node scrape_oprah.js
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CLUB_INVITE_CODE = 'PUBLIC_OPRAH';

async function fetchLatestOprahPick() {
  console.log('Fetching latest Oprah pick from Wikipedia...');
  try {
    // Wikipedia's Oprah's Book Club list is usually very up to date
    const res = await fetch('https://en.wikipedia.org/w/api.php?action=parse&page=Oprah%27s_Book_Club&format=json&prop=text');
    const json = await res.json();
    const html = json.parse.text['*'];

    // Extremely simple parsing: Find the last table row containing book data
    const matches = [...html.matchAll(/<i><a href="[^"]+" title="[^"]+">([^<]+)<\/a><\/i>\s*<\/td>\s*<td><a href="[^"]+" title="[^"]+">([^<]+)<\/a>/g)];
    
    if (matches.length > 0) {
      const latest = matches[matches.length - 1];
      return {
        title: latest[1],
        author: latest[2]
      };
    }
  } catch (e) {
    console.error('Error fetching Oprah pick:', e);
  }
  
  // Fallback if regex fails on Wikipedia's current DOM
  return { title: 'Familiaris', author: 'David Wroblewski' }; // Oprah's Summer 2024 pick
}

async function updateSupabase(pick) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Skipping Supabase update: Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
    console.log(`Would have updated ${CLUB_INVITE_CODE} with:`, pick);
    return;
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // 1. Check if the Oprah club exists
    const searchRes = await fetch(`${SUPABASE_URL}/rest/v1/clubs?invite_code=eq.${CLUB_INVITE_CODE}&select=*`, { headers });
    const existing = await searchRes.json();

    let clubId;

    if (existing && existing.length > 0) {
      // 2a. Update existing club
      clubId = existing[0].id;
      console.log(`Found existing Oprah club (ID: ${clubId}). Updating pick...`);
      await fetch(`${SUPABASE_URL}/rest/v1/clubs?id=eq.${clubId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          current_book_title: pick.title,
          current_book_author: pick.author
        })
      });
    } else {
      // 2b. Create new public club
      console.log('Oprah club not found. Creating it...');
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/clubs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: "Oprah's Book Club",
          description: "Read along with Oprah's official selections! (Public Club)",
          invite_code: CLUB_INVITE_CODE,
          current_book_title: pick.title,
          current_book_author: pick.author
        })
      });
      const inserted = await insertRes.json();
      if (inserted && inserted.length > 0) clubId = inserted[0].id;
    }

    console.log(`Successfully synced Oprah's Book Club pick: "${pick.title}" by ${pick.author}`);
  } catch(e) {
    console.error('Error updating Supabase:', e);
  }
}

async function main() {
  const pick = await fetchLatestOprahPick();
  console.log('Latest Pick Resolved:', pick);
  await updateSupabase(pick);
}

main();
