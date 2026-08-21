import { getCompletedProgramDays } from '../utils/dailyPlan.js';
import { playSceneEffect } from '../utils/audioManager.js';
import { useI18n } from '../i18n/context.js';

const DAY_SELECT_EFFECT = Object.freeze({
  source: '/audio/Overall/Ding.mp3',
  volume: 0.7,
});

export default function ProgramDaySelector({ habit, selectedDay, onSelectDay }) {
  const { t } = useI18n();
  const completedProgramDays = getCompletedProgramDays(habit);
  const datesByProgramDay = getDatesByProgramDay(habit);

  return (
    <div className="challenge-v3-days" aria-label={t('plan.daySelectorAria', { day: selectedDay })}>
      {Array.from({ length: 7 }, (_, index) => {
        const day = index + 1;
        const date = datesByProgramDay.get(day);
        const isSelected = day === selectedDay;
        const isComplete = completedProgramDays.has(day);
        const isAvailableHistory = Boolean(date) && !isSelected;
        return (
          <button
            key={day}
            className={`challenge-v3-day ${isSelected ? 'is-current' : ''} ${isComplete ? 'is-past' : ''} ${isAvailableHistory ? 'is-available' : ''}`}
            type="button"
            onClick={() => {
              if (!date || isSelected) return;
              playSceneEffect(DAY_SELECT_EFFECT);
              onSelectDay(date);
            }}
            disabled={!date}
            aria-current={isSelected ? 'step' : undefined}
            aria-label={t(date ? 'plan.viewDayAria' : 'plan.dayUnavailableAria', { day })}
          >
            {isSelected ? t('plan.daySelected', { day }) : day}
            {isComplete && <i aria-hidden="true">✓</i>}
          </button>
        );
      })}
    </div>
  );
}

function getDatesByProgramDay(habit) {
  const datesByProgramDay = new Map();

  Object.entries(habit?.programDayByDate || {}).forEach(([date, programDay]) => {
    const day = Number(programDay);
    if (date && Number.isInteger(day) && day >= 1) datesByProgramDay.set(day, date);
  });

  (habit?.history || []).forEach((entry) => {
    const day = Number(entry?.programDay);
    if (entry?.date && Number.isInteger(day) && day >= 1 && !datesByProgramDay.has(day)) {
      datesByProgramDay.set(day, entry.date);
    }
  });

  return datesByProgramDay;
}