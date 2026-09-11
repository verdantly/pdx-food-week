/* ── Shareable Graphic Card Canvas Exporter ── */
import { State } from './state.js';
import { getSaved } from './data.js';
import { showToast } from './utils.js';

export async function exportTopPicksCard() {
  const savedItems = getSaved();
  if (!savedItems || savedItems.length === 0) {
    showToast('Save some dishes first to share your top picks!');
    return;
  }

  const week = (window.FOOD_WEEKS || []).find(w => w.id === State.currentWeekId);
  const weekName = week ? week.name : 'Food Week';

  const canvas = document.createElement('canvas');
  const width = 1080;
  const height = 1920;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#1E1B18');
  bgGrad.addColorStop(0.5, '#2A2421');
  bgGrad.addColorStop(1, '#1A1715');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Decorative Accents
  ctx.save();
  ctx.strokeStyle = 'rgba(232, 91, 56, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, width - 96, height - 96);
  ctx.restore();

  // Header Section
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Overline
  ctx.font = '600 24px "Syne", sans-serif';
  ctx.fillStyle = '#E85B38';
  ctx.fillText('PORTLAND FOOD WEEK', width / 2, 140);

  // Main Title
  ctx.font = 'bold 54px "Fraunces", Georgia, serif';
  ctx.fillStyle = '#FFF8F3';
  ctx.fillText('My Top Picks', width / 2, 210);

  // Subtitle (Week Name)
  ctx.font = '500 30px "Syne", sans-serif';
  ctx.fillStyle = 'rgba(255, 248, 243, 0.75)';
  ctx.fillText(weekName.toUpperCase(), width / 2, 275);

  // Divider
  ctx.strokeStyle = 'rgba(232, 91, 56, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, 320);
  ctx.lineTo(width / 2 + 120, 320);
  ctx.stroke();

  // Render Top Picks (up to 5)
  const topPicks = savedItems.slice(0, 5);
  const cardStartY = 380;
  const cardHeight = 240;
  const cardSpacing = 30;

  for (let i = 0; i < topPicks.length; i++) {
    const item = topPicks[i];
    const y = cardStartY + i * (cardHeight + cardSpacing);
    const rank = i + 1;

    // Card background
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.roundRect(80, y, width - 160, cardHeight, 20);
    ctx.fill();

    ctx.strokeStyle = (rank === 1) ? '#E85B38' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = (rank === 1) ? 2 : 1;
    ctx.stroke();
    ctx.restore();

    // Rank badge pill
    ctx.save();
    let badgeBg = '#38322E';
    let badgeText = '#FFF8F3';
    if (rank === 1) { badgeBg = '#E85B38'; badgeText = '#FFFFFF'; }
    else if (rank === 2) { badgeBg = '#B0A8A0'; badgeText = '#1A1816'; }
    else if (rank === 3) { badgeBg = '#9C6845'; badgeText = '#FFFFFF'; }

    ctx.fillStyle = badgeBg;
    ctx.beginPath();
    ctx.roundRect(110, y + 25, 75, 50, 14);
    ctx.fill();

    ctx.font = 'bold 28px "Syne", sans-serif';
    ctx.fillStyle = badgeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${rank}`, 147, y + 50);
    ctx.restore();

    // Thumbnail / Emoji Box
    const thumbX = 210;
    const thumbY = y + 25;
    const thumbSize = 190;

    let imgLoaded = false;
    if (item.image) {
      try {
        const img = await loadImageWithTimeout(item.image, 1500);
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 16);
          ctx.clip();
          ctx.drawImage(img, thumbX, thumbY, thumbSize, thumbSize);
          ctx.restore();
          imgLoaded = true;
        }
      } catch (e) {
        imgLoaded = false;
      }
    }

    if (!imgLoaded) {
      // Fallback emoji icon
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.roundRect(thumbX, thumbY, thumbSize, thumbSize, 16);
      ctx.fill();
      ctx.font = '72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.emoji || '🍽️', thumbX + thumbSize / 2, thumbY + thumbSize / 2);
      ctx.restore();
    }

    // Dish details text
    const textStartX = 430;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Dish Name
    ctx.font = 'bold 34px "Fraunces", Georgia, serif';
    ctx.fillStyle = '#FFF8F3';
    const dishTitle = truncateText(ctx, item.dish || 'Special', width - textStartX - 120);
    ctx.fillText(dishTitle, textStartX, y + 35);

    // Restaurant Name
    ctx.font = '600 26px "Syne", sans-serif';
    ctx.fillStyle = '#E85B38';
    const restName = truncateText(ctx, item.restaurant || '', width - textStartX - 120);
    ctx.fillText(restName, textStartX, y + 85);

    // Neighborhood
    ctx.font = '400 22px sans-serif';
    ctx.fillStyle = 'rgba(255, 248, 243, 0.65)';
    const hood = item.neighborhood || item.address || '';
    if (hood) {
      ctx.fillText(`📍 ${truncateText(ctx, hood, width - textStartX - 120)}`, textStartX, y + 130);
    }

    // Personal Star Rating if given
    const userNote = State.notes[item.id] || (item.weekId && State.notes[`${item.weekId}_${item.id}`]);
    const starCount = (userNote && userNote.rating) ? Number(userNote.rating) : 0;
    if (starCount > 0) {
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#F5B041';
      ctx.fillText('★'.repeat(starCount) + '☆'.repeat(5 - starCount), textStartX, y + 172);
    }
  }

  // Footer / Branding
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 24px "Syne", sans-serif';
  ctx.fillStyle = 'rgba(255, 248, 243, 0.85)';
  ctx.fillText('Find all specials, maps & crawls at', width / 2, height - 125);

  ctx.font = 'bold 30px "Syne", sans-serif';
  ctx.fillStyle = '#E85B38';
  ctx.fillText('pdxfoodweek.com', width / 2, height - 80);

  // Trigger Share or Download
  canvas.toBlob(async (blob) => {
    if (!blob) {
      showToast('Could not generate graphic card.');
      return;
    }

    const filename = `pdx-${(week ? week.id : 'food-week')}-top-picks.png`;
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `My Top Picks for ${weekName}`,
          text: `Check out my top picks for Portland ${weekName}!`,
          files: [file]
        });
        showToast('Top picks shared!');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Download Image
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Graphic card saved to your device!');
  }, 'image/png');
}

function truncateText(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

function loadImageWithTimeout(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}
