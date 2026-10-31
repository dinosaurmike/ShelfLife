exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { review } = JSON.parse(event.body);
    
    if (!review) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Review text is required' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Server configuration error: Missing GEMINI_API_KEY in Netlify environment variables.' }) 
      };
    }

    // Call Google Gemini 1.5 Flash API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert book reviewer and editor. Refine the following book review text. Make it more elegant, concise, and articulate, but maintain the original tone and sentiment. Return ONLY the refined text, without any conversational padding.\n\nOriginal review:\n${review}`
          }]
        }]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Gemini API Error:', data);
      return { statusCode: 502, body: JSON.stringify({ error: 'Failed to refine review via AI.' }) };
    }

    const refinedText = data.candidates[0].content.parts[0].text.trim();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refined: refinedText })
    };

  } catch (error) {
    console.error('Function error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
