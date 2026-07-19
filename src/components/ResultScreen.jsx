import ResultCard from './ResultCard.jsx';

export default function ResultScreen({ result, habit, onRestart, onDemoMode }) {
  const downloadCard = async () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const width = 900;
    const height = 1200;
    const score = result?.score ?? 88;
    canvas.width = width;
    canvas.height = height;

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f4fbf8');
    gradient.addColorStop(0.48, '#f7e8ef');
    gradient.addColorStop(1, '#e4edf8');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255,255,255,0.72)';
    roundRect(context, 80, 90, 740, 1020, 44);
    context.fill();

    context.fillStyle = '#38524d';
    context.font = '700 46px Inter, sans-serif';
    context.fillText('Face Reset Mirror', 140, 190);
    context.font = '500 28px Inter, sans-serif';
    context.fillText('今日 Face Reset 分數', 140, 250);

    context.beginPath();
    context.arc(450, 455, 145, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.strokeStyle = '#76b7c6';
    context.lineWidth = 20;
    context.stroke();

    context.fillStyle = '#253a37';
    context.font = '800 96px Inter, sans-serif';
    context.textAlign = 'center';
    context.fillText(String(score), 450, 490);
    context.textAlign = 'left';

    context.font = '600 32px Inter, sans-serif';
    context.fillText(`Eye Relax: ${result?.metrics?.eye ?? 82}%`, 160, 710);

    context.fillStyle = '#5f7772';
    context.font = '500 26px Inter, sans-serif';
    wrapText(
      context,
      result?.comment || '今天的眼周放鬆完成！慢慢滑、輕輕做，比追求完美更重要。',
      160,
      810,
      580,
      40,
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
