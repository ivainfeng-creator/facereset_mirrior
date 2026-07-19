import ResultCard from './ResultCard.jsx';

export default function ResultScreen({ result, habit, onRestart, onDemoMode }) {
  const downloadCard = async () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const width = 900;
    const height = 1200;
    const score = result?.score ?? 88;
    const snapshots = result?.snapshots || [];
    const radar = normalizeDownloadRadar(result?.radar);
    canvas.width = width;
    canvas.height = height;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    context.fillStyle = '#0f1111';
    context.textAlign = 'center';
    context.font = '900 58px Inter, sans-serif';
    context.fillText('what’s your reset vibe?', width / 2, 108);
    context.font = '760 26px Inter, sans-serif';
    context.fillText('pause and see which face reset mood matches your energy.', width / 2, 154);

    const images = await Promise.all(snapshots.slice(0, 5).map((snapshot) => loadImage(snapshot.image)));
    const hero = images[Math.floor(images.length / 2)];
    drawRadar(context, radar, width / 2, 560, 330);

    if (hero) {
      drawPortraitCutout(context, hero, width / 2 - 142, 418, 284, 284);
    } else {
      context.fillStyle = '#eef6f3';
      roundRect(context, width / 2 - 142, 418, 284, 284, 72);
      context.fill();
    }

    drawPlayButton(context, width / 2, 560, 84);

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

    const link = document.createElement('a');
    link.download = 'face-reset-result.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <section className="screen result-screen">
      <ResultCard result={result} habit={habit} />

      <div className="button-row result-actions">
        <button className="primary-button" onClick={onRestart}>
          Restart Routine
        </button>
        <button className="secondary-button" onClick={downloadCard}>
          Download Result Card
        </button>
        <button className="ghost-button text-ghost" onClick={onDemoMode}>
          Try Demo Mode Again
        </button>
      </div>
    </section>
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

function drawRoundedImage(context, image, x, y, width, height, radius) {
  context.save();
  roundRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
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

function drawRadar(context, metrics, centerX, centerY, radius) {
  const points = metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index / metrics.length) * Math.PI * 2;
    return {
      ...metric,
      angle,
      x: centerX + Math.cos(angle) * radius * ((metric.value || 0) / 100),
      y: centerY + Math.sin(angle) * radius * ((metric.value || 0) / 100),
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
