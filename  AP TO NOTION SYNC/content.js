// content.js

function normalizeYoutubeUrl(url) {
  if (!url) return "";

  // 1. Check for embed links: youtube.com/embed/VIDEO_ID or youtube-nocookie.com/embed/VIDEO_ID
  if (url.includes('/embed/')) {
    const match = url.match(/\/embed\/([a-zA-Z0-9_-]+)/i);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }

  // 2. Check for shortlink: youtu.be/VIDEO_ID
  if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }

  // 3. Check if it's already a watch link but has extra tracking/time params
  if (url.includes('watch?v=')) {
    const match = url.match(/(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+)/i);
    if (match) {
      return match[1];
    }
  }

  return url;
}

function detectPhysicsUnit(title, pageText) {
  const unitKeywords = [
    { name: "Mechanics", keywords: ["mechanics", "යාන්ත්‍ර", "යන්ත්‍ර විද්‍යාව", "යාන්ත්‍රික"] },
    { name: "Waves & Oscillations", keywords: ["wave", "oscillation", "තරංග", "දෝලන"] },
    { name: "Light", keywords: ["light", "optics", "ආලෝකය", "ප්‍රකාශ විද්‍යාව"] },
    { name: "Heat", keywords: ["heat", "thermal", "thermodynamics", "තාපය", "තාප"] },
    { name: "Gravitational Fields", keywords: ["gravitational", "gravity", "ගුරුත්වාකර්ෂණ", "ගුරුත්ව"] },
    { name: "Electrostatic Fields", keywords: ["electrostatic", "static electricity", "ස්ථිති විද්‍යුත්", "ස්ථිති"] },
    { name: "Magnetic Fields", keywords: ["magnetic", "magnetism", "චුම්බක"] },
    { name: "Current Electricity", keywords: ["current electricity", "current", "ධාරා විද්‍යුතය", "ධාරා"] },
    { name: "Electronics", keywords: ["electronics", "semiconductor", "ඉලෙක්ට්‍රොනික", "අර්ධ සන්නาයක"] },
    { name: "Properties of Matter", keywords: ["properties of matter", "matter", "ද්‍රව්‍යයේ යාන්ත්‍රික ගුණ", "යාන්ත්‍රික ගුණ", "මතුපිට ආතතිය", "surface tension", "viscosity", "දුස්ස්‍රාවිතාව", "ප්‍රත්‍යාස්ථතාව", "elasticity"] },
    { name: "Radiation", keywords: ["radiation", "atomic physics", "විකිරණය", "න්‍යෂ්ටික", "පරමාණුක", "nuclear"] }
  ];

  const searchText = (title + " " + pageText).toLowerCase();

  for (const unit of unitKeywords) {
    for (const keyword of unit.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return unit.name;
      }
    }
  }

  return "";
}

function scrapeClassDetails() {
  const details = {
    title: "",
    date: "",
    link: "",
    url: window.location.href,
    detectedUnit: ""
  };

  let targetLink = "";
  let extractedTitle = "";

  // 1. Scraping Zoom, Youtube or Google Meet links
  const links = Array.from(document.querySelectorAll('a'));
  
  // Find a link pointing to YouTube
  const ytLink = links.find(a => {
    const href = a.href || '';
    return /youtube\.com|youtu\.be/i.test(href);
  });

  if (ytLink) {
    targetLink = ytLink.href;
    const linkText = ytLink.textContent.trim().replace(/\s+/g, ' ');
    if (linkText && linkText.length > 3 && !/click|watch|link|video|play/i.test(linkText)) {
      extractedTitle = linkText;
    }
  }

  // Fallback to other video player/zoom links if no explicit YouTube link is found
  if (!targetLink) {
    const zoomLink = links.find(a => {
      const href = a.href || '';
      return /zoom\.us/i.test(href) || /meet\.google\.com/i.test(href);
    });
    if (zoomLink) {
      targetLink = zoomLink.href;
    } else {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      const videoIframe = iframes.find(iframe => {
        const src = iframe.src || '';
        return /youtube\.com|vimeo\.com|wistia\.net/i.test(src);
      });
      if (videoIframe) {
        targetLink = videoIframe.src;
      }
    }
  }

  // 2. Try to find the title in the bottom-left corner of the video player/area
  if (!extractedTitle) {
    const titleElements = Array.from(document.querySelectorAll(
      '.player-title, .video-title, .lesson-title, [class*="title" i], [class*="player__title" i]'
    ));
    
    const likelyTitleEl = titleElements.find(el => {
      const text = el.textContent.trim();
      return text && text.length > 2 && text.length < 100 && 
             !/physics|anuradha|menu|dashboard|login|home|navigation|footer/i.test(text);
    });
    
    if (likelyTitleEl) {
      extractedTitle = likelyTitleEl.textContent.trim().replace(/\s+/g, ' ');
    }
  }

  // Fallback to H1, H2, H3 if title is still empty
  if (!extractedTitle) {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
    const likelyTitles = headings.filter(h => {
      const text = h.textContent.trim();
      return text && !/physics|anuradha|menu|dashboard|login|home|navigation|footer/i.test(text);
    });
    
    if (likelyTitles.length > 0) {
      extractedTitle = likelyTitles[0].textContent.trim().replace(/\s+/g, ' ');
    } else {
      extractedTitle = document.title
        .replace(/(?:-\s*)?Physics\s*Anuradha\s*Sir.*/i, '')
        .replace(/(?:-\s*)?ap\.lk.*/i, '')
        .trim();
    }
  }

  details.title = extractedTitle;
  details.link = normalizeYoutubeUrl(targetLink);

  // 3. Scraping Date and Time
  const dateRegex = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/;
  const wordDateRegex = /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i;
  
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;
  let foundDate = false;

  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (!text || text.length > 100) continue;

    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      details.date = dateMatch[0];
      foundDate = true;
      break;
    }

    const wordDateMatch = text.match(wordDateRegex);
    if (wordDateMatch) {
      details.date = wordDateMatch[0];
      foundDate = true;
      break;
    }

    const lowerText = text.toLowerCase();
    if (daysOfWeek.some(day => lowerText.includes(day)) && 
        (lowerText.includes('am') || lowerText.includes('pm') || lowerText.includes(':') || lowerText.includes('at'))) {
      details.date = text;
      foundDate = true;
      break;
    }
  }

  if (!foundDate) {
    details.date = "";
  }

  // 4. Detect Physics Unit
  const bodyText = document.body.innerText || '';
  details.detectedUnit = detectPhysicsUnit(details.title, bodyText);

  return details;
}

// Listener for scrape requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scrapeClass") {
    try {
      const data = scrapeClassDetails();
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});
