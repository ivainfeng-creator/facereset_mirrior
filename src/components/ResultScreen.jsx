import { useState } from 'react';
import ResultCard from './ResultCard.jsx';

export default function ResultScreen({ result, habit, onRestart, onDemoMode }) {
  const [exportMessage, setExportMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const downloadVideo = async () => {
    setIsExporting(true);
    setExportMessage('Creating your animated reset video...');
    try {
      const video = await createResultVideo({ result, habit });
      downloadBlob(video.blob, `face-reset-vibe.${video.extension}`);
      setExportMessage(`Downloaded ${video.extension.toUpperCase()} video.`);
    } catch {
      const image = await createResultImage({ result, habit });
      downloadBlob(image.blob, 'face-reset-vibe.png');
      setExportMessage('Video export was not supported here, so a PNG was downloaded.');
    } finally {
      setIsExporting(false);
    }
  };

  const shareVideo = async () => {
    setIsExporting(true);
    setExportMessage('Preparing video for sharing...');
    try {
      const video = await createResultVideo({ result, habit });
      const file = new File([video.blob], `face-reset-vibe.${video.extension}`, { type: video.mimeType });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: 'Face Reset Mirror',
          text: 'My Face Reset vibe today.',
        });
        setExportMessage('Share sheet opened. Choose Instagram if it appears.');
      } else {
        downloadBlob(video.blob, `face-reset-vibe.${video.extension}`);
        setExportMessage('This browser cannot share video files directly. Video downloaded for manual Instagram upload.');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        setExportMessage('Share cancelled.');
      } else {
        setExportMessage('Sharing was not available here. Try downloading the video instead.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="screen result-screen">
      <ResultCard result={result} habit={habit} />

      <div className="button-row result-actions">
        <button className="primary-button" onClick={onRestart} disabled={isExporting}>
          Restart Routine
        </button>
        <button className="secondary-button" onClick={downloadVideo} disabled={isExporting}>
          Download Animated Video
        </button>
        <button className="secondary-button" onClick={shareVideo} disabled={isExporting}>
          Share Video
        </button>
        <button className="ghost-button text-ghost" onClick={onDemoMode} disabled={isExporting}>
          Try Demo Mode Again
        </button>
      </div>
      {exportMessage && <p className="export-message">{exportMessage}</p>}
    </section>
  );
}

async function createResultImage({ result, habit }) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 900;
  const height = 1200;
  const score = result?.score ?? 88;
  const snapshots = result?.snapshots || [];
  const radar = normalizeDownloadRadar(result?.radar);
  const images = await Promise.all(snapshots.slice(0, 5).map((snapshot) => loadImage(snapshot.image)));
  const hero = images[Math.floor(images.length / 2)];
  canvas.width = width;
  canvas.height = height;

  drawResultFrame(context, {
    habit,
    hero,
    progress: 1,
    radar,
    result,
    score,
    showPlay: true,
    width,
    height,
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve({ blob, extension: 'png', mimeType: 'image/png' }), 'image/png');
  });
}

async function createResultVideo({ result, habit }) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Video export is not supported in this browser.');
  }

  const width = 900;
  const height = 1200;
  const durationMs = 4200;
  const fps = 30;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const snapshots = result?.snapshots || [];
  const images = await Promise.all(snapshots.slice(0, 5).map((snapshot) => loadImage(snapshot.image)));
  const usableImages = images.filter(Boolean);
  const radar = normalizeDownloadRadar(result?.radar);
  const score = result?.score ?? 88;
  const mimeType = pickVideoMimeType();

  if (!mimeType) {
    throw new Error('No supported video mime type.');
  }

  canvas.width = width;
  canvas.height = height;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_500_000,
  });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start();

  await renderVideoFrames({
    context,
    durationMs,
    fps,
    frame: (progress) => {
      const image = usableImages.length
        ? usableImages[Math.floor(progress * durationMs / 480) % usableImages.length]
        : null;
      drawResultFrame(context, {
        habit,
        hero: image,
        progress,
        radar,
        result,
        score,
        showPlay: false,
        width,
        height,
      });
    },
  });

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  await stopped;

  return {
    blob: new Blob(chunks, { type: mimeType }),
    extension: mimeType.includes('mp4') ? 'mp4' : 'webm',
    mimeType,
  };
}

function drawResultFrame(context, { habit, hero, progress, radar, result, score, showPlay = false, width, height }) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#0f1111';
  context.textAlign = 'center';
  context.font = '900 58px Inter, sans-serif';
  context.fillText('what’s your reset vibe?', width / 2, 108);
  context.font = '760 26px Inter, sans-serif';
  context.fillText('pause and see which face reset mood matches your energy.', width / 2, 154);

  drawRadar(context, radar, width / 2, 560, 330, progress);

  if (hero) {
    const pulse = 1 + Math.sin(progress * Math.PI * 10) * 0.018;
    const size = 284 * pulse;
    drawPortraitCutout(context, hero, width / 2 - size / 2, 560 - size / 2, size, size);
  } else {
    context.fillStyle = '#eef6f3';
    roundRect(context, width / 2 - 142, 418, 284, 284, 72);
    context.fill();
  }

  if (showPlay) {
    drawPlayButton(context, width / 2, 560, 84);
  }

  context.fillStyle = '#0f1111';
  context.textAlign = 'left';
  context.font = '900 42px Inter, sans-serif';
  context.fillText(`Score ${score}`, 76, 1040);
  context.font = '800 26px Inter, sans-serif';
  context.fillText(`Streak Day ${result?.streak || habit?.streak || 1}`, 76, 1080);

  context.fillStyle = '#515b59';
  context.font = '500 24px Inter, sans-serif';
  wrapText(
    context,
    result?.comment || '今天的眼下雨刷完成！慢慢刷、輕輕滑，臉上的雲有被擦亮一點。',
    76,
    1124,
    748,
    34,
  );
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawPortraitCutout(context, image, x, y, width, height) {
  context.save();
  context.beginPath();
  context.moveTo(x + width * 0.5, y + height * 0.02);
  context.bezierCurveTo(x + width * 0.94, y + height * 0.02, x + width, y + height * 0.34, x + width * 0.86, y + height * 0.66);
  context.bezierCurveTo(x + width * 0.72, y + height, x + width * 0.18, y + height * 0.92, x + width * 0.08, y + height * 0.62);
  context.bezierCurveTo(x - width * 0.02, y + height * 0.32, x + width * 0.08, y + height * 0.02, x + width * 0.5, y + height * 0.02);
  context.closePath();
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();

  context.save();
  context.lineWidth = 10;
  context.strokeStyle = 'rgba(255,255,255,0.9)';
  context.beginPath();
  context.moveTo(x + width * 0.5, y + height * 0.02);
  context.bezierCurveTo(x + width * 0.94, y + height * 0.02, x + width, y + height * 0.34, x + width * 0.86, y + height * 0.66);
  context.bezierCurveTo(x + width * 0.72, y + height, x + width * 0.18, y + height * 0.92, x + width * 0.08, y + height * 0.62);
  context.bezierCurveTo(x - width * 0.02, y + height * 0.32, x + width * 0.08, y + height * 0.02, x + width * 0.5, y + height * 0.02);
  context.closePath();
  context.stroke();
  context.restore();
}

function drawPlayButton(context, centerX, centerY, radius) {
  context.save();
  context.fillStyle = 'rgba(255,255,255,0.76)';
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(15,17,17,0.54)';
  context.beginPath();
  context.moveTo(centerX - radius * 0.18, centerY - radius * 0.34);
  context.lineTo(centerX - radius * 0.18, centerY + radius * 0.34);
  context.lineTo(centerX + radius * 0.38, centerY);
  context.closePath();
  context.fill();
  context.restore();
}

function drawRadar(context, metrics, centerX, centerY, radius, progress = 1) {
  const points = metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index / metrics.length) * Math.PI * 2;
    const animatedValue = (metric.value || 0) * Math.min(1, 0.38 + progress * 1.2);
    return {
      ...metric,
      angle,
      x: centerX + Math.cos(angle) * radius * (animatedValue / 100),
      y: centerY + Math.sin(angle) * radius * (animatedValue / 100),
      axisX: centerX + Math.cos(angle) * radius,
      axisY: centerY + Math.sin(angle) * radius,
      labelX: centerX + Math.cos(angle) * (radius + 44),
      labelY: centerY + Math.sin(angle) * (radius + 44),
    };
  });

  context.save();
  context.strokeStyle = 'rgba(20,24,24,0.24)';
  context.lineWidth = 2.2;
  [0.34, 0.67, 1].forEach((level) => {
    context.beginPath();
    context.arc(centerX, centerY, radius * level, 0, Math.PI * 2);
    if (level < 1) context.setLineDash([4, 8]);
    else context.setLineDash([]);
    context.stroke();
  });
  context.setLineDash([]);

  points.forEach((point) => {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(point.axisX, point.axisY);
    context.stroke();
  });

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
  context.fillStyle = 'rgba(118,183,198,0.16)';
  context.strokeStyle = 'rgba(216,123,156,0.7)';
  context.lineWidth = 7;
  context.fill();
  context.stroke();

  context.fillStyle = '#4e5554';
  context.font = '760 23px Inter, sans-serif';
  context.textAlign = 'center';
  points.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fill();
    context.fillText(point.label, point.labelX, point.labelY);
  });
  context.restore();
}

function normalizeDownloadRadar(radar) {
  const fallback = [
    { label: 'flowy', value: 84 },
    { label: 'rhythm', value: 78 },
    { label: 'glowy', value: 88 },
    { label: 'soft', value: 81 },
    { label: 'playful', value: 90 },
  ];
  const map = {
    放鬆雲量: 'flowy',
    雨刷節奏: 'rhythm',
    眼下亮度: 'glowy',
    療癒電波: 'soft',
    好玩程度: 'playful',
    慢慢來力: 'slow',
  };
  return (radar?.length ? radar : fallback).slice(0, 5).map((metric, index) => ({
    label: map[metric.label] || metric.label || fallback[index].label,
    value: metric.value ?? fallback[index].value,
  }));
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function renderVideoFrames({ context, durationMs, fps, frame }) {
  const frameCount = Math.ceil((durationMs / 1000) * fps);
  return new Promise((resolve) => {
    let index = 0;
    const render = () => {
      const progress = index / Math.max(1, frameCount - 1);
      frame(progress, context);
      index += 1;
      if (index <= frameCount) {
        window.setTimeout(render, 1000 / fps);
      } else {
        resolve();
      }
    };
    render();
  });
}

function pickVideoMimeType() {
  return [
    'video/mp4;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const characters = Array.from(text);
  let line = '';
  let currentY = y;

  characters.forEach((character) => {
    const testLine = line + character;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = character;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });

  context.fillText(line, x, currentY);
}
