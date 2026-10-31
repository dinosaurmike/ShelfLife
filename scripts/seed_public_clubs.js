/**
 * seed_public_clubs.js
 * 
 * This script seeds the Supabase database with 5 popular public book clubs
 * and their latest picks.
 * 
 * Usage:
 * SUPABASE_URL=https://... SUPABASE_KEY=... node scripts/seed_public_clubs.js
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const PUBLIC_CLUBS = [
  {
    name: "Oprah's Book Club",
    description: "Read along with Oprah's official selections! (Public Club)",
    invite_code: "PUBLIC_OPRAH",
    current_book_title: "A Tale of Two Cities",
    current_book_author: "Charles Dickens",
    current_book_cover: "https://covers.openlibrary.org/b/id/14358641-L.jpg"
  },
  {
    name: "Reese's Book Club",
    description: "Reese Witherspoon's monthly pick celebrating women's stories. (Public Club)",
    invite_code: "PUBLIC_REESE",
    current_book_title: "The Unwedding",
    current_book_author: "May Cobb",
    current_book_cover: "https://covers.openlibrary.org/b/id/14588960-L.jpg"
  },
  {
    name: "Read with Jenna",
    description: "Jenna Bush Hager's Today Show book club picks. (Public Club)",
    invite_code: "PUBLIC_JENNA",
    current_book_title: "Margo's Got Money Troubles",
    current_book_author: "Rufi Thorpe",
    current_book_cover: "https://covers.openlibrary.org/b/id/14713426-L.jpg"
  },
  {
    name: "GMA Book Club",
    description: "Good Morning America's official book club. (Public Club)",
    invite_code: "PUBLIC_GMA",
    current_book_title: "Shelterwood",
    current_book_author: "Lisa Wingate",
    current_book_cover: "https://covers.openlibrary.org/b/id/14605927-L.jpg"
  },
  {
    name: "Belletrist",
    description: "Emma Roberts and Karah Preiss's book club for curious readers. (Public Club)",
    invite_code: "PUBLIC_BELLETRIST",
    current_book_title: "The Rom-Commers",
    current_book_author: "Katherine Center",
    current_book_cover: "https://covers.openlibrary.org/b/id/14714151-L.jpg"
  }
];

async function updateSupabase(clubData) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY');
    return;
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    // 1. Check if the club exists
    const searchRes = await fetch(`${SUPABASE_URL}/rest/v1/clubs?invite_code=eq.${clubData.invite_code}&select=*`, { headers });
    const existing = await searchRes.json();

    if (existing && existing.length > 0) {
      // 2a. Update existing club
      const clubId = existing[0].id;
      console.log(`Found existing club ${clubData.name} (ID: ${clubId}). Updating...`);
      await fetch(`${SUPABASE_URL}/rest/v1/clubs?id=eq.${clubId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(clubData)
      });
    } else {
      // 2b. Create new public club
      console.log(`Club ${clubData.name} not found. Creating it...`);
      await fetch(`${SUPABASE_URL}/rest/v1/clubs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(clubData)
      });
    }

    console.log(`Successfully synced ${clubData.name}: "${clubData.current_book_title}"`);
  } catch(e) {
    console.error(`Error syncing ${clubData.name}:`, e);
  }
}

async function main() {
  console.log('Seeding popular public book clubs...');
  for (const club of PUBLIC_CLUBS) {
    await updateSupabase(club);
  }
  console.log('Done!');
}

main();
