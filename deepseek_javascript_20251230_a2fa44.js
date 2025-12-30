// Instagram Downloader API - Single File Solution
// Deploy on Cloudflare Workers

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    
    // API Endpoint: /Igdown
    if (path === '/Igdown' || path === '/Igdown/') {
      return await handleInstagramDownload(request, url);
    }
    
    // Root endpoint - Show usage
    return new Response(
      `📥 Instagram Reel Downloader API\n\n` +
      `Usage: GET /Igdown?url=INSTAGRAM_URL\n\n` +
      `Example:\n` +
      `  /Igdown?url=https://www.instagram.com/reel/CzR4YJNIr1G/\n\n` +
      `Response:\n` +
      `  {\n` +
      `    "status": "success",\n` +
      `    "source": "https://video.cdn.instagram.com/video.mp4"\n` +
      `  }`,
      {
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

// Main handler for Instagram download
async function handleInstagramDownload(request, url) {
  const igUrl = url.searchParams.get('url');
  
  // Validate input
  if (!igUrl) {
    return jsonResponse({
      status: 'error',
      message: 'Missing URL parameter. Use: /Igdown?url=INSTAGRAM_URL'
    }, 400);
  }
  
  // Validate Instagram URL
  if (!isValidInstagramUrl(igUrl)) {
    return jsonResponse({
      status: 'error',
      message: 'Invalid Instagram URL. Must be a reel or post URL.'
    }, 400);
  }
  
  try {
    console.log(`Processing: ${igUrl}`);
    
    // Extract video using multiple methods
    const videoData = await extractInstagramVideo(igUrl);
    
    if (!videoData.url) {
      return jsonResponse({
        status: 'error',
        message: 'Video URL not found. The content might be private or unavailable.'
      }, 404);
    }
    
    // Success response
    return jsonResponse({
      status: 'success',
      source: videoData.url,
      details: {
        type: videoData.type || 'video/mp4',
        method: videoData.method || 'direct',
        quality: videoData.quality || 'hd',
        thumbnail: videoData.thumbnail || null,
        duration: videoData.duration || null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Extraction error:', error);
    
    return jsonResponse({
      status: 'error',
      message: error.message || 'Failed to extract video',
      error: error.toString()
    }, 500);
  }
}

// Helper: JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

// ==================== CORE EXTRACTION LOGIC ====================

// Browser User-Agents for rotation (same as your original)
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1"
];

// Proxy servers list (same as your original)
const PROXY_SERVERS = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://thingproxy.freeboard.io/fetch/",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://proxy.cors.sh/",
  ""
];

// Main extraction function
async function extractInstagramVideo(originalUrl) {
  console.log('Starting extraction for:', originalUrl);
  
  // Clean the URL
  const cleanUrl = cleanInstagramUrl(originalUrl);
  
  // Try multiple methods in sequence
  const methods = [
    () => tryEmbedMethod(cleanUrl),
    () => tryDdInstagramMethod(cleanUrl),
    () => tryApiMethod(cleanUrl),
    () => tryDirectMethod(cleanUrl),
    () => tryAlternativeProxies(cleanUrl)
  ];
  
  for (let i = 0; i < methods.length; i++) {
    try {
      console.log(`Trying method ${i + 1}...`);
      const result = await methods[i]();
      if (result && result.url) {
        console.log(`Success with method ${i + 1}`);
        return result;
      }
    } catch (error) {
      console.log(`Method ${i + 1} failed:`, error.message);
      continue;
    }
  }
  
  throw new Error('All extraction methods failed');
}

// ==================== EXTRACTION METHODS ====================

// Method 1: Embed page method (most reliable)
async function tryEmbedMethod(igUrl) {
  const embedUrl = getEmbedUrl(igUrl);
  console.log('Trying embed URL:', embedUrl);
  
  const response = await fetchWithRetry(embedUrl, {
    headers: getInstagramHeaders()
  });
  
  const html = await response.text();
  
  // Parse video from HTML
  const videoData = extractVideoFromHTML(html);
  
  if (videoData.url) {
    return {
      ...videoData,
      method: 'embed_parsing'
    };
  }
  
  throw new Error('No video found in embed page');
}

// Method 2: ddinstagram.com method
async function tryDdInstagramMethod(igUrl) {
  const ddUrl = igUrl.replace('instagram.com', 'ddinstagram.com');
  console.log('Trying DDInstagram:', ddUrl);
  
  const response = await fetchWithRetry(ddUrl, {
    headers: getInstagramHeaders()
  });
  
  const html = await response.text();
  
  // Look for video in ddinstagram
  const videoMatch = html.match(/<source[^>]*src="([^"]+\.mp4[^"]*)"/i) ||
                    html.match(/video src="([^"]+\.mp4[^"]*)"/i);
  
  if (videoMatch && videoMatch[1]) {
    return {
      url: videoMatch[1],
      method: 'ddinstagram'
    };
  }
  
  throw new Error('No video found on ddinstagram');
}

// Method 3: API method with __a=1 parameter
async function tryApiMethod(igUrl) {
  const apiUrl = cleanUrl(igUrl) + '?__a=1&__d=dis';
  console.log('Trying API URL:', apiUrl);
  
  const response = await fetchWithRetry(apiUrl, {
    headers: {
      ...getInstagramHeaders(),
      'Accept': 'application/json',
      'X-IG-App-ID': '936619743392459',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  
  const data = await response.json();
  
  // Extract from JSON
  const videoUrl = extractVideoFromJson(data);
  if (videoUrl) {
    return {
      url: videoUrl,
      method: 'internal_api'
    };
  }
  
  throw new Error('No video in API response');
}

// Method 4: Direct fetch
async function tryDirectMethod(igUrl) {
  console.log('Trying direct fetch:', igUrl);
  
  const response = await fetchWithRetry(igUrl, {
    headers: getInstagramHeaders()
  });
  
  const html = await response.text();
  const videoData = extractVideoFromHTML(html);
  
  if (videoData.url) {
    return {
      ...videoData,
      method: 'direct_fetch'
    };
  }
  
  throw new Error('No video found in direct fetch');
}

// Method 5: Try with different proxies
async function tryAlternativeProxies(igUrl) {
  console.log('Trying alternative proxies...');
  
  for (const proxy of PROXY_SERVERS) {
    try {
      const proxyUrl = proxy + encodeURIComponent(igUrl);
      const response = await fetch(proxyUrl, {
        headers: getInstagramHeaders()
      });
      
      if (response.ok) {
        const html = await response.text();
        const videoData = extractVideoFromHTML(html);
        
        if (videoData.url) {
          return {
            ...videoData,
            method: 'proxy_fetch'
          };
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('All proxies failed');
}

// ==================== HELPER FUNCTIONS ====================

// Fetch with retry logic
async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (i === maxRetries) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    } catch (error) {
      if (i === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Fetch failed after retries');
}

// Get Instagram headers with random User-Agent
function getInstagramHeaders() {
  const randomAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  
  return {
    'User-Agent': randomAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.instagram.com/',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };
}

// Clean Instagram URL
function cleanInstagramUrl(url) {
  let clean = url.trim();
  clean = clean.split('?')[0];
  if (!clean.endsWith('/')) clean += '/';
  return clean;
}

function cleanUrl(url) {
  return url.split('?')[0].replace(/\/$/, '') + '/';
}

// Validate Instagram URL
function isValidInstagramUrl(url) {
  return url.includes('instagram.com/reel/') || 
         url.includes('instagram.com/p/') || 
         url.includes('instagram.com/tv/');
}

// Get embed URL
function getEmbedUrl(url) {
  let clean = cleanUrl(url);
  if (clean.includes('/p/') || clean.includes('/reel/') || clean.includes('/tv/')) {
    return clean + 'embed/';
  }
  return clean;
}

// Extract video from HTML (same as your original logic)
function extractVideoFromHTML(html) {
  // Method A: Meta tags
  const ogVideoMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i);
  if (ogVideoMatch && ogVideoMatch[1]) {
    return {
      url: ogVideoMatch[1],
      type: 'video'
    };
  }
  
  // Method B: Video tags
  const videoMatch = html.match(/<video[^>]*src="([^"]+)"/i);
  if (videoMatch && videoMatch[1]) {
    return {
      url: videoMatch[1],
      type: 'video'
    };
  }
  
  // Method C: Script data - video_url
  const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
  if (videoUrlMatch && videoUrlMatch[1]) {
    return {
      url: videoUrlMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&'),
      type: 'video'
    };
  }
  
  // Method D: Script data - video_versions
  const versionsMatch = html.match(/"video_versions"\s*:\s*\[\s*{\s*[^}]*"url"\s*:\s*"([^"]+)"/);
  if (versionsMatch && versionsMatch[1]) {
    return {
      url: versionsMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&'),
      type: 'video'
    };
  }
  
  // Method E: CDN URLs
  const cdnRegex = /(https:\/\/[^"\s]+\.(fbcdn|instagram)\.(net|com)[^"\s]*\.mp4[^"\s]*)/g;
  const cdnMatches = html.match(cdnRegex);
  if (cdnMatches && cdnMatches.length > 0) {
    return {
      url: cdnMatches[0],
      type: 'video'
    };
  }
  
  // Method F: ContentUrl in JSON-LD
  const contentUrlMatch = html.match(/"contentUrl"\s*:\s*"([^"]+)"/);
  if (contentUrlMatch && contentUrlMatch[1]) {
    return {
      url: contentUrlMatch[1],
      type: 'video'
    };
  }
  
  return { url: '', type: '' };
}

// Extract video from JSON (same as your original logic)
function extractVideoFromJson(data) {
  try {
    // Multiple possible JSON structures
    const paths = [
      'graphql.shortcode_media.video_url',
      'items[0].video_versions[0].url',
      'graphql.shortcode_media.display_url',
      'edge_sidecar_to_children.edges[0].node.video_url',
      'video_url',
      'contentUrl'
    ];
    
    for (const path of paths) {
      const value = getNestedValue(data, path);
      if (value && (value.includes('.mp4') || value.includes('video'))) {
        return value;
      }
    }
  } catch (error) {
    console.error('JSON extraction error:', error);
  }
  return null;
}

// Get nested value from object
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      const arrayMatch = key.match(/\[(\d+)\]/);
      if (arrayMatch) {
        const arrayKey = key.replace(/\[\d+\]/, '');
        const index = arrayMatch[1];
        if (current[arrayKey] && Array.isArray(current[arrayKey])) {
          return current[arrayKey][index];
        }
      }
      return current[key];
    }
    return undefined;
  }, obj);
}